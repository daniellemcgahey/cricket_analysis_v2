// src/language/LanguageContext.js
import React, { createContext, useContext, useState } from "react";
import en from "./locales/en.json";
import pt from "./locales/pt.json";
import es from "./locales/es.json";
import it from "./locales/it.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import hi from "./locales/hi.json";

const localeFiles = { en, pt, es, it, de, fr, hi };

// Map codes to display names for the UI
const languageNames = {
  en: "English",
  pt: "Português",
  es: "Español",
  it: "Italiano",
  de: "Deutsch",
  fr: "Français",
  hi: "हिंदी"
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("language") || "en";
  });

  const changeLanguage = (langCode) => {
    if (localeFiles[langCode]) {
      setLanguage(langCode);
      localStorage.setItem("language", langCode);
    }
  };

  const t = (key) => {
    if (!key) return "";
    const parts = key.split(".");
    let value = localeFiles[language];

    for (const part of parts) {
      if (value && Object.prototype.hasOwnProperty.call(value, part)) {
        value = value[part];
      } else {
        return key;
      }
    }
    return typeof value === "string" ? value : key;
  };

  return (
    <LanguageContext.Provider value={{
      language,
      changeLanguage,
      t,
      languageLabel: languageNames[language] // ✅ added label
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
