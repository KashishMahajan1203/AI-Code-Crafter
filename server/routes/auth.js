import express from "express";

import {
  signUp,
  login,
  logOut,
  sanitizeUser,
} from "../controllers/auth.controller.js";

import authMiddleware from "../middleware/auth.middleware.js";
import { authLimiter } from "../middleware/rateLimit.js";
import {
  requireJsonBody,
  validateLogin,
  validateSignUp,
} from "../middleware/validate.js";

const router = express.Router();

/* =========================
   PUBLIC ROUTES
========================= */

router.post("/signup", authLimiter, requireJsonBody, validateSignUp, signUp);

router.post("/login", authLimiter, requireJsonBody, validateLogin, login);

/* =========================
   AUTHENTICATED ROUTES
========================= */

router.get("/me", authMiddleware, (req, res) => {
  return res.status(200).json({
    success: true,
    user: sanitizeUser(req.user),
  });
});

router.post("/logout", authMiddleware, logOut);

export default router;
