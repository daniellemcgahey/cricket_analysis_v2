// src/pages/SettingsPage.js
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../language/LanguageContext";


/**
 * Settings page:
 * - Change language (stored via LanguageContext + localStorage)
 * - Change theme (via ThemeContext)
 */
export default function SettingsPage() {
  const navigate = useNavigate();
  const { language, changeLanguage, t } = useLanguage();


  // Human-readable language names for the dropdown
  const languageOptions = [
    { code: "en", label: "English" },
    { code: "pt", label: "Português" },
    { code: "es", label: "Español" },
    { code: "it", label: "Italiano" },
    { code: "de", label: "Deutsch" },
    { code: "fr", label: "Français" },
    { code: "hi", label: "हिंदी" },
  ];


  const handleSave = () => {
    // At the moment, language + theme changes are applied immediately
    // via their contexts, so "Save" just navigates back.
    navigate(-1);
  };

  return (
    <div className="container py-4">
      <h2 className="mb-4">{t("settings")}</h2>

      <form>
        {/* LANGUAGE */}
        <div className="mb-3">
          <label className="form-label">{t("language")}</label>
          <select
            className="form-select"
            value={language}
            onChange={(e) => changeLanguage(e.target.value)}
          >
            {languageOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* UNITS (placeholder) */}
        <div className="mb-3">
          <label className="form-label">{t("units")}</label>
          <select className="form-select" disabled>
            <option value="metric">Metric</option>
            <option value="imperial">Imperial</option>
          </select>
          <div className="form-text">Coming soon</div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
        >
          {t("save")}
        </button>
      </form>
    </div>
  );
}
