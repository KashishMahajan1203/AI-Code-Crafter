import {
  FRAMEWORKS,
  buildFixMessages,
  buildMessages,
  extractFiles,
  finalizeProject,
  mergeFiles,
  parseHtmlResponse,
  parseReactResponse,
} from "../prompts/templates.js";
import {
  checkProject,
  fixDependencyVersions,
  formatProblems,
} from "../prompts/verify.js";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

// Tried in order. Free models are often rate-limited or slow, so a
// failure on one (429, empty answer, unusable output) moves to the next.
// Override with OPENROUTER_MODELS (comma-separated) or OPENROUTER_MODEL.
const DEFAULT_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "poolside/laguna-s-2.1:free",
  "openrouter/free",
];

// Whole request budget, and the most a single model call may take.
const TOTAL_BUDGET_MS = 170_000;
const ATTEMPT_TIMEOUT_MS = 120_000;
const MIN_ATTEMPT_MS = 20_000;
// Only try to auto-fix a project when there is enough time left.
const MIN_FIX_MS = 25_000;

const MAX_OUTPUT_TOKENS = { html: 12_000, react: 20_000 };

export const getModels = () => {
  const configured = (process.env.OPENROUTER_MODELS || process.env.OPENROUTER_MODEL || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_MODELS;
};

class AttemptError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

const requestCompletion = async ({ apiKey, model, messages, maxTokens, timeoutMs }) => {
  let response;

  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer":
          process.env.FRONTEND_ORIGIN?.split(",")[0] ||
          "http://localhost:5173",
        "X-Title": "CodeCrafter AI",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: maxTokens,
        // Reasoning models otherwise spend the whole budget "thinking".
        reasoning: { effort: "low", exclude: true },
      }),
    });
  } catch (error) {
    throw new AttemptError(
      error.name === "TimeoutError" ? "timeout" : "network",
      error.message
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.error) {
    const status = response.ok ? data.error?.code : response.status;
    throw new AttemptError(
      status === 429 ? "rate_limited" : status === 401 || status === 402 ? "auth" : "provider",
      `${status}: ${data?.error?.message || "provider error"}`
    );
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new AttemptError("empty", `empty answer (finish: ${data?.choices?.[0]?.finish_reason})`);
  }

  return content;
};

const parseOrThrow = (parse) => {
  try {
    return parse();
  } catch (error) {
    throw new AttemptError("unusable", error.message);
  }
};

// Corrects dependency versions, then runs the static checks.
const inspect = async (project) => {
  const deps = await fixDependencyVersions(project.files);
  const checked = { ...project, files: deps.files };

  return {
    project: checked,
    problems: [...deps.problems, ...checkProject(checked.files)],
  };
};

// Static-checks a React project and asks the same model to fix what it finds.
const verifyAndFix = async ({ project: generated, call, framework, prompt, answer, deadline }) => {
  let { project, problems } = await inspect(generated);

  if (problems.length === 0 || deadline - Date.now() < MIN_FIX_MS) {
    return { project, problems };
  }

  console.log(`🔧 Fixing ${problems.length} problem(s):\n${formatProblems(problems)}`);

  try {
    const fixAnswer = await call(
      buildFixMessages(framework, prompt, answer, formatProblems(problems))
    );
    const fixes = extractFiles(fixAnswer);

    if (fixes.length > 0) {
      const fixed = await inspect(
        finalizeProject(mergeFiles(project.files, fixes), framework)
      );

      // Only keep the fix if it actually made things better.
      if (fixed.problems.length < problems.length) {
        ({ project, problems } = fixed);
      }
    }
  } catch (error) {
    console.warn(`⚠️  Auto-fix failed: ${error.message}`);
  }

  return { project, problems };
};

export const generateComponent = async (req, res) => {
  const prompt = req.body.prompt.trim();
  const { framework } = req.body;
  const { type, label } = FRAMEWORKS[framework];

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error("❌ OPENROUTER_API_KEY is missing from .env");

    return res.status(503).json({
      success: false,
      message: "AI generation is not configured on the server.",
    });
  }

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const failures = [];

  // Stop calling the provider if the user cancels or closes the tab.
  let clientGone = false;
  res.on("close", () => {
    if (!res.writableFinished) clientGone = true;
  });

  for (const model of getModels()) {
    if (deadline - Date.now() < MIN_ATTEMPT_MS || clientGone) break;

    const started = Date.now();

    const call = (messages) =>
      requestCompletion({
        apiKey,
        model,
        messages,
        maxTokens: MAX_OUTPUT_TOKENS[type],
        timeoutMs: Math.min(ATTEMPT_TIMEOUT_MS, deadline - Date.now()),
      });

    try {
      const answer = await call(buildMessages(framework, prompt));

      if (type === "html") {
        const code = parseOrThrow(() => parseHtmlResponse(answer));

        console.log(`✅ Generated html with ${model} in ${Math.round((Date.now() - started) / 1000)}s`);

        return res.status(200).json({ success: true, type, framework: label, code });
      }

      const parsed = parseOrThrow(() => parseReactResponse(answer, framework));
      const { project, problems } = await verifyAndFix({
        project: parsed,
        call,
        framework,
        prompt,
        answer,
        deadline,
      });

      console.log(
        `✅ Generated ${framework} with ${model} in ${Math.round((Date.now() - started) / 1000)}s` +
          (problems.length ? ` (${problems.length} unresolved problem(s))` : "")
      );

      return res.status(200).json({
        success: true,
        type,
        framework: label,
        project,
        warnings: problems.slice(0, 10).map((problem) => `${problem.path}:${problem.line} ${problem.message}`),
      });
    } catch (error) {
      if (!(error instanceof AttemptError)) {
        console.error("❌ Generation controller error:", error);
        break;
      }

      failures.push(error.kind);
      console.warn(`⚠️  ${model} failed after ${Math.round((Date.now() - started) / 1000)}s (${error.kind}): ${error.message}`);

      // A bad key won't work for the next model either.
      if (error.kind === "auth") break;
    }
  }

  if (clientGone) return undefined;

  const allRateLimited = failures.length > 0 && failures.every((kind) => kind === "rate_limited");

  return res.status(allRateLimited ? 429 : 503).json({
    success: false,
    message: allRateLimited
      ? "All AI models are busy right now. Please try again in a minute."
      : "The AI couldn't produce a working project this time. Please try again or simplify the prompt.",
  });
};
