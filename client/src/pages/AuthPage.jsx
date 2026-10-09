import React, { useState } from "react";
import {
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiUser,
} from "react-icons/fi";
import Brand from "../components/Brand";
import { apiRequest, saveSession } from "../lib/api";
import "../Auth.css";

const AuthPage = ({ onAuthenticated }) => {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  async function handleSubmit(event) {
    event.preventDefault();

    if (
      isSignup &&
      (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    ) {
      setError("Password must contain at least one letter and one number.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const body = {
        email: email.trim(),
        password,
      };

      if (isSignup) {
        body.name = name.trim();
      }

      const response = await apiRequest(
        `/auth/${mode}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      if (!response?.token) {
        throw new Error(
          "Authentication token was not received from the server."
        );
      }

      saveSession(response.token, response.user);

      // App redirects to the home page once the user is set.
      onAuthenticated?.(response.user);
    } catch (requestError) {
      console.error(
        "❌ Authentication error:",
        requestError
      );

      setError(
        requestError?.message ||
          "Unable to complete authentication."
      );
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setShowPassword(false);
    setError("");
  }

  return (
    <div className="auth-screen">
      <header className="auth-topbar">
        <Brand />

        <span className="auth-topbar-note">
          <span className="status-dot" />
          PRIVATE WORKSPACE
        </span>
      </header>

      <main className="auth-layout">
        <section className="auth-intro">
          <div className="section-kicker">
            <span className="kicker-mark" />
            YOUR WORKSPACE
          </div>

          <h1>
            Good ideas
            <br />
            <span>start here.</span>
          </h1>

          <p>
            Sign in to generate components and keep
            your projects together.
          </p>

          <div className="auth-intro-rule">
            <span />
            HTML
            <span />
            CSS
            <span />
            JS
          </div>
        </section>

        <section
          className="auth-card"
          aria-labelledby="auth-title"
        >
          <div
            className="auth-mode-switch"
            role="tablist"
            aria-label="Account access"
          >
            <button
              className={
                mode === "login"
                  ? "is-active"
                  : ""
              }
              onClick={() =>
                changeMode("login")
              }
              role="tab"
              aria-selected={
                mode === "login"
              }
              type="button"
            >
              Sign in
            </button>

            <button
              className={
                mode === "signup"
                  ? "is-active"
                  : ""
              }
              onClick={() =>
                changeMode("signup")
              }
              role="tab"
              aria-selected={
                mode === "signup"
              }
              type="button"
            >
              Create account
            </button>
          </div>

          <div className="auth-card-heading">
            <span className="auth-card-kicker">
              {isSignup
                ? "NEW ACCOUNT"
                : "WELCOME BACK"}
            </span>

            <h2 id="auth-title">
              {isSignup
                ? "Create your account"
                : "Sign in to CodeCrafter"}
            </h2>

            <p>
              {isSignup
                ? "Your saved projects will be linked to this account."
                : "Your workspace is ready when you are."}
            </p>
          </div>

          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >
            {isSignup && (
              <label className="auth-field">
                <span>Name</span>

                <span className="auth-input-wrap">
                  <FiUser aria-hidden="true" />

                  <input
                    autoComplete="name"
                    maxLength={80}
                    minLength={2}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    placeholder="Your name"
                    required
                    value={name}
                  />
                </span>
              </label>
            )}

            <label className="auth-field">
              <span>Email</span>

              <span className="auth-input-wrap">
                <FiMail aria-hidden="true" />

                <input
                  autoComplete="email"
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </span>
            </label>

            <div className="auth-field">
              <label htmlFor="auth-password">
                Password
              </label>

              <span className="auth-input-wrap">
                <FiLock aria-hidden="true" />

                <input
                  id="auth-password"
                  autoComplete={
                    isSignup
                      ? "new-password"
                      : "current-password"
                  }
                  maxLength={72}
                  minLength={
                    isSignup
                      ? 8
                      : undefined
                  }
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder={
                    isSignup
                      ? "8+ characters, letters & numbers"
                      : "Enter your password"
                  }
                  required
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                />

                <button
                  className="password-visibility"
                  onClick={() =>
                    setShowPassword(
                      (visible) =>
                        !visible
                    )
                  }
                  type="button"
                  title={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  aria-pressed={
                    showPassword
                  }
                >
                  {showPassword ? (
                    <FiEyeOff />
                  ) : (
                    <FiEye />
                  )}
                </button>
              </span>
            </div>

            {error && (
              <p
                className="auth-error"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              className="auth-submit"
              disabled={busy}
              type="submit"
            >
              {busy
                ? "Connecting..."
                : isSignup
                ? "Create account"
                : "Sign in"}

              {!busy && (
                <span aria-hidden="true">
                  →
                </span>
              )}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default AuthPage;