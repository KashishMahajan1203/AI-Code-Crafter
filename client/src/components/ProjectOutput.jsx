import React, { useMemo, useState } from "react";
import {
  LuBraces,
  LuCheck,
  LuCopy,
  LuFileCode2,
  LuFileJson,
  LuFileType,
  LuPackage,
  LuPalette,
  LuTerminal,
} from "react-icons/lu";
import CodeEditor from "./CodeEditor";
import { languageFromPath } from "../lib/project";

const fileIcon = (path) => {
  if (/\.(jsx?|tsx?)$/.test(path)) return <LuFileCode2 className="icon-js" />;
  if (path.endsWith(".css")) return <LuPalette className="icon-css" />;
  if (path.endsWith(".json")) return <LuFileJson className="icon-json" />;
  if (path.endsWith(".html")) return <LuBraces className="icon-html" />;
  return <LuFileType />;
};

const depth = (path) => path.split("/").length - 1;

const CopyLine = ({ command, onCopy }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await onCopy(command, false)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="command-line">
      <code>
        <span aria-hidden="true">$</span> {command}
      </code>
      <button type="button" onClick={copy} aria-label={`Copy ${command}`}>
        {copied ? <LuCheck /> : <LuCopy />}
      </button>
    </div>
  );
};

const ProjectOutput = ({ project, activePath, onSelect, onCopy }) => {
  // Folders first, then files, alphabetically - like an editor sidebar.
  const files = useMemo(
    () =>
      [...project.files].sort((a, b) => {
        const da = depth(a.path);
        const db = depth(b.path);
        return da === db ? a.path.localeCompare(b.path) : da - db;
      }),
    [project.files]
  );

  const activeFile =
    files.find((file) => file.path === activePath) || files[0];

  const commands = [
    "npm install",
    project.dependencies.length > 0 &&
      `npm install ${project.dependencies.join(" ")}`,
    project.devDependencies.length > 0 &&
      `npm install -D ${project.devDependencies.join(" ")}`,
    "npm run dev",
  ].filter(Boolean);

  return (
    <div className="project-output">
      <nav className="file-tree" aria-label="Project files">
        <p className="file-tree-label">
          <LuPackage /> {project.projectName}
        </p>

        <ul>
          {files.map((file) => (
            <li key={file.path}>
              <button
                type="button"
                className={file.path === activeFile?.path ? "is-active" : ""}
                onClick={() => onSelect(file.path)}
                title={file.path}
              >
                {fileIcon(file.path)}
                <span>{file.path}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="setup-block">
          <p className="file-tree-label">
            <LuTerminal /> Run locally
          </p>
          {commands.map((command) => (
            <CopyLine key={command} command={command} onCopy={onCopy} />
          ))}
        </div>
      </nav>

      <div className="file-view">
        {activeFile && (
          <CodeEditor
            path={activeFile.path}
            value={activeFile.content}
            language={languageFromPath(activeFile.path)}
            readOnly
          />
        )}
      </div>
    </div>
  );
};

export default ProjectOutput;
