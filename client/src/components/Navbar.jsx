import React, { useState } from "react";
import { LuLoaderCircle, LuLogOut } from "react-icons/lu";
import Brand from "./Brand";

const initialsOf = (user) =>
  (user?.name || user?.email || "U")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const Navbar = ({ user, onLogout }) => {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut || typeof onLogout !== "function") return;

    setLoggingOut(true);

    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="topbar">
      <Brand tagline="AI workspace" />

      <div className="topbar-actions">
        <div className="topbar-meta" title="Generation service online">
          <span className="status-dot" aria-hidden="true" />
          <span>AI ready</span>
        </div>

        <div className="account-control">
          <span className="account-avatar" aria-hidden="true">
            {initialsOf(user)}
          </span>

          <span className="account-name" title={user?.email || ""}>
            {user?.name || user?.email || "User"}
          </span>

          <button
            className="logout-button"
            onClick={handleLogout}
            title="Sign out"
            aria-label={loggingOut ? "Signing out" : "Sign out"}
            type="button"
            disabled={loggingOut}
          >
            {loggingOut ? <LuLoaderCircle className="spin" /> : <LuLogOut />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
