import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const JWT_OPTIONS = {
  algorithm: "HS256",
  issuer: "codecrafter-api",
  audience: "codecrafter-web",
};

const BCRYPT_ROUNDS = 12;

// Compared against when the email doesn't exist, so a failed login
// takes the same time whether or not the account is registered.
const DUMMY_HASH = bcrypt.hashSync("codecrafter-timing-guard", BCRYPT_ROUNDS);

const createToken = (user) =>
  jwt.sign(
    {
      userId: user._id.toString(),
      tv: user.tokenVersion,
    },
    process.env.JWT_SECRET,
    {
      ...JWT_OPTIONS,
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );

export const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
});

/* =========================
   SIGN UP
========================= */

export const signUp = async (req, res) => {
  try {
    const name = req.body.name.trim();
    const email = req.body.email.toLowerCase().trim();
    const { password } = req.body;

    const existingUser = await User.exists({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists. Please sign in.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token: createToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists.",
      });
    }

    console.error("❌ Signup error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create account.",
    });
  }
};

/* =========================
   LOGIN
========================= */

export const login = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const { password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    const passwordMatched = await bcrypt.compare(
      password,
      typeof user?.password === "string" ? user.password : DUMMY_HASH
    );

    if (!user || !passwordMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token: createToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("❌ Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to login. Please try again.",
    });
  }
};

/* =========================
   LOGOUT
========================= */

// Revokes every token issued to this user so a stolen
// token can't be reused after signing out.
export const logOut = async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $inc: { tokenVersion: 1 } }
    );

    return res.status(200).json({
      success: true,
      message: "Logout successful.",
    });
  } catch (error) {
    console.error("❌ Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to logout.",
    });
  }
};
