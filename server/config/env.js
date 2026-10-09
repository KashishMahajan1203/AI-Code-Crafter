/*
  Central place for environment configuration.
  Fails fast at startup when a required variable is missing,
  instead of failing later on the first request.
*/

const parseList = (value, fallback) =>
  (value || fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const loadConfig = () => {
  const env = process.env;
  const isProduction = env.NODE_ENV === "production";
  const errors = [];

  const mongoUri = env.MONGO_URI || env.MONGODB_URI;

  if (!mongoUri) {
    errors.push("MONGODB_URI is required.");
  }

  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    errors.push("JWT_SECRET is required and must be at least 32 characters.");
  }

  if (!env.OPENROUTER_API_KEY) {
    console.warn("⚠️  OPENROUTER_API_KEY is not set. AI generation will be disabled.");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid backend/.env:\n  - ${errors.join("\n  - ")}`);
  }

  return {
    isProduction,
    port: Number(env.PORT || 5000),
    mongoUri,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN || "7d",
    frontendOrigins: parseList(env.FRONTEND_ORIGIN, "http://localhost:5173"),
    // HTTPS is enforced in production unless explicitly disabled
    // (e.g. when a platform already terminates TLS and redirects for you).
    forceHttps: env.FORCE_HTTPS
      ? env.FORCE_HTTPS === "true"
      : isProduction,
    // Number of reverse proxies in front of the app (Nginx, Render, Railway...).
    trustProxy: Number(env.TRUST_PROXY ?? (isProduction ? 1 : 0)),
  };
};
