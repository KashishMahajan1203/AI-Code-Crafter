import React, { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import "./App.css";

import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import NoPage from "./pages/NoPage";
import {
  SESSION_EXPIRED_EVENT,
  apiRequest,
  clearSession,
  getToken,
} from "./lib/api";

const App = () => {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(() =>
    Boolean(getToken())
  );

  // Restore the session from a stored token.
  useEffect(() => {
    if (!getToken()) return;

    let active = true;

    apiRequest("/auth/me")
      .then((response) => {
        if (active && response?.user) {
          setUser(response.user);
        }
      })
      .catch((error) => {
        if (error.status === 401) {
          clearSession();
        } else {
          console.error("Could not restore session:", error);
        }
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Any 401 from the API (expired / revoked token) signs the user out.
  useEffect(() => {
    const handleExpired = () => {
      clearSession();
      setUser(null);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);

    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  const logout = useCallback(async () => {
    try {
      // Revokes the token on the server.
      await apiRequest("/auth/logout", { method: "POST" });
    } catch (error) {
      console.warn("Backend logout request failed:", error.message);
    } finally {
      clearSession();
      setUser(null);
    }
  }, []);

  const loadingScreen = (
    <main className="session-loading">
      <span className="stream-indicator" />
      Restoring your workspace...
    </main>
  );

  const protect = (element) =>
    checkingSession ? loadingScreen : user ? element : <Navigate to="/auth" replace />;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Landing user={user} />}
        />

        <Route
          path="/auth"
          element={
            checkingSession ? (
              loadingScreen
            ) : user ? (
              <Navigate to="/" replace />
            ) : (
              <AuthPage onAuthenticated={setUser} />
            )
          }
        />

        <Route
          path="/studio"
          element={protect(<Home user={user} onLogout={logout} />)}
        />

        <Route path="*" element={<NoPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
