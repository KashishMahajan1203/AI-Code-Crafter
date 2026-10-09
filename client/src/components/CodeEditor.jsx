import React from "react";
import Editor from "@monaco-editor/react";

// Matches the app palette so the editor doesn't look bolted on.
const defineTheme = (monaco) => {
  monaco.editor.defineTheme("codecrafter", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "5f7773", fontStyle: "italic" },
      { token: "keyword", foreground: "5ce0c4" },
      { token: "string", foreground: "f2c97d" },
      { token: "tag", foreground: "7cc7ff" },
      { token: "attribute.name", foreground: "b9a7ff" },
    ],
    colors: {
      "editor.background": "#0d1516",
      "editor.lineHighlightBackground": "#14201f",
      "editorLineNumber.foreground": "#3b4d4b",
      "editorLineNumber.activeForeground": "#8fb3ad",
      "editor.selectionBackground": "#24594f88",
      "editorCursor.foreground": "#5ce0c4",
      "scrollbarSlider.background": "#26353688",
    },
  });
};

const CodeEditor = ({ value, language = "html", readOnly = false, onChange, path }) => (
  <Editor
    height="100%"
    path={path}
    language={language}
    theme="codecrafter"
    beforeMount={defineTheme}
    value={value}
    onChange={(next) => onChange?.(next || "")}
    loading={
      <div className="editor-loading">
        <span className="stream-indicator" /> Loading editor...
      </div>
    }
    options={{
      readOnly,
      minimap: { enabled: false },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
      fontLigatures: true,
      wordWrap: "on",
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      padding: { top: 16, bottom: 16 },
      renderLineHighlight: "all",
    }}
  />
);

export default CodeEditor;
