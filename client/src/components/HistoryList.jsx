import React, { useState } from "react";
import { LuCode, LuFolderOpen, LuSearch, LuTrash2, LuX } from "react-icons/lu";
import { FaReact } from "react-icons/fa";
import { timeAgo } from "../lib/project";

const HistoryItem = ({ project, active, onOpen, onDelete }) => {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className={`history-entry ${active ? "is-active" : ""}`}>
      <button
        type="button"
        className="history-entry-open"
        onClick={() => onOpen(project._id)}
      >
        <span className="history-entry-icon" aria-hidden="true">
          {project.projectType === "html" ? <LuCode /> : <FaReact />}
        </span>

        <span className="history-entry-body">
          <span className="history-entry-prompt">{project.projectName}</span>
          <span className="history-entry-meta">
            <span>{project.framework}</span>
            <span>{timeAgo(project.createdAt)}</span>
          </span>
        </span>
      </button>

      {confirming ? (
        <span className="history-confirm">
          <button
            type="button"
            className="history-confirm-yes"
            onClick={() => onDelete(project._id)}
          >
            Delete
          </button>
          <button
            type="button"
            className="history-remove"
            onClick={() => setConfirming(false)}
            aria-label="Cancel delete"
          >
            <LuX />
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="history-remove"
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${project.projectName}`}
          title="Delete"
        >
          <LuTrash2 />
        </button>
      )}
    </li>
  );
};

const HistoryList = ({
  projects,
  loading,
  activeId,
  search,
  onSearch,
  onOpen,
  onDelete,
}) => (
  <section className="history-section" aria-labelledby="history-title">
    <div className="history-header">
      <h2 id="history-title">
        <LuFolderOpen /> Saved projects
        <span className="history-toggle-count">{projects.length}</span>
      </h2>
    </div>

    <label className="history-search">
      <LuSearch aria-hidden="true" />
      <input
        type="search"
        placeholder="Search by name or prompt"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        aria-label="Search saved projects"
        maxLength={100}
      />
    </label>

    <div className="history-list">
      {loading ? (
        <div className="history-skeleton" aria-label="Loading projects">
          <span />
          <span />
          <span />
        </div>
      ) : projects.length === 0 ? (
        <p className="history-empty">
          {search
            ? "No projects match that search."
            : "Nothing saved yet. Your generations are stored here automatically."}
        </p>
      ) : (
        <ul>
          {projects.map((project) => (
            <HistoryItem
              key={project._id}
              project={project}
              active={project._id === activeId}
              onOpen={onOpen}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  </section>
);

export default HistoryList;
