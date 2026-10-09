import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const limitMessage = (message) => ({
  success: false,
  message,
});

// Applies to every /api route.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: limitMessage("Too many requests. Please slow down and try again shortly."),
});

// Only wrong credentials (401) and "email already registered" (409) count
// as failures. Typos caught by validation (400) don't lock anyone out.
const isAuthFailure = (_req, res) => ![401, 409].includes(res.statusCode);

const authEmailKey = (req) => {
  const email = typeof req.body?.email === "string"
    ? req.body.email.toLowerCase().trim()
    : "";

  return `${ipKeyGenerator(req.ip)}:${email}`;
};

// Brute-force protection for a single account. Keyed by IP + email, so
// users sharing an IP (office/college Wi-Fi) don't block each other.
const authAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: isAuthFailure,
  keyGenerator: authEmailKey,
  message: limitMessage("Too many sign-in attempts. Please wait 15 minutes and try again."),
});

// Looser per-IP cap against trying one password across many accounts.
const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: false,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: isAuthFailure,
  message: limitMessage("Too many sign-in attempts from this network. Please wait 15 minutes and try again."),
});

export const authLimiter = [authIpLimiter, authAccountLimiter];

// AI calls cost money, so they are limited per user (falls back to IP).
export const generationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: limitMessage("Hourly generation limit reached. Please try again later."),
});
