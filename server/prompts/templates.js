/*
  Prompt templates live on the server so the public API can only be
  used for component generation, not as a general-purpose LLM proxy.
*/

export const FRAMEWORKS = {
  html: {
    label: "HTML + CSS + JavaScript",
    type: "html",
  },
  "react-vite": {
    label: "React + Vite",
    type: "react",
  },
  "react-vite-tailwind": {
    label: "React + Vite + Tailwind CSS",
    type: "react",
  },
};

const htmlSystemPrompt = () => `
You are an expert frontend developer.

Create a complete, polished frontend component from the user's request.

Return ONLY the code of a single, complete HTML document.
Do NOT include markdown code fences or explanations.

Requirements:
1. Production-quality, modern, responsive UI.
2. Start with <!DOCTYPE html> and include a viewport meta tag.
3. Inline all CSS in a <style> tag and all JavaScript in a <script> tag.
4. Must work directly when opened as an .html file.
5. Accessible, semantic HTML.
6. Realistic content - no lorem ipsum or placeholders.
`.trim();

// Plain-text file blocks instead of JSON: models don't have to escape
// code inside JSON strings, which was the main source of broken output.
const reactSystemPrompt = (label, tailwind) => `
You are an expert senior React developer and UI/UX engineer.

Create a COMPLETE, RUNNABLE ${label} project (JavaScript, not TypeScript) from the user's request.

OUTPUT FORMAT - follow it exactly, with nothing before or after:

=== FILE: package.json ===
<full file content>
=== END FILE ===
=== FILE: src/App.jsx ===
<full file content>
=== END FILE ===
(...one block per file)

Do NOT wrap file contents in markdown fences. Do NOT add explanations.

REQUIRED FILES:
- package.json  ("type": "module", scripts "dev": "vite" and "build": "vite build",
  dependencies react and react-dom ^19, devDependencies vite ^7 and @vitejs/plugin-react ^5${tailwind ? ", tailwindcss ^3, postcss ^8, autoprefixer ^10" : ""})
- vite.config.js (uses @vitejs/plugin-react)
- index.html (has <div id="root"></div> and <script type="module" src="/src/main.jsx"></script>)
- src/main.jsx (createRoot from "react-dom/client", imports ./index.css)
- src/App.jsx
- src/index.css
${tailwind ? "- tailwind.config.js (content: [\"./index.html\", \"./src/**/*.{js,jsx}\"]) and postcss.config.js, both as ES modules (export default)\n- src/index.css must start with @tailwind base; @tailwind components; @tailwind utilities;\n" : ""}- Reusable components in src/components/*.jsx

RULES:
- Every file complete and working. No TODOs, no lorem ipsum, no placeholders.
- Only import packages listed in package.json. Use react-icons for icons if needed.
- Use relative imports with the file extension omitted for .jsx (e.g. "./components/Navbar").
- No images from local files; use inline SVG, CSS or https image URLs.
- Functional components and hooks, semantic and accessible HTML.
- Modern, polished, responsive design${tailwind ? " built with Tailwind utility classes" : " with plain CSS"}.
- Keep it focused: about 4 to 10 files.
`.trim();

export const buildMessages = (framework, userPrompt) => {
  const config = FRAMEWORKS[framework];

  const system =
    config.type === "html"
      ? htmlSystemPrompt()
      : reactSystemPrompt(config.label, framework === "react-vite-tailwind");

  return [
    { role: "system", content: system },
    { role: "user", content: userPrompt },
  ];
};

/* =========================
   RESPONSE PARSING
========================= */

const stripFences = (text) =>
  String(text || "")
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

export const parseHtmlResponse = (text) => {
  const code = stripFences(text);

  if (!/<[a-z!]/i.test(code)) {
    throw new Error("Response is not HTML.");
  }

  return code;
};

const normalizePath = (value) =>
  String(value || "")
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "");

const isSafePath = (value) =>
  value.length > 0 &&
  value.length <= 200 &&
  !value.includes("..") &&
  !value.startsWith("/") &&
  /^[\w.\-/@]+$/.test(value);

const FILE_BLOCK = /^=== FILE: (.+?) ===[ \t]*\r?\n([\s\S]*?)\r?\n?^=== END FILE ===[ \t]*$/gm;

