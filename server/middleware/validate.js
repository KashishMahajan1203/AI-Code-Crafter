import mongoose from "mongoose";
import { FRAMEWORKS } from "../prompts/templates.js";

/*
  Small, dependency-free validation helpers.
  Every field is type-checked, so objects such as { "$gt": "" }
  can never reach a MongoDB query (NoSQL injection).
*/

export const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
  passwordMin: 8,
  // bcrypt only uses the first 72 bytes of a password.
  passwordMaxBytes: 72,
  promptMax: 4000,
  projectNameMax: 120,
  frameworkMax: 80,
  filesMax: 60,
  filePathMax: 200,
  fileContentMax: 200_000,
  packageListMax: 60,
  packageNameMax: 120,
  previewHtmlMax: 500_000,
  codeMax: 500_000,
};

export const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

export const badRequest = (res, message, details) =>
  res.status(400).json({
    success: false,
    message,
    ...(details ? { errors: details } : {}),
  });

// Rejects any request whose body is not a plain JSON object.
export const requireJsonBody = (req, res, next) => {
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return badRequest(res, "Request body must be a JSON object.");
  }

  return next();
};

export const validateObjectIdParam = (name) => (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params[name])) {
    return badRequest(res, "Invalid id.");
  }

  return next();
};

export const validateSignUp = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = {};

  if (!isNonEmptyString(name)) {
    errors.name = "Name is required.";
  } else if (
    name.trim().length < LIMITS.nameMin ||
    name.trim().length > LIMITS.nameMax
  ) {
    errors.name = `Name must be ${LIMITS.nameMin}-${LIMITS.nameMax} characters.`;
  }

  if (!isNonEmptyString(email)) {
    errors.email = "Email is required.";
  } else if (
    email.trim().length > LIMITS.emailMax ||
    !EMAIL_PATTERN.test(email.trim())
  ) {
    errors.email = "Enter a valid email address.";
  }

  if (typeof password !== "string" || password.length === 0) {
    errors.password = "Password is required.";
  } else if (password.length < LIMITS.passwordMin) {
    errors.password = `Password must be at least ${LIMITS.passwordMin} characters.`;
  } else if (Buffer.byteLength(password, "utf8") > LIMITS.passwordMaxBytes) {
    errors.password = "Password is too long (max 72 bytes).";
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = "Password must contain at least one letter and one number.";
  }

  if (Object.keys(errors).length > 0) {
    return badRequest(res, Object.values(errors)[0], errors);
  }

  return next();
};

export const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!isNonEmptyString(email) || typeof password !== "string" || !password) {
    return badRequest(res, "Email and password are required.");
  }

  if (
    email.length > LIMITS.emailMax ||
    Buffer.byteLength(password, "utf8") > LIMITS.passwordMaxBytes
  ) {
    return badRequest(res, "Invalid email or password.");
  }

  return next();
};

export const validateGeneration = (req, res, next) => {
  const { prompt, framework } = req.body;

  if (!isNonEmptyString(prompt)) {
    return badRequest(res, "Prompt is required.");
  }

  if (prompt.length > LIMITS.promptMax) {
    return badRequest(res, `Prompt must be at most ${LIMITS.promptMax} characters.`);
  }

  if (typeof framework !== "string" || !Object.hasOwn(FRAMEWORKS, framework)) {
    return badRequest(res, `framework must be one of: ${Object.keys(FRAMEWORKS).join(", ")}.`);
  }

  return next();
};

const isStringList = (value, maxItems, maxLength) =>
  Array.isArray(value) &&
  value.length <= maxItems &&
  value.every((item) => typeof item === "string" && item.length <= maxLength);

export const validateProject = (req, res, next) => {
  const {
    projectName,
    projectType = "react",
    framework,
    prompt,
    code,
    files = [],
    dependencies = [],
    devDependencies = [],
    setupCommands = [],
    previewHtml = "",
  } = req.body;

  if (!isNonEmptyString(projectName) || projectName.length > LIMITS.projectNameMax) {
    return badRequest(res, `Project name is required (max ${LIMITS.projectNameMax} characters).`);
  }

  if (!isNonEmptyString(prompt) || prompt.length > LIMITS.promptMax) {
    return badRequest(res, `Prompt is required (max ${LIMITS.promptMax} characters).`);
  }

  if (!["react", "html"].includes(projectType)) {
    return badRequest(res, "projectType must be 'react' or 'html'.");
  }

  if (
    framework !== undefined &&
    (typeof framework !== "string" || framework.length > LIMITS.frameworkMax)
  ) {
    return badRequest(res, "Invalid framework.");
  }

  if (
    code !== undefined &&
    (typeof code !== "string" || code.length > LIMITS.codeMax)
  ) {
    return badRequest(res, "Generated code is too large.");
  }

  if (
    !Array.isArray(files) ||
    files.length > LIMITS.filesMax ||
    !files.every(
      (file) =>
        file &&
        typeof file.path === "string" &&
        file.path.length > 0 &&
        file.path.length <= LIMITS.filePathMax &&
        !file.path.includes("..") &&
        typeof file.content === "string" &&
        file.content.length <= LIMITS.fileContentMax
    )
  ) {
    return badRequest(res, "Invalid or oversized project files.");
  }

  for (const [field, list] of Object.entries({
    dependencies,
    devDependencies,
    setupCommands,
  })) {
    if (!isStringList(list, LIMITS.packageListMax, LIMITS.packageNameMax)) {
      return badRequest(res, `Invalid ${field}.`);
    }
  }

  if (typeof previewHtml !== "string" || previewHtml.length > LIMITS.previewHtmlMax) {
    return badRequest(res, "Preview HTML is too large.");
  }

  if (projectType === "html" && !isNonEmptyString(code)) {
    return badRequest(res, "HTML projects must include code.");
  }

  if (projectType === "react" && files.length === 0) {
    return badRequest(res, "React projects must include files.");
  }

  return next();
};
