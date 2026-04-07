// src/layout/AppShell.js
import React, { useContext, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import DarkModeContext from "../DarkModeContext";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../language/LanguageContext";

const AppShell = () => {
  const theme = useTheme();
  const { isDarkMode, toggleDarkMode } = useContext(DarkModeContext);
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const { t } = useLanguage();

  // Tiny helper: translation with fallback
  const tt = (key, fallback) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const headerStyle = {
    position: "sticky",
    top: 0,
    zIndex: 2000, // keep header above page content
    background:
      "linear-gradient(to right, rgba(0,0,0,0.85), rgba(0,0,0,0.55))",
    borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
    backdropFilter: "blur(10px)",
  };

  const initials =
    user?.name?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "?";

  const handleSignOut = () => {
    setMenuOpen(false);
    logout();
  };

  const roleLabel =
    user?.role === "admin"
      ? tt("appShell.roleAdmin", "Admin")
      : tt("appShell.roleUser", "User");

  const darkLabel = tt("darkMode.dark", "Dark");
  const lightLabel = tt("darkMode.light", "Light");

  return (
    <div
      className="min-vh-100 d-flex flex-column"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Top bar */}
      <header style={headerStyle}>
        <div className="container d-flex align-items-center justify-content-between py-2">
          {/* Left: logo + team name */}
          <Link to="/" className="text-decoration-none">
            <div className="d-flex align-items-center gap-2">
              {/* Accent logo/marker */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 30% 30%, ${theme.accentColor}, ${theme.primaryColor})`,
                  boxShadow: "0 0 10px rgba(0,0,0,0.6)",
                }}
              />
              <div className="d-flex flex-column">
                <span
                  style={{
                    fontSize: "1.0rem",
                    letterSpacing: "0.06em",
                    color: "#ffffff",
                  }}
                >
                  {/* small brand line – reuses login.appTitle if translated */}
                  {tt("login.appTitle", "Performance Hub")}
                </span>

              </div>
            </div>
          </Link>

          {/* Right: nav + controls */}
          <div className="d-flex align-items-center gap-3 position-relative">
            {/* Primary nav (desktop) */}
            <nav className="d-none d-md-flex gap-3">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  "text-decoration-none small " +
                  (isActive ? "fw-bold" : "") +
                  " text-light"
                }
              >
                {tt("appShell.navDashboard", "Dashboard")}
              </NavLink>
              <NavLink
                to="/match-analysis"
                className={({ isActive }) =>
                  "text-decoration-none small " +
                  (isActive ? "fw-bold" : "") +
                  " text-light"
                }
              >
                {tt("appShell.navMatchAnalysis", "Match Analysis")}
              </NavLink>
              <NavLink
                to="/coaches"
                className={({ isActive }) =>
                  "text-decoration-none small " +
                  (isActive ? "fw-bold" : "") +
                  " text-light"
                }
              >
                {tt("appShell.navCoachesHub", "Coaches Hub")}
              </NavLink>
              <NavLink
                to="/tournaments"
                className={({ isActive }) =>
                  "text-decoration-none small " +
                  (isActive ? "fw-bold" : "") +
                  " text-light"
                }
              >
                {tt("appShell.navTournaments", "Tournaments")}
              </NavLink>
            </nav>

            {/* Dark mode toggle */}
            <button
              type="button"
              className="btn btn-sm btn-outline-light align-items-center gap-1"
              onClick={toggleDarkMode}
            >
              <span style={{ fontSize: "0.8rem" }}>
                {isDarkMode ? lightLabel : darkLabel}
              </span>
            </button>

            {/* User bubble + dropdown */}
            <div className="position-relative">
              <div
                className="d-flex align-items-center justify-content-center rounded-circle"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: "var(--color-accent)",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  boxShadow: "0 0 10px rgba(0,0,0,0.7)",
                }}
                onClick={() => setMenuOpen((prev) => !prev)}
                title={user?.email || "User"}
              >
                {initials}
              </div>

              {menuOpen && (
                <div
                  className="position-absolute mt-2 end-0"
                  style={{
                    minWidth: 220,
                    backgroundColor: isDarkMode ? "#111319" : "#ffffff",
                    color: isDarkMode ? "#ffffff" : "#000000",
                    borderRadius: 12,
                    border: isDarkMode
                      ? "1px solid rgba(255,255,255,0.15)"
                      : "1px solid rgba(0,0,0,0.12)",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.6)",
                    zIndex: 3000, // above everything else
                  }}
                >
                  {/* User info */}
                  <div className="px-3 pt-3 pb-2 border-bottom border-secondary-subtle">
                    <div
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      {user?.name || user?.email || "User"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        opacity: 0.8,
                      }}
                    >
                      {roleLabel}
                    </div>
                  </div>

                  {/* Fixtures admin (only for admins) */}
                  {user?.role === "admin" && (
                    <button
                      type="button"
                      className="w-100 text-start px-3 py-2 border-0 bg-transparent"
                      style={{
                        fontSize: "0.85rem",
                        color: isDarkMode ? "#ffffff" : "#000000",
                        outline: "none",
                      }}
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/fixtures");
                      }}
                    >
                      {tt(
                        "appShell.fixturesAdmin",
                        "Fixtures & calendar (admin)"
                      )}
                    </button>
                  )}

                  {/* Theme & branding */}
                  <button
                    type="button"
                    className="w-100 text-start px-3 py-2 border-0 bg-transparent"
                    style={{
                      fontSize: "0.85rem",
                      color: isDarkMode ? "#ffffff" : "#000000",
                      outline: "none",
                      
                    }}
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/settings");
                    }}
                  >
                    {tt("appShell.settings", "Settings")}
                  </button>

                  <button
                    type="button"
                    className="w-100 text-start px-3 py-2 border-0 bg-transparent"
                    style={{
                      fontSize: "0.85rem",
                      color: isDarkMode ? "#ffffff" : "#000000",
                      outline: "none",
                      
                    }}
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/kpis");
                    }}
                  >
                    {tt("appShell.kpi", "Key Performance Indicators")}
                  </button>

                  {/* Sign out */}
                  <button
                    type="button"
                    className="w-100 text-start px-3 py-2 border-0 bg-transparent text-danger"
                    style={{
                      fontSize: "0.85rem",
                      borderTop: isDarkMode
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "1px solid rgba(0,0,0,0.06)",
                    }}
                    onClick={handleSignOut}
                  >
                    {tt("appShell.signOut", "Sign out")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-grow-1">
        <div className="container py-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppShell;
