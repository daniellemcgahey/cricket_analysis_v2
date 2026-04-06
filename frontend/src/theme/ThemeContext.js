// src/theme/ThemeContext.js
import React, { createContext, useContext, useEffect, useState } from "react";

// --- Theme definitions ---
// Keys: "neutral", "brasil", "mexico", "scotland"
// Add more by extending this object.

const themes = {
  neutral: {
    key: "neutral",
    teamName: "Cricket Performance Hub",
    primaryColor: "#3A3A3A",
    accentColor: "#CCCCCC",
    backgroundColor: "#050608",
    surfaceColor: "#15171A",
    textPrimary: "#FFFFFF",
    textSecondary: "#B0B0B0",
    flagUrl: "",
  },
  brasil_women: {
    key: "brasil_women",
    teamName: "Brasil Women",
    primaryColor: "#009739", // green
    accentColor: "#F7C600",  // yellow
    backgroundColor: "#050608",
    surfaceColor: "#15171A",
    textPrimary: "#FFFFFF",
    textSecondary: "#B0B0B0",
    flagUrl: "https://flagcdn.com/w320/br.png",
  },
  brasil_men: {
    key: "brasil_men",
    teamName: "Brasil Men",
    primaryColor: "#009739", // green
    accentColor: "#F7C600",  // yellow
    backgroundColor: "#050608",
    surfaceColor: "#15171A",
    textPrimary: "#FFFFFF",
    textSecondary: "#B0B0B0",
    flagUrl: "https://flagcdn.com/w320/br.png",
  },
  mexico_men: {
    key: "mexico_men",
    teamName: "Mexico Men",
    primaryColor: "#006847", // green
    accentColor: "#CE1126",  // red
    backgroundColor: "#050608",
    surfaceColor: "#15171A",
    textPrimary: "#FFFFFF",
    textSecondary: "#B0B0B0",
    flagUrl: "https://flagcdn.com/w320/mx.png",
  },
  scotland_men: {
    key: "scotland_men",
    teamName: "Scotland Men",
    primaryColor: "#00247D", // navy blue
    accentColor: "#00A2E8",  // lighter blue accent
    backgroundColor: "#050608",
    surfaceColor: "#15171A",
    textPrimary: "#FFFFFF",
    textSecondary: "#B0B0B0",
    flagUrl: "https://flagcdn.com/w320/gb-sct.png",
  },
  argentina_u19w: {
    key: "argentina_u19w",
    teamName: "Argentina U19 Women",
    primaryColor: "#00247D",         // deep blue
    accentColor: "#00A2E8",          // light blue accent
    backgroundColor: "#050608",
    surfaceColor: "#15171A",
    textPrimary: "#FFFFFF",
    textSecondary: "#B0B0B0",
    flagUrl: "https://flagcdn.com/w320/ar.png", // Argentina flag
  },
};

const ThemeContext = createContext({
  theme: themes.neutral,
  themeKey: "neutral",
  setThemeKey: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [themeKey, setThemeKey] = useState("neutral");

  const theme = themes[themeKey] || themes.neutral;

  // Push theme values into CSS variables whenever the theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-primary", theme.primaryColor);
    root.style.setProperty("--color-accent", theme.accentColor);
    root.style.setProperty("--color-bg-dark", theme.backgroundColor);
    root.style.setProperty("--color-surface-dark", theme.surfaceColor);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, themeKey, setThemeKey }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to get just the current theme object
export const useTheme = () => {
  const { theme } = useContext(ThemeContext);
  return theme;
};

// Hook to control theme (used by AuthContext)
export const useThemeController = () => useContext(ThemeContext);
