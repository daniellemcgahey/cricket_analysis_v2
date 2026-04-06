// src/DarkModeContext.js
import React, { createContext, useState, useEffect } from "react";

const DarkModeContext = createContext({
  isDarkMode: true,
  toggleDarkMode: () => {},
  setDarkMode: () => {},
});

export const DarkModeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem("darkMode");
      return stored !== null ? JSON.parse(stored) : true; // default dark
    } catch {
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));

    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      document.body.classList.remove("light-mode");
    } else {
      document.body.classList.add("light-mode");
      document.body.classList.remove("dark-mode");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);
  const setDarkMode = (value) => setIsDarkMode(!!value);

  return (
    <DarkModeContext.Provider
      value={{ isDarkMode, toggleDarkMode, setDarkMode }}
    >
      {children}
    </DarkModeContext.Provider>
  );
};

export default DarkModeContext;
