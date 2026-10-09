import React, { useEffect, useState } from "react";
import {
  LuCircleStop,
  LuCode,
  LuCopy,
  LuDownload,
  LuExternalLink,
  LuEye,
  LuFolderTree,
  LuMaximize2,
  LuMonitor,
  LuPlus,
  LuSmartphone,
  LuSparkles,
  LuTablet,
  LuX,
} from "react-icons/lu";
import CodeEditor from "./CodeEditor";
import ProjectOutput from "./ProjectOutput";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { buildHtmlPreview, openPreviewInNewTab } from "../lib/project";
import { buildReactPreview } from "../lib/reactPreview";

const VIEWPORTS = [
  { id: "desktop", label: "Desktop", icon: LuMonitor, width: "100%" },
  { id: "tablet", label: "Tablet", icon: LuTablet, width: "768px" },
  { id: "mobile", label: "Mobile", icon: LuSmartphone, width: "390px" },
];

const LOADING_STEPS = [
  "Reading your prompt",
  "Designing the layout",
  "Writing components",
  "Polishing styles",
  "Building the live preview",
];

const EmptyState = () => (
  <div className="workspace-empty">
    <div className="workspace-topline">
      <span className="workspace-label">
        <span className="kicker-mark" /> OUTPUT
      </span>
      <span className="workspace-state">
        <span className="state-dot" /> Waiting for a prompt
      </span>
    </div>

    <div className="empty-content">
      <div className="empty-art" aria-hidden="true">
        <span className="empty-art-window">
          <i />
          <i />
          <i />
        </span>
        <span className="empty-art-line w-70" />
        <span className="empty-art-line w-45" />
        <span className="empty-art-grid">
          <b />
          <b />
          <b />
        </span>
      </div>
      <p>Your live preview appears here</p>
      <span>
        Pick a stack, describe the UI and hit generate. You'll get editable
        code, a responsive preview and a downloadable project.
      </span>
    </div>

    <div className="empty-footer">
      <span>Live preview</span>
      <span>Monaco editor</span>
      <span>ZIP export</span>
      <span>Cloud history</span>
    </div>
  </div>
);

const LoadingState = ({ onCancel }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const step = Math.min(Math.floor(elapsed / 6), LOADING_STEPS.length - 1);

  return (
    <div className="workspace-loading" role="status" aria-live="polite">
      <div className="loading-orb" aria-hidden="true">
        <LuSparkles />
      </div>

      <p className="loading-title">Crafting your component</p>
      <span className="loading-timer">{elapsed}s elapsed</span>

      <ol className="loading-steps">
        {LOADING_STEPS.map((label, index) => (
          <li
            key={label}
            className={
              index < step ? "is-done" : index === step ? "is-current" : ""
            }
          >
            <span className="loading-step-dot" />
            {label}
          </li>
        ))}
      </ol>

      <button type="button" className="ghost-button" onClick={onCancel}>
        <LuCircleStop /> Cancel
      </button>
    </div>
  );
};

const PreviewFrame = ({ html, width, title }) => (
  <div className="preview-stage">
    <div
      className={`preview-device ${width !== "100%" ? "is-framed" : ""}`}
      style={{ width, maxWidth: "100%" }}
    >
      <iframe
        title={title}
        srcDoc={html}
        className="preview-frame"
        // No allow-same-origin: generated code can't touch this app.
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
      />
    </div>
  </div>
);

