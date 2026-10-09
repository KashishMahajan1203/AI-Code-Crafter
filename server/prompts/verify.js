import { Linter } from "eslint";
import globals from "globals";
import semver from "semver";
import { CORE_PACKAGES } from "./templates.js";

/*
  Static checks for generated React projects. Catches the mistakes that
  still pass `vite build` but crash in the browser: undefined variables,
  components used without being imported, and imports of missing files.
*/

// Core no-undef ignores JSX tag names, so <Navbar /> without an import
// would slip through. This rule checks capitalised JSX identifiers.
const jsxNoUndef = {
  meta: { type: "problem", schema: [] },
  create(context) {
    const isDefined = (node, name) => {
      for (let scope = context.sourceCode.getScope(node); scope; scope = scope.upper) {
        if (scope.set.has(name)) return true;
      }
      return false;
    };

    return {
      JSXOpeningElement(node) {
        let target = node.name;
        while (target.type === "JSXMemberExpression") target = target.object;

        if (target.type === "JSXIdentifier" && /^[A-Z]/.test(target.name) && !isDefined(node, target.name)) {
          context.report({ node: target, message: `'${target.name}' is not defined.` });
        }
      },
    };
  },
};

const linter = new Linter({ configType: "flat" });

const config = [
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2024 },
    },
    plugins: { cc: { rules: { "jsx-no-undef": jsxNoUndef } } },
    rules: {
      "no-undef": "error",
      "cc/jsx-no-undef": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
    },
  },
  {
    // Config files run in Node.
    files: ["*.config.{js,cjs,mjs}"],
    languageOptions: { globals: { ...globals.node } },
  },
];

const SCRIPT_EXT = [".jsx", ".js", ".mjs"];
const ASSET = /\.(css|svg|png|jpe?g|gif|webp|json)$/;

const resolveLocal = (paths, from, specifier) => {
  const parts = from.split("/").slice(0, -1);

  for (const part of specifier.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }

  const base = parts.join("/");
  const candidates = [base, ...SCRIPT_EXT.map((ext) => base + ext), ...SCRIPT_EXT.map((ext) => `${base}/index${ext}`)];

  return candidates.find((candidate) => paths.has(candidate));
};

const IMPORT_PATTERN = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']+)["']/g;

export const checkProject = (files) => {
  const paths = new Set(files.map((file) => file.path));
  const problems = [];

  for (const file of files) {
    if (!/\.(jsx?|mjs)$/.test(file.path)) continue;

    for (const message of linter.verify(file.content, config, { filename: file.path })) {
      problems.push({
        path: file.path,
        line: message.line,
        message: message.fatal ? `Syntax error: ${message.message}` : message.message,
      });
    }

    for (const match of file.content.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];

      if (ASSET.test(specifier) && !specifier.endsWith(".css")) continue;
      if (!resolveLocal(paths, file.path, specifier)) {
        const line = file.content.slice(0, match.index).split("\n").length;
        problems.push({ path: file.path, line, message: `Imported file "${specifier}" does not exist.` });
      }
    }
  }

  return problems;
};

export const formatProblems = (problems) =>
  problems
    .slice(0, 25)
    .map((problem) => `- ${problem.path}:${problem.line} ${problem.message}`)
    .join("\n");

/* =========================
   DEPENDENCY VERSIONS
   Models invent version numbers (e.g. a "^5.4.0" that was never
   published), which makes `npm install` fail. Each non-toolchain
   package is checked against the npm registry.
========================= */

const REGISTRY = "https://registry.npmjs.org";
const REGISTRY_TIMEOUT_MS = 6000;

const lookupPackage = async (name) => {
  try {
    const response = await fetch(`${REGISTRY}/${name.replace("/", "%2f")}`, {
      headers: { Accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
    });

    if (response.status === 404) return { exists: false };
    if (!response.ok) return null;

    const data = await response.json();
    return {
      exists: true,
      latest: data["dist-tags"]?.latest,
      versions: Object.keys(data.versions || {}),
    };
  } catch {
    // Registry unreachable: leave the version alone rather than guess.
    return null;
  }
};

export const fixDependencyVersions = async (files) => {
  const pkgFile = files.find((file) => file.path === "package.json");
  if (!pkgFile) return { files, problems: [] };

  let pkg;
  try {
    pkg = JSON.parse(pkgFile.content);
  } catch {
    return { files, problems: [{ path: "package.json", line: 1, message: "package.json is not valid JSON." }] };
  }

  const problems = [];
  const changed = [];

  const checks = ["dependencies", "devDependencies"].flatMap((section) =>
    Object.entries(pkg[section] || {})
      .filter(([name]) => !CORE_PACKAGES.has(name))
      .map(async ([name, range]) => {
        const info = await lookupPackage(name);
        if (!info) return;

        if (!info.exists) {
          delete pkg[section][name];
          changed.push(`${name} (removed)`);
          problems.push({ path: "package.json", line: 1, message: `Package "${name}" does not exist on npm; do not use it.` });
          return;
        }

        const valid = semver.validRange(range) && semver.maxSatisfying(info.versions, range);

        if (!valid && info.latest) {
          pkg[section][name] = `^${info.latest}`;
          changed.push(`${name} ${range} -> ^${info.latest}`);
        }
      })
  );

  await Promise.all(checks);

  if (changed.length === 0) return { files, problems };

  console.log(`📦 Fixed dependency versions: ${changed.join(", ")}`);

  return {
    files: files.map((file) =>
      file === pkgFile ? { ...file, content: `${JSON.stringify(pkg, null, 2)}\n` } : file
    ),
    problems,
  };
};
