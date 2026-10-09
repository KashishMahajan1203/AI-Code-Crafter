export const FRAMEWORKS = [
  {
    value: "html",
    label: "HTML + CSS + JS",
    hint: "Single file",
  },
  {
    value: "react-vite",
    label: "React + Vite",
    hint: "Full project",
  },
  {
    value: "react-vite-tailwind",
    label: "React + Tailwind",
    hint: "Utility-first",
  },
];

export const PROMPT_MAX = 4000;

export const SUGGESTIONS = [
  { label: "Pricing table", prompt: "Pricing table with 3 tiers, a highlighted Pro plan and a monthly/yearly toggle" },
  { label: "Glass login card", prompt: "Login card with social sign-in buttons and a glassmorphism style" },
  { label: "SaaS hero", prompt: "SaaS landing hero with a gradient headline, product screenshot and two CTAs" },
  { label: "Analytics dashboard", prompt: "Analytics dashboard with a collapsible sidebar, stat cards and a recent activity table" },
  { label: "Testimonials", prompt: "Testimonial carousel with avatars, star ratings and auto-play" },
];

// Wraps a fragment in a document; full documents are used as-is.
export const buildHtmlPreview = (code) => {
  if (/<html[\s>]|<!doctype/i.test(code)) {
    return code;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>html,body{margin:0;min-height:100%;background:#fff}</style>
</head>
<body>
${code}
</body>
</html>`;
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Opens the preview in a new browser tab. The generated code runs inside a
// sandboxed iframe there too, so it can't read this app's localStorage/token.
export const openPreviewInNewTab = (html, title = "Preview") => {
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)} · CodeCrafter preview</title>
<style>html,body{margin:0;height:100%;background:#fff}iframe{display:block;width:100%;height:100%;border:0}</style>
</head>
<body>
<iframe title="${escapeHtml(title)}" sandbox="allow-scripts allow-forms allow-modals allow-popups" srcdoc="${escapeHtml(html)}"></iframe>
</body>
</html>`;

  const url = URL.createObjectURL(new Blob([page], { type: "text/html" }));
  const tab = window.open(url, "_blank");

  if (tab) {
    tab.opener = null;
  }

  // Keep the URL alive long enough for the tab to load (and be refreshed).
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);

  return Boolean(tab);
};

export const slugify = (value) =>
  String(value || "codecrafter-project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "codecrafter-project";

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadProject = async (project) => {
  const name = slugify(project.projectName);

  if (project.projectType === "html") {
    triggerDownload(
      new Blob([project.code], { type: "text/html" }),
      `${name}.html`
    );
    return;
  }

  // Loaded on demand so it isn't part of the initial bundle.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const folder = zip.folder(name);

  project.files.forEach((file) => folder.file(file.path, file.content));

  if (project.previewHtml) {
    folder.file("preview.html", project.previewHtml);
  }

  const blob = await zip.generateAsync({ type: "blob" });

  triggerDownload(blob, `${name}.zip`);
};

export const languageFromPath = (path = "") => {
  const ext = path.split(".").pop().toLowerCase();

  return (
    {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      css: "css",
      json: "json",
      html: "html",
      md: "markdown",
    }[ext] || "plaintext"
  );
};

export const timeAgo = (date) => {
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(date).toLocaleDateString();
};
