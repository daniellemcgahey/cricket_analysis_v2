import { useTheme } from "./ThemeContext";
import { useContext } from "react";
import DarkModeContext from "../DarkModeContext";

export default function useUITheme() {
  const theme = useTheme();
  const { isDarkMode } = useContext(DarkModeContext);

  return {
    isDark: isDarkMode,

    // TEXT
    text: {
      primary: isDarkMode ? "#ffffff" : "#000000",
      secondary: isDarkMode ? "#dcdcdc" : "#444444",
      muted: isDarkMode ? "#888888" : "#777777",
    },

    // BACKGROUND
    background: {
      base: isDarkMode ? "#111111" : "#ffffff",
      card: isDarkMode ? "rgba(255,255,255,0.05)" : "#f4f4f4",
      panel: isDarkMode ? "rgba(255,255,255,0.08)" : "#e8e8e8",
      transparent: isDarkMode ? "rgba(255,255,255,0)" : "#ffffff",
    },

    // BORDERS
    border: {
      subtle: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    },

    // TEAM ACCENTS (unchanged)
    primary: theme.primaryColor,
    accent: theme.accentColor,

    // CHART-SPECIFIC COLORS
    charts: {
      line: isDarkMode ? "#ffffff" : "#000000",
      ticks: isDarkMode ? "#ffffff" : "#000000",
      grid: "transparent",
    },
  };
}
