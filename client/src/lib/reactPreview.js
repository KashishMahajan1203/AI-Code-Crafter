/*
  Builds a live preview of a generated React project in the browser:
  JSX is compiled with Sucrase, local modules become data: URLs,
  npm packages load from esm.sh and React is shared via an import map.
  The result is a standalone HTML document for a sandboxed iframe.
*/

const REACT_VERSION = "19.1.0";
const ESM = "https://esm.sh";
const SCRIPT_EXT = [".jsx", ".js", ".mjs", ".tsx", ".ts"];

const dirname = (path) => path.split("/").slice(0, -1).join("/");

const resolvePath = (from, specifier) => {
  const parts = dirname(from).split("/").filter(Boolean);

  for (const part of specifier.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }

  return parts.join("/");
};

const findFile = (files, base) => {
  const candidates = [
    base,
    ...SCRIPT_EXT.map((ext) => base + ext),
    ...SCRIPT_EXT.map((ext) => `${base}/index${ext}`),
  ];

  return candidates.find((candidate) => files.has(candidate));
};

// encodeURIComponent leaves ' alone, which would end a single-quoted
// import specifier early, so it is encoded explicitly.
const toDataUrl = (code, type = "text/javascript") =>
  `data:${type};charset=utf-8,${encodeURIComponent(code).replace(/'/g, "%27")}`;

const escapeForScript = (value) => value.replace(/<\/(script)/gi, "<\\/$1");

const bareVersion = (pkg, name) => {
  const range = pkg.dependencies?.[name] || pkg.devDependencies?.[name];
  const exact = range && range.match(/\d+(\.\d+){0,2}/)?.[0];
  return exact && range !== "latest" ? `@${exact.split(".")[0]}` : "";
};

const packageUrl = (specifier, pkg) => {
  const parts = specifier.split("/");
  const nameLength = specifier.startsWith("@") ? 2 : 1;
  const name = parts.slice(0, nameLength).join("/");
  const subpath = parts.slice(nameLength).join("/");

  return `${ESM}/${name}${bareVersion(pkg, name)}${subpath ? `/${subpath}` : ""}?external=react,react-dom`;
};

// Matches static imports/exports-from, side-effect imports and dynamic import().
const IMPORT_PATTERN =
  /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"']+)\2/g;