const Workspace = ({
  project,
  loading,
  onCancel,
  onCodeChange,
  onCopy,
  onDownload,
  onNew,
}) => {
  const [tab, setTab] = useState("preview");
  const [viewport, setViewport] = useState("desktop");
  const location = useLocation();
  const navigate = useNavigate();

  // Full screen is a history entry (/studio#preview), so the browser's
  // Back button closes it instead of leaving the studio.
  const fullscreenRequested = location.hash === "#preview";

  const openFullscreen = () =>
    navigate({ hash: "preview" }, { state: { previewFullscreen: true } });

  const closeFullscreen = () => {
    if (location.state?.previewFullscreen) {
      navigate(-1);
    } else {
      // Opened directly via URL (e.g. after a reload): just drop the hash.
      navigate({ hash: "" }, { replace: true });
    }
  };

  const [activePath, setActivePath] = useState(null);

  // Reset the view whenever a different project is shown
  // (edits and saves keep the same key).
  const [shownKey, setShownKey] = useState(project?.key);
  if (project?.key !== shownKey) {
    setShownKey(project?.key);
    setTab("preview");
    setActivePath(
      project?.files?.find((file) => file.path.endsWith("App.jsx"))?.path ||
        null
    );
  }

  useEffect(() => {
    if (!fullscreenRequested) return;

    const onKey = (event) => event.key === "Escape" && closeFullscreen();
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  });

  // React previews are compiled from the real project files.
  const [reactPreview, setReactPreview] = useState({ key: null, html: "", error: "" });

  useEffect(() => {
    if (project?.projectType !== "react" || !project.files?.length) return;

    let active = true;

    buildReactPreview(project)
      .then((html) => active && setReactPreview({ key: project.key, html, error: "" }))
      .catch((error) => {
        console.error("Preview build failed:", error);
        if (active) {
          // Projects saved before in-browser previews may still have one.
          setReactPreview({ key: project.key, html: project.previewHtml || "", error: error.message });
        }
      });

    return () => {
      active = false;
    };
  }, [project]);

  if (loading) return <LoadingState onCancel={onCancel} />;
  if (!project) return <EmptyState />;

  const isReact = project.projectType === "react";
  const previewBuilding = isReact && reactPreview.key !== project.key;
  const previewHtml = isReact
    ? previewBuilding ? "" : reactPreview.html
    : buildHtmlPreview(project.code);
  const width = VIEWPORTS.find((item) => item.id === viewport).width;
  const expanded = fullscreenRequested && Boolean(previewHtml);

  const tabs = [
    { id: "preview", label: "Preview", icon: LuEye },
    isReact
      ? { id: "files", label: "Files", icon: LuFolderTree }
      : { id: "code", label: "Code", icon: LuCode },
  ];

  const copyCurrent = () => {
    if (!isReact) return onCopy(project.code);

    const file =
      project.files.find((item) => item.path === activePath) ||
      project.files.find((item) => item.path.endsWith("App.jsx")) ||
      project.files[0];

    return onCopy(file.content, true, file.path);
  };

  return (
    <div className="workspace-result">
      <div className="workspace-topbar">
        <div className="workspace-tabs" role="tablist" aria-label="Output view">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`workspace-tab ${tab === id ? "is-active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>

        <div className="toolbar-actions">
          {tab === "preview" && (
            <div className="viewport-picker" role="group" aria-label="Preview size">
              {VIEWPORTS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`viewport-button ${viewport === id ? "is-active" : ""}`}
                  onClick={() => setViewport(id)}
                  aria-pressed={viewport === id}
                  aria-label={label}
                  title={label}
                >
                  <Icon />
                </button>
              ))}
            </div>
          )}

          <button type="button" className="tool-button" onClick={copyCurrent} title="Copy code" aria-label="Copy code">
            <LuCopy />
          </button>
          <button type="button" className="tool-button" onClick={onDownload} title={isReact ? "Download ZIP" : "Download HTML"} aria-label="Download">
            <LuDownload />
          </button>
          {previewHtml && (
            <button
              type="button"
              className="tool-button"
              onClick={() => {
                if (!openPreviewInNewTab(previewHtml, project.projectName)) {
                  toast.warn("Pop-up blocked. Allow pop-ups for this site to open the preview in a new tab.");
                }
              }}
              title="Open preview in new tab"
              aria-label="Open preview in new tab"
            >
              <LuExternalLink />
            </button>
          )}
          {previewHtml && (
            <button type="button" className="tool-button" onClick={openFullscreen} title="Full screen preview" aria-label="Full screen preview">
              <LuMaximize2 />
            </button>
          )}
          <button type="button" className="tool-button is-accent" onClick={onNew} title="New project" aria-label="New project">
            <LuPlus />
          </button>
        </div>
      </div>

      <div className="workspace-toolbar">
        <span className="file-label">
          <span className="file-type-mark">{isReact ? "JSX" : "</>"}</span>
          <strong>{project.projectName}</strong>
        </span>
        <span className="framework-badge">{project.framework}</span>
      </div>

      <div className="workspace-body">
        {tab === "preview" &&
          (previewHtml ? (
            <PreviewFrame html={previewHtml} width={width} title="Generated preview" />
          ) : previewBuilding ? (
            <div className="empty-content">
              <span className="stream-indicator" />
              <p>Building preview…</p>
            </div>
          ) : (
            <div className="empty-content">
              <p>Preview couldn't be built</p>
              <span>{reactPreview.error || "Open the Files tab to browse the generated code."}</span>
            </div>
          ))}

        {tab === "code" && (
          <div className="editor-frame">
            <CodeEditor value={project.code} language="html" onChange={onCodeChange} />
          </div>
        )}

        {tab === "files" && (
          <ProjectOutput
            project={project}
            activePath={activePath}
            onSelect={setActivePath}
            onCopy={onCopy}
          />
        )}
      </div>

      {/* Portalled to <body> so the sticky panel's stacking context
          can't put it underneath the navbar. */}
      {expanded &&
        createPortal(
            <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="Full screen preview">
              <div className="preview-overlay-bar">
                <span>
                  <LuEye /> {project.projectName}
                </span>
                <button
                  type="button"
                  className="tool-button close-preview"
                  onClick={closeFullscreen}
                  aria-label="Close full screen preview"
                  autoFocus
                >
                  <LuX />
                </button>
              </div>
              <iframe
                title="Full screen preview"
                srcDoc={previewHtml}
                className="expanded-preview-frame"
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
              />
            </div>,
          document.body
        )}
    </div>
  );
};

export default Workspace;
