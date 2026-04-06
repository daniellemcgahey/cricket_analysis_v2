// src/auth/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { useThemeController } from "../theme/ThemeContext";

const AuthContext = createContext(null);

/**
 * DEMO USERS (local-only, no real backend yet)
 *
 * Adjust the countryId values so they match your `countries` table:
 *   - Brasil Women         -> e.g. country_id = 1
 *   - Mexico Men           -> e.g. country_id = 42
 *   - Argentina U19 Women  -> e.g. country_id = 57
 *
 * countryKey is used ONLY for theming.
 * teamCategory is what you use everywhere in the backend ("Women", "Men", "U19 Women", etc.).
 */
const DEMO_USERS = {
  // Brasil Women – main profile
  "brasil@demo.com": {
    email: "brasil@demo.com",
    name: "Brasil Women Coach",
    role: "admin",            // 'admin' or 'coach'
    countryId: 1,   
    teamCategory: "Women",
    countryKey: "brasil_women",   
  },
    "brasilmen@demo.com": {
    email: "brasilmen@demo.com",
    name: "Brasil Men Coach",
    role: "admin",            // 'admin' or 'coach'
    countryId: 22,   
    teamCategory: "Men",
    countryKey: "brasil_men",   
  },

  // Mexico Men – dummy men’s profile
  "mexico@demo.com": {
    email: "mexico@demo.com",
    name: "Mexico Men Coach",
    role: "admin",
    countryId: 24, 
    teamCategory: "Men",
    countryKey: "mexico_men",
  },

  // Scotland Men
    "scotland@demo.com": {
    email: "scotland@demo.com",
    name: "Scotland Men Coach",
    role: "admin",
    countryId: 0,     
    teamCategory: "Men",
    countryKey: "scotland_men",
  },

  // Argentina U19 Women – dummy junior profile
  "argu19@demo.com": {
    email: "argu19@demo.com",
    name: "Argentina U19 Women Coach",
    role: "admin",
    countryId: 28, 
    teamCategory: "U19 Women",
    countryKey: "argentina_u19w",
  },
};

/**
 * Basic shape guard – helps avoid weird corrupted localStorage state.
 */
const isValidUserShape = (obj) => {
  if (!obj || typeof obj !== "object") return false;
  if (typeof obj.email !== "string") return false;
  if (typeof obj.name !== "string") return false;
  if (typeof obj.role !== "string") return false;
  if (typeof obj.countryId !== "number") return false;
  if (typeof obj.teamCategory !== "string") return false;
  if (typeof obj.countryKey !== "string") return false;
  return true;
};

export const AuthProvider = ({ children }) => {
  const { setThemeKey } = useThemeController();

  // Initialise from localStorage but *validate* against DEMO_USERS and shape
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("authUser");
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!isValidUserShape(parsed)) {
        localStorage.removeItem("authUser");
        return null;
      }

      const lowerEmail = parsed.email.toLowerCase();
      const demoUser = DEMO_USERS[lowerEmail];

      // If stored user no longer matches a known demo account, log them out
      if (!demoUser) {
        localStorage.removeItem("authUser");
        return null;
      }

      return demoUser;
    } catch {
      localStorage.removeItem("authUser");
      return null;
    }
  });

  // Keep theme in sync with current user
  useEffect(() => {
    if (user?.countryKey) {
      setThemeKey(user.countryKey);
    } else {
      setThemeKey("neutral");
    }
  }, [user, setThemeKey]);

  /**
   * Local-only authentication:
   *  - Matches email against DEMO_USERS
   *  - Optionally enforce a simple password rule (for now we just check non-empty)
   *  - In production this would call your real backend.
   */
  const login = async (email, password) => {
    const trimmedEmail = (email || "").trim().toLowerCase();
    const trimmedPassword = (password || "").trim();

    if (!trimmedEmail || !trimmedPassword) {
      throw new Error("Please enter both email and password.");
    }

    const demoUser = DEMO_USERS[trimmedEmail];
    if (!demoUser) {
      // Hardened behaviour: do NOT auto-create accounts or guess country from email
      throw new Error("Invalid credentials.");
    }

    // If you want a simple dev-only password rule, uncomment this:
    // if (trimmedPassword !== "demo") {
    //   throw new Error("Invalid credentials.");
    // }

    setUser(demoUser);
    localStorage.setItem("authUser", JSON.stringify(demoUser));
    // Theme sync is handled by useEffect
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("authUser");
    setThemeKey("neutral");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: !!user && user.role === "admin",
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