const parseFileBlocks = (text) => {
  const files = [];

  for (const match of text.matchAll(FILE_BLOCK)) {
    files.push({
      path: normalizePath(match[1]),
      // Some models still wrap a block in a code fence.
      content: match[2].replace(/^```[\w-]*\r?\n/, "").replace(/\r?\n```\s*$/, ""),
    });
  }

  return files;
};

// Older prompt format, kept as a fallback for models that answer in JSON anyway.
const parseJsonFiles = (text) => {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first === -1 || last <= first) return [];

  try {
    const raw = JSON.parse(text.slice(first, last + 1));
    return Array.isArray(raw?.files)
      ? raw.files
          .filter((file) => typeof file?.path === "string" && typeof file?.content === "string")
          .map((file) => ({ path: normalizePath(file.path), content: file.content }))
      : [];
  } catch {
    return [];
  }
};

/* =========================
   PROJECT REPAIR
   Fills in boilerplate the model forgot so the project
   actually installs and builds.
========================= */

// Toolchain versions known to work together. They always override
// whatever the model wrote, since models often invent version numbers.
const BASE_DEPENDENCIES = { react: "^19.1.0", "react-dom": "^19.1.0" };
const BASE_DEV_DEPENDENCIES = { vite: "^7.1.0", "@vitejs/plugin-react": "^5.0.0" };
const TAILWIND_DEV_DEPENDENCIES = { tailwindcss: "^3.4.17", postcss: "^8.5.0", autoprefixer: "^10.4.20" };

export const CORE_PACKAGES = new Set([
  ...Object.keys(BASE_DEPENDENCIES),
  ...Object.keys(BASE_DEV_DEPENDENCIES),
  ...Object.keys(TAILWIND_DEV_DEPENDENCIES),
]);

// Packages that are safe to add automatically when imported but not declared.
const KNOWN_VERSIONS = {
  "react-icons": "^5.5.0",
  "react-router-dom": "^7.9.0",
  "framer-motion": "^12.0.0",
  "lucide-react": "^0.540.0",
  clsx: "^2.1.1",
  recharts: "^3.2.0",
  "chart.js": "^4.5.0",
  "react-chartjs-2": "^5.3.0",
  axios: "^1.12.0",
  "date-fns": "^4.1.0",
  uuid: "^13.0.0",
};

const NODE_BUILTINS = new Set(["path", "fs", "url", "node:path", "node:fs", "node:url"]);

const packageNameOf = (specifier) => {
  if (specifier.startsWith(".") || specifier.startsWith("/") || NODE_BUILTINS.has(specifier)) {
    return null;
  }

  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
};

