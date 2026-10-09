import express from "express";

import {
  createProject,
  getProjects,
  getProjectById,
  deleteProject,
} from "../controllers/project.controller.js";

import authMiddleware from "../middleware/auth.middleware.js";
import {
  requireJsonBody,
  validateObjectIdParam,
  validateProject,
} from "../middleware/validate.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", requireJsonBody, validateProject, createProject);

router.get("/", getProjects);

router.get("/:id", validateObjectIdParam("id"), getProjectById);

router.delete("/:id", validateObjectIdParam("id"), deleteProject);

export default router;
