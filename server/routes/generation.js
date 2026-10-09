import express from "express";

import {
  generateComponent,
} from "../controllers/generation.controller.js";

import authMiddleware from "../middleware/auth.middleware.js";
import { generationLimiter } from "../middleware/rateLimit.js";
import {
  requireJsonBody,
  validateGeneration,
} from "../middleware/validate.js";

const router = express.Router();

// Auth runs first so the limiter can key on the user id.
router.post(
  "/",
  authMiddleware,
  generationLimiter,
  requireJsonBody,
  validateGeneration,
  generateComponent
);

export default router;
