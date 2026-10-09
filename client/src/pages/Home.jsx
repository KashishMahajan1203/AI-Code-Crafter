import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { FaReact } from "react-icons/fa";
import { LuCode, LuCornerDownLeft, LuSparkles, LuWind } from "react-icons/lu";

import Navbar from "../components/Navbar";
import HistoryList from "../components/HistoryList";
import Workspace from "../components/Workspace";
import { apiRequest } from "../lib/api";
import {
  FRAMEWORKS,
  PROMPT_MAX,
  SUGGESTIONS,
  downloadProject,
} from "../lib/project";

const FRAMEWORK_ICONS = {
  html: LuCode,
  "react-vite": FaReact,
  "react-vite-tailwind": LuWind,
};

// randomUUID needs a secure context, so fall back on plain HTTP.
const newKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const nameFromPrompt = (prompt) => {
  const words = prompt
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ")
    .replace(/[\s.,;:!?-]+$/, "");
  return words.length > 60 ? `${words.slice(0, 57)}...` : words;
};

const Home = ({ user, onLogout }) => {
  const [framework, setFramework] = useState("react-vite-tailwind");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [search, setSearch] = useState("");

  const abortRef = useRef(null);
  const workspaceRef = useRef(null);

  /* =========================
     HISTORY (stored in MongoDB)
  ========================= */

  useEffect(() => {
    const controller = new AbortController();

    // Debounce typing in the search box.
    const timer = setTimeout(() => {
      const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";

      apiRequest(`/projects${query}`, { signal: controller.signal })
        .then((response) => setHistory(response.projects || []))
        .catch((error) => {
          if (error.name !== "AbortError") {
            toast.error(error.message);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setHistoryLoading(false);
        });
    }, search ? 300 : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  const openProject = async (id) => {
    try {
      const { project: saved } = await apiRequest(`/projects/${id}`);

      setProject({ ...saved, key: newKey() });
      setPrompt(saved.prompt);
      scrollToWorkspace();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteProject = async (id) => {
    try {
      await apiRequest(`/projects/${id}`, { method: "DELETE" });

      setHistory((items) => items.filter((item) => item._id !== id));

      if (project?._id === id) {
        setProject(null);
      }

      toast.success("Project deleted.");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const saveProject = async (generated) => {
    try {
      const { project: saved } = await apiRequest("/projects", {
        method: "POST",
        body: JSON.stringify(generated),
      });

      setProject((current) =>
        current?.key === generated.key ? { ...current, _id: saved._id } : current
      );

      if (!search) {
        setHistory((items) => [saved, ...items]);
      }
    } catch (error) {
      toast.warn(`Generated, but not saved: ${error.message}`);
    }
  };

  /* =========================
     GENERATION
  ========================= */

  const scrollToWorkspace = () => {
    // On stacked (mobile) layouts the output is below the composer.
    if (window.matchMedia("(max-width: 900px)").matches) {
      workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const generate = async () => {
    const trimmed = prompt.trim();

    if (!trimmed) {
      toast.info("Describe what you want to build first.");
      return;
    }

    if (loading) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    scrollToWorkspace();

    try {
      const response = await apiRequest("/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: trimmed, framework }),
        signal: controller.signal,
      });

      const generated =
        response.type === "html"
          ? {
              projectType: "html",
              projectName: nameFromPrompt(trimmed),
              framework: response.framework,
              prompt: trimmed,
              code: response.code,
            }
          : {
              projectType: "react",
              prompt: trimmed,
              ...response.project,
            };

      generated.key = newKey();

      setProject(generated);

      if (response.warnings?.length) {
        console.warn("Unresolved issues in generated project:", response.warnings);
        toast.warn(
          `Generated, but ${response.warnings.length} issue(s) couldn't be fixed automatically: ${response.warnings[0]}`
        );
      } else {
        toast.success("Your component is ready.");
      }

      saveProject(generated);
    } catch (error) {
      if (error.name === "AbortError") {
        toast.info("Generation cancelled.");
      } else {
        toast.error(error.message);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const cancelGeneration = () => abortRef.current?.abort();

  // Abort an in-flight request if the user leaves the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  const onPromptKeyDown = (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      generate();
    }
  };

  /* =========================
     WORKSPACE ACTIONS
  ========================= */

  const copy = useCallback(async (text, notify = true, label = "Code") => {
    try {
      await navigator.clipboard.writeText(text);
      if (notify) toast.success(`${label} copied to clipboard.`);
      return true;
    } catch {
      toast.error("Clipboard is not available in this browser.");
      return false;
    }
  }, []);

  const download = async () => {
    try {
      await downloadProject(project);
    } catch (error) {
      console.error(error);
      toast.error("Download failed.");
    }
  };

  const startNew = () => {
    setProject(null);
    setPrompt("");
  };

  const charsLeft = PROMPT_MAX - prompt.length;

  return (
    <div className="app-shell">
      <Navbar user={user} onLogout={onLogout} />

      <main className="dashboard-main">
        <section className="composer-panel" aria-labelledby="composer-title">
          <div className="section-kicker">
            <span className="kicker-mark" />
            NEW GENERATION
          </div>

          <div className="composer-heading">
            <h1 id="composer-title">
              Describe it.
              <br />
              <span>We'll craft the code.</span>
            </h1>
            <p>
              Hi {user?.name?.split(" ")[0] || "there"} — pick a stack, describe
              the interface and get a live, editable result in seconds.
            </p>
          </div>

          <fieldset className="form-field stack-field">
            <legend className="field-label">Stack</legend>

            <div className="stack-picker" role="radiogroup">
              {FRAMEWORKS.map((option) => {
                const Icon = FRAMEWORK_ICONS[option.value];
                const checked = framework === option.value;

                return (
                  <label
                    key={option.value}
                    className={`stack-option ${checked ? "is-active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="framework"
                      value={option.value}
                      checked={checked}
                      onChange={() => setFramework(option.value)}
                      disabled={loading}
                    />
                    <Icon aria-hidden="true" />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="form-field prompt-field">
            <div className="prompt-label-row">
              <label className="field-label" htmlFor="prompt-input">
                What do you want to build?
              </label>
              <span
                className={`character-count ${charsLeft < 200 ? "is-low" : ""}`}
                aria-live="polite"
              >
                {prompt.length}/{PROMPT_MAX}
              </span>
            </div>

            <textarea
              id="prompt-input"
              className="prompt-input"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={onPromptKeyDown}
              maxLength={PROMPT_MAX}
              placeholder="e.g. A pricing section with three plans, a highlighted 'Pro' tier, monthly/yearly toggle and FAQ below…"
              disabled={loading}
            />
          </div>

          <div className="suggestion-block">
            <div className="suggestion-label">TRY ONE OF THESE</div>
            <div className="suggestion-list">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => setPrompt(suggestion.prompt)}
                  title={suggestion.prompt}
                  disabled={loading}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>

          <div className="generate-row">
            <span className="generate-hint">
              <kbd>Ctrl</kbd> + <kbd><LuCornerDownLeft aria-label="Enter" /></kbd> to generate
            </span>

            <button
              type="button"
              className="generate-button"
              onClick={generate}
              disabled={loading || !prompt.trim()}
            >
              {loading ? (
                <>
                  <span className="button-spinner" aria-hidden="true" />
                  Generating…
                </>
              ) : (
                <>
                  <LuSparkles aria-hidden="true" />
                  Generate
                </>
              )}
            </button>
          </div>

          <HistoryList
            projects={history}
            loading={historyLoading}
            activeId={project?._id}
            search={search}
            onSearch={setSearch}
            onOpen={openProject}
            onDelete={deleteProject}
          />
        </section>

        <section
          className="workspace-panel"
          ref={workspaceRef}
          aria-label="Generated output"
        >
          <Workspace
            project={project}
            loading={loading}
            onCancel={cancelGeneration}
            onCodeChange={(code) =>
              setProject((current) => ({ ...current, code }))
            }
            onCopy={copy}
            onDownload={download}
            onNew={startNew}
          />
        </section>
      </main>
    </div>
  );
};

export default Home;
