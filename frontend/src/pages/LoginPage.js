// src/pages/LoginPage.js
import React, { useState } from "react";
import { Dropdown } from "react-bootstrap";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../language/LanguageContext";

const LoginPage = () => {
  const { login } = useAuth();
  const { language, changeLanguage, t, languageLabel } = useLanguage();

  // Local list just for the dropdown (match LanguageContext options)
  const languages = [
    { code: "en", label: "English" },
    { code: "pt", label: "Português" },
    { code: "es", label: "Español" },
    { code: "it", label: "Italiano" },
    { code: "de", label: "Deutsch" },
    { code: "fr", label: "Français" },
    { code: "hi", label: "हिंदी" },
  ];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      // When login() resolves, AppRoutes will show the main app with the correct theme & language
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(255,255,255,0.18) 0, transparent 55%), " +
          "radial-gradient(circle at bottom right, rgba(0,0,0,0.6) 0, transparent 55%), " +
          "#050608",
      }}
    >
      <div className="container" style={{ maxWidth: 420 }}>
        <div
          className="p-4 p-md-5 rounded-4 shadow"
          style={{
            backgroundColor: "rgba(15, 16, 20, 0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* 🌐 Language selector (top-right) */}
        <div className="d-flex justify-content-end mb-2">
          <Dropdown align="end">
            <Dropdown.Toggle
              variant="outline-light"
              size="sm"
              id="login-language-dropdown"
              style={{ fontSize: "0.75rem" }}
            >
              <span role="img" aria-hidden="true">
                🌐
              </span>{" "}
              {languageLabel || "Language"}
            </Dropdown.Toggle>

            <Dropdown.Menu className="dropdown-menu-dark bg-dark text-white border-secondary">
              {languages.map((lng) => (
                <Dropdown.Item
                  key={lng.code}
                  onClick={() => changeLanguage(lng.code)}
                  active={lng.code === language}
                  className="text-white"
                >
                  {lng.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </div>

          {/* Neutral identity */}
          <div className="mb-3">
            <div
              style={{
                fontSize: "0.8rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {t("login.appTitle") !== "login.appTitle"
                ? t("login.appTitle")
                : "Cricket Performance Hub"}
            </div>
            <h3 className="mb-1" style={{ fontWeight: 600, color: "#ffffff" }}>
              {t("login.signInHeading") !== "login.signInHeading"
                ? t("login.signInHeading")
                : "Sign in"}
            </h3>
            <p
              className="mb-3"
              style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}
            >
              {t("login.subtitle") !== "login.subtitle"
                ? t("login.subtitle")
                : "Use your team-issued account to access match data and analysis tools."}
            </p>
          </div>

          {error && (
            <div className="alert alert-danger py-2" style={{ fontSize: "0.85rem" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="d-grid gap-3">
            <div>
              <label className="form-label small text-uppercase">
                {t("login.emailLabel") !== "login.emailLabel"
                  ? t("login.emailLabel")
                  : "Email"}
              </label>
              <input
                type="email"
                className="form-control form-control-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="form-label small text-uppercase">
                {t("login.passwordLabel") !== "login.passwordLabel"
                  ? t("login.passwordLabel")
                  : "Password"}
              </label>
              <input
                type="password"
                className="form-control form-control-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 mt-2"
              disabled={busy}
            >
              {busy
                ? t("login.signingInButton") !== "login.signingInButton"
                  ? t("login.signingInButton")
                  : "Signing in..."
                : t("login.signInButton") !== "login.signInButton"
                ? t("login.signInButton")
                : "Sign in"}
            </button>
          </form>

          <p
            className="mt-3 mb-0 text-center"
            style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}
          >
            {t("login.restrictedNote") !== "login.restrictedNote"
              ? t("login.restrictedNote")
              : "Access is restricted to team staff. Contact your board if you need an account."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
