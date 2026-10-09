import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { JWT_OPTIONS } from "../controllers/auth.controller.js";

const unauthorized = (res, message) =>
  res.status(401).json({
    success: false,
    message,
  });

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return unauthorized(res, "Authentication required.");
  }

  const token = authHeader.slice("Bearer ".length).trim();

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [JWT_OPTIONS.algorithm],
      issuer: JWT_OPTIONS.issuer,
      audience: JWT_OPTIONS.audience,
    });
  } catch {
    return unauthorized(res, "Invalid or expired authentication token.");
  }

  try {
    const user = await User.findById(decoded.userId);

    if (!user) {
      return unauthorized(res, "User no longer exists.");
    }

    // Token was issued before the last logout.
    if (decoded.tv !== user.tokenVersion) {
      return unauthorized(res, "Session has ended. Please sign in again.");
    }

    req.user = user;

    return next();
  } catch (error) {
    return next(error);
  }
};

export default authMiddleware;
