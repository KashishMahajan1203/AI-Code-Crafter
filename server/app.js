import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/auth.js";
import generationRoutes from "./routes/generation.js";
import projectRoutes from "./routes/projects.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { enforceHttps } from "./middleware/security.js";

const createApp = (config) => {
  const app = express();

  app.disable("x-powered-by");

  if (config.trustProxy > 0) {
    app.set("trust proxy", config.trustProxy);
  }

  if (config.forceHttps) {
    app.use(enforceHttps);
  }

  // The API only serves JSON, so the CSP can be fully locked down.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-site" },
      hsts: config.forceHttps
        ? { maxAge: 63072000, includeSubDomains: true, preload: true }
        : false,
      referrerPolicy: { policy: "no-referrer" },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and non-browser requests have no Origin header.
        if (!origin || config.frontendOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
    })
  );

  // Generated React projects (files + preview) can be large, but not unbounded.
  app.use(express.json({ limit: "2mb" }));

  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      success: true,
      status: "ok",
      message: "CodeCrafter AI backend is running.",
    });
  });

  app.use("/api", apiLimiter);

  app.use("/api/auth", authRoutes);

  app.use("/api/projects", projectRoutes);

  app.use("/api/generate", generationRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: "API route not found.",
    });
  });

  app.use((error, _req, res, _next) => {
    if (res.headersSent) {
      return res.end();
    }

    if (error.type === "entity.too.large") {
      return res.status(413).json({
        success: false,
        message: "Request body is too large.",
      });
    }

    if (error instanceof SyntaxError && "body" in error) {
      return res.status(400).json({
        success: false,
        message: "Request body must contain valid JSON.",
      });
    }

    console.error("❌ Express error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected server error occurred.",
    });
  });

  return app;
};

export default createApp;
