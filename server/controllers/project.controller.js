import Project from "../models/Project.js";

// Fields shown in the history list; file contents and preview are
// fetched only when a project is opened.
const SUMMARY_FIELDS =
  "projectType projectName framework prompt dependencies createdAt";

const MAX_LIST = 50;

export const createProject = async (req, res) => {
  try {
    const {
      projectType = "react",
      projectName,
      framework,
      prompt,
      code,
      files,
      dependencies,
      devDependencies,
      setupCommands,
      previewHtml,
    } = req.body;

    // Fields are whitelisted so a client can't set `user` or timestamps.
    const project = await Project.create({
      user: req.user._id,
      projectType,
      projectName: projectName.trim(),
      framework,
      prompt: prompt.trim(),
      code: code || "",
      files: (files || []).map(({ path, content }) => ({ path, content })),
      dependencies: dependencies || [],
      devDependencies: devDependencies || [],
      setupCommands: setupCommands || [],
      previewHtml: previewHtml || "",
    });

    return res.status(201).json({
      success: true,
      message: "Project saved successfully.",
      project,
    });
  } catch (error) {
    console.error("❌ Create project error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save project.",
    });
  }
};

export const getProjects = async (req, res) => {
  try {
    const search =
      typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";

    const filter = { user: req.user._id };

    if (search) {
      filter.$text = { $search: search };
    }

    const projects = await Project.find(filter)
      .select(SUMMARY_FIELDS)
      .sort({ createdAt: -1 })
      .limit(MAX_LIST)
      .lean();

    return res.status(200).json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("❌ Get projects error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch projects.",
    });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    return res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("❌ Get project error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch project.",
    });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully.",
    });
  } catch (error) {
    console.error("❌ Delete project error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete project.",
    });
  }
};
