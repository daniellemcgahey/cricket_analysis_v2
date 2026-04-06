// src/App.js
import React, { useContext } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";

import { DarkModeProvider } from "./DarkModeContext";
import DarkModeContext from "./DarkModeContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { LanguageProvider } from "./language/LanguageContext";
import { AuthProvider, useAuth } from "./auth/AuthContext";

import AppShell from "./layout/AppShell";
import HomeDashboard from "./pages/HomeDashboard";
import CoachesHub from "./pages/CoachesHub";
import LoginPage from "./pages/LoginPage";
import FixturesPage from "./pages/FixturesPage";

import PreGame from "./pages/PreGame";
import PostGame from "./pages/PostGame";
import PostTournament from "./pages/PostTournament";
import Training from "./pages/Training";

import SettingsPage from "./pages/SettingsPage";
import KPIPage from "./pages/KPIPage";

import MatchAnalysisPage from "./pages/MatchAnalysisPage";

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();
  const { isDarkMode, setDarkMode } = useContext(DarkModeContext);

  // 🔒 Login page forced dark mode
  if (!isAuthenticated) {
    if (!isDarkMode) setDarkMode(true);
    return <LoginPage />;
  }

  // Once authenticated, show the full app inside BrowserRouter
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomeDashboard />} />
          
          {/* Coaches Hub routes */}
          <Route path="/coaches" element={<CoachesHub />} />
          <Route path="/coaches/pre-game" element={<PreGame />} />
          <Route path="/coaches/post-game" element={<PostGame />} />
          <Route path="/coaches/post-tournament" element={<PostTournament />} />
          <Route path="/coaches/training" element={<Training />} />

          <Route path="/match-analysis" element={<MatchAnalysisPage />} />

          {/* Settings */}
          <Route path="/fixtures" element={<FixturesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/kpis" element={<KPIPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <DarkModeProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </DarkModeProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
