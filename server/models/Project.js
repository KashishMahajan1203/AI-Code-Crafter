import mongoose from "mongoose";

const projectFileSchema = new mongoose.Schema(
  {
    path: {
      type: String,
      required: true,
    },

    content: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const projectSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    projectType: {
      type: String,
      enum: ["react", "html"],
      default: "react",
    },

    projectName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    framework: {
      type: String,
      default: "React + Vite + Tailwind CSS",
    },

    prompt: {
      type: String,
      required: true,
    },

    // Single-file output for HTML projects.
    code: {
      type: String,
      default: "",
    },

    files: {
      type: [projectFileSchema],
      default: [],
    },

    dependencies: {
      type: [String],
      default: [],
    },

    devDependencies: {
      type: [String],
      default: [],
    },

    setupCommands: {
      type: [String],
      default: [],
    },

    previewHtml: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Every project query filters by owner and sorts newest first,
// so one compound index serves list, get and delete.
projectSchema.index({ user: 1, createdAt: -1 });

// Lets users search their history by name or prompt.
projectSchema.index(
  { projectName: "text", prompt: "text" },
  { weights: { projectName: 3, prompt: 1 }, name: "project_text_search" }
);

const Project = mongoose.model("Project", projectSchema);

export default Project;