export const buildReactPreview = async (project) => {
  const { transform } = await import("sucrase");

  const files = new Map(project.files.map((file) => [file.path, file.content]));
  const styles = [];
  const modules = new Map();
  const building = new Set();

  let pkg = {};
  try {
    pkg = JSON.parse(files.get("package.json") || "{}");
  } catch {
    pkg = {};
  }

  const tailwind = Boolean(
    pkg.dependencies?.tailwindcss || pkg.devDependencies?.tailwindcss
  );

  const addStyle = (path) => {
    if (styles.some((style) => style.path === path)) return;

    // @tailwind/@apply need a compiler; the Tailwind CDN script handles classes.
    const css = (files.get(path) || "")
      .replace(/@tailwind[^;]*;/g, "")
      .replace(/@import\s+["']tailwindcss[^;]*;/g, "");

    styles.push({ path, css });
  };

  const buildModule = (path) => {
    if (modules.has(path)) return modules.get(path);

    if (building.has(path)) {
      throw new Error(`Circular import involving ${path} is not supported in preview.`);
    }

    building.add(path);

    let code;
    try {
      code = transform(files.get(path), {
        transforms: ["jsx", ...(/\.tsx?$/.test(path) ? ["typescript"] : [])],
        jsxRuntime: "automatic",
        production: true,
        filePath: path,
      }).code;
    } catch (error) {
      throw new Error(`${path}: ${error.message}`);
    }

    code = code.replace(IMPORT_PATTERN, (match, prefix, quote, specifier) => {
      if (/^(https?:|data:)/.test(specifier)) return match;

      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        const target = specifier.startsWith("/")
          ? specifier.slice(1)
          : resolvePath(path, specifier);

        if (/\.css$/.test(target)) {
          addStyle(target);
          return `${prefix}${quote}${toDataUrl("")}${quote}`;
        }

        const file = findFile(files, target);

        if (!file) {
          throw new Error(`${path}: cannot find "${specifier}".`);
        }

        if (!SCRIPT_EXT.some((ext) => file.endsWith(ext))) {
          // Assets (svg/json/…) become a module exporting their content.
          const asset = file.endsWith(".json")
            ? `export default ${files.get(file)};`
            : `export default ${JSON.stringify(toDataUrl(files.get(file), file.endsWith(".svg") ? "image/svg+xml" : "text/plain"))};`;

          return `${prefix}${quote}${toDataUrl(asset)}${quote}`;
        }

        return `${prefix}${quote}${buildModule(file)}${quote}`;
      }

      if (specifier.endsWith(".css")) {
        // CSS from npm packages (e.g. a library theme).
        styles.push({ path: specifier, href: `${ESM}/${specifier}` });
        return `${prefix}${quote}${toDataUrl("")}${quote}`;
      }

      if (/^(react|react-dom)(\/|$)/.test(specifier)) return match;

      return `${prefix}${quote}${packageUrl(specifier, pkg)}${quote}`;
    });

    building.delete(path);

    const url = toDataUrl(code);
    modules.set(path, url);
    return url;
  };

  const indexHtml = files.get("index.html") || "";
  const entryFromHtml = indexHtml.match(/<script[^>]+type=["']module["'][^>]+src=["']\/?([^"']+)["']/i)?.[1];
  const entry = [entryFromHtml, "src/main.jsx", "src/main.js", "src/index.jsx", "src/main.tsx"].find(
    (candidate) => candidate && files.has(candidate)
  );

  if (!entry) {
    throw new Error("No entry file (src/main.jsx) found.");
  }

  const entryUrl = buildModule(entry);

  // Keep fonts/stylesheets the project links in its index.html.
  const headLinks = (indexHtml.match(/<link\b[^>]*>/gi) || [])
    .filter((tag) => /rel=["'](stylesheet|preconnect)["']/i.test(tag) && /https?:\/\//i.test(tag))
    .join("\n");

  const title = indexHtml.match(/<title>([^<]*)<\/title>/i)?.[1] || project.projectName;

  let tailwindConfig = "";
  if (tailwind) {
    const source =
      files.get("tailwind.config.js") || files.get("tailwind.config.cjs") || files.get("tailwind.config.mjs") || "";
    const body = source
      .replace(/\/\*\*?[\s\S]*?\*\//g, "")
      .replace(/^\s*(import|const|let|var)\s.*require\(.*$/gm, "")
      .replace(/^\s*import\s.*$/gm, "")
      .replace(/export\s+default|module\.exports\s*=/, "tailwind.config =")
      .replace(/plugins\s*:\s*\[[\s\S]*?\]/, "plugins: []");

    tailwindConfig = `<script>try { ${escapeForScript(body)} } catch (e) { console.warn("Tailwind config ignored in preview", e); }</script>`;
  }

  // One React instance for everything: react-dom is pinned to the same
  // version and other packages are built with react marked external.
  const pin = `?deps=react@${REACT_VERSION}`;
  const importMap = {
    imports: {
      react: `${ESM}/react@${REACT_VERSION}`,
      "react/jsx-runtime": `${ESM}/react@${REACT_VERSION}/jsx-runtime`,
      "react/jsx-dev-runtime": `${ESM}/react@${REACT_VERSION}/jsx-dev-runtime`,
      "react-dom": `${ESM}/react-dom@${REACT_VERSION}${pin}`,
      "react-dom/client": `${ESM}/react-dom@${REACT_VERSION}/client${pin}`,
    },
  };

  const styleTags = styles
    .map((style) =>
      style.href
        ? `<link rel="stylesheet" href="${style.href}" />`
        : `<style data-file="${style.path}">${style.css.replace(/<\/style/gi, "<\\/style")}</style>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title.replace(/</g, "&lt;")}</title>
${headLinks}
${tailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : ""}
${tailwindConfig}
${styleTags}
<style>
#cc-preview-error{position:fixed;inset:auto 12px 12px 12px;z-index:2147483647;max-height:45vh;overflow:auto;padding:14px 16px;border-radius:10px;background:#2a0f12;color:#ffd7d7;font:12px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap;box-shadow:0 10px 40px rgba(0,0,0,.4)}
#cc-preview-error b{display:block;margin-bottom:6px;color:#ff9a9a;font:600 13px system-ui,sans-serif}
</style>
<script>
  // Surface runtime errors inside the preview instead of a blank page.
  function ccShowError(message) {
    var box = document.getElementById("cc-preview-error");
    if (!box) {
      box = document.createElement("div");
      box.id = "cc-preview-error";
      box.innerHTML = "<b>Preview error</b>";
      (document.body || document.documentElement).appendChild(box);
    }
    box.appendChild(document.createTextNode(String(message) + "\\n"));
  }
  window.addEventListener("error", function (e) {
    var err = e.error;
    ccShowError((err && (err.name + ": " + err.message)) || e.message);
  });

  // The sandbox (no allow-same-origin) blocks Web Storage, which many
  // generated apps use. Give them an in-memory replacement instead.
  ["localStorage", "sessionStorage"].forEach(function (name) {
    try { window[name].getItem("x"); return; } catch (e) {}
    var data = {};
    var storage = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; },
      clear: function () { data = {}; },
      key: function (i) { return Object.keys(data)[i] || null; },
      get length() { return Object.keys(data).length; }
    };
    try { Object.defineProperty(window, name, { value: storage, configurable: true }); } catch (e) {}
  });
  window.addEventListener("unhandledrejection", function (e) { ccShowError(e.reason && e.reason.message || e.reason); });
</script>
<script type="importmap">${escapeForScript(JSON.stringify(importMap))}</script>
</head>
<body>
<div id="root"></div>
<script type="module">
  import(${JSON.stringify(entryUrl)}).catch(function (e) { ccShowError(e.message || e); });
</script>
</body>
</html>`;
};