const findImports = (files) => {
  const packages = new Set();
  const pattern = /(?:import\s[^'"]*?from\s*|import\s*\(?\s*)["']([^"']+)["']/g;

  for (const file of files) {
    if (!/\.(jsx?|mjs)$/.test(file.path) || /config\.(c?js|mjs)$/.test(file.path)) continue;

    for (const match of file.content.matchAll(pattern)) {
      const name = packageNameOf(match[1]);
      if (name) packages.add(name);
    }
  }

  return packages;
};

const DEFAULT_FILES = {
  "index.html": (name) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  "vite.config.js": () => `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`,
  "src/main.jsx": () => `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`,
  "src/index.css": (_name, tailwind) =>
    tailwind ? "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n" : "",
  "tailwind.config.js": () => `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
};
`,
  "postcss.config.js": () => `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
};

const repairProject = (files, tailwind) => {
  const byPath = new Map(files.map((file) => [file.path, file]));

  // TypeScript entry points are out of scope; normalise names the template expects.
  for (const [from, to] of [["src/main.tsx", "src/main.jsx"], ["src/App.tsx", "src/App.jsx"], ["src/main.js", "src/main.jsx"], ["src/App.js", "src/App.jsx"]]) {
    if (byPath.has(from) && !byPath.has(to)) {
      const file = byPath.get(from);
      byPath.delete(from);
      byPath.set(to, { ...file, path: to });
    }
  }

  if (!byPath.has("src/App.jsx")) {
    throw new Error("Generated project has no src/App.jsx.");
  }

  let pkg = {};
  try {
    pkg = JSON.parse(byPath.get("package.json")?.content || "{}");
  } catch {
    pkg = {};
  }

  const name =
    typeof pkg.name === "string" && pkg.name.trim()
      ? pkg.name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "codecrafter-project"
      : "codecrafter-project";

  const required = ["index.html", "vite.config.js", "src/main.jsx", "src/index.css"];
  if (tailwind) required.push("tailwind.config.js", "postcss.config.js");

  for (const path of required) {
    const alternatives = path.endsWith(".config.js")
      ? [path, path.replace(".js", ".cjs"), path.replace(".js", ".mjs"), path.replace(".js", ".ts")]
      : [path];

    if (!alternatives.some((candidate) => byPath.has(candidate))) {
      byPath.set(path, { path, content: DEFAULT_FILES[path](name, tailwind) });
    }
  }

  // Tailwind directives must be present or no utility classes are generated.
  if (tailwind) {
    const css = byPath.get("src/index.css");
    if (!/@tailwind\s+utilities|@import\s+["']tailwindcss/.test(css.content)) {
      css.content = DEFAULT_FILES["src/index.css"](name, true) + "\n" + css.content;
    }
  }

  const dependencies = { ...(pkg.dependencies || {}) };
  const devDependencies = { ...(pkg.devDependencies || {}) };

  // Pin the toolchain (and keep each package in the right section).
  const pinned = {
    dependencies: BASE_DEPENDENCIES,
    devDependencies: { ...BASE_DEV_DEPENDENCIES, ...(tailwind ? TAILWIND_DEV_DEPENDENCIES : {}) },
  };

  for (const name of CORE_PACKAGES) {
    delete dependencies[name];
    delete devDependencies[name];
  }

  Object.assign(dependencies, pinned.dependencies);
  Object.assign(devDependencies, pinned.devDependencies);

  for (const imported of findImports([...byPath.values()])) {
    if (!dependencies[imported] && !devDependencies[imported]) {
      dependencies[imported] = KNOWN_VERSIONS[imported] || "latest";
    }
  }

  const packageJson = {
    ...pkg,
    name,
    private: true,
    version: pkg.version || "0.1.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
      ...(pkg.scripts || {}),
    },
    dependencies,
    devDependencies,
  };

  byPath.set("package.json", {
    path: "package.json",
    content: JSON.stringify(packageJson, null, 2) + "\n",
  });

  return {
    name,
    files: [...byPath.values()],
    dependencies: Object.keys(dependencies),
    devDependencies: Object.keys(devDependencies),
  };
};

// Pulls file blocks (or legacy JSON files) out of a model answer.
export const extractFiles = (text) => {
  const cleaned = String(text || "").trim();

  let files = parseFileBlocks(cleaned);
  if (files.length === 0) files = parseJsonFiles(cleaned);

  return files.filter((file) => isSafePath(file.path)).slice(0, 60);
};

export const finalizeProject = (files, framework) => {
  if (files.length === 0) {
    throw new Error("No project files were generated.");
  }

  const tailwind = framework === "react-vite-tailwind";
  const project = repairProject(files, tailwind);

  return {
    projectName: project.name,
    framework: FRAMEWORKS[framework].label,
    files: project.files,
    dependencies: project.dependencies,
    devDependencies: project.devDependencies,
    setupCommands: ["npm install", "npm run dev"],
    // Previews are now built in the browser from the real files.
    previewHtml: "",
  };
};

export const parseReactResponse = (text, framework) =>
  finalizeProject(extractFiles(text), framework);

// Follow-up message asking the model to fix specific problems.
export const buildFixMessages = (framework, userPrompt, previousAnswer, problemList) => [
  ...buildMessages(framework, userPrompt),
  { role: "assistant", content: previousAnswer },
  {
    role: "user",
    content: `Static checks found these errors in your project:

${problemList}

Fix them. Reply with ONLY the corrected files, each as a complete file in the same
"=== FILE: path ===" ... "=== END FILE ===" format. Do not resend unchanged files.`,
  },
];

export const mergeFiles = (files, fixes) => {
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const fix of fixes) byPath.set(fix.path, fix);
  return [...byPath.values()];
};
