// src/components/GlassCard.js
import React from "react";
import { useTheme } from "../theme/ThemeContext";

const GlassCard = ({
  children,
  onClick,
  active = false,      // ✅ new prop
  style = {},
  className = "",
}) => {
  const theme = useTheme();

  const baseBorder = active
    ? `1px solid ${theme.accentColor}`      // ✅ active outline
    : `1px solid ${theme.primaryColor}22`;

  const baseShadow = active
    ? `0 6px 18px ${theme.accentColor}33`
    : "none";

  return (
    <div
      onClick={onClick}
      className={`glass-card ${className}`}
      style={{
        borderRadius: "14px",
        padding: "18px 20px",
        background: `linear-gradient(135deg, ${theme.primaryColor}08, rgba(255,255,255,0.03))`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: baseBorder,
        cursor: onClick ? "pointer" : "default",
        boxShadow: baseShadow,
        transition:
          "transform 0.15s ease, box-shadow 0.2s ease, border 0.15s ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.01)";
        e.currentTarget.style.boxShadow = `0 6px 18px ${theme.primaryColor}33`;

        // 👇 only override border on hover if NOT active
        if (!active) {
          e.currentTarget.style.border = `1px solid ${theme.accentColor}55`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1.0)";
        e.currentTarget.style.boxShadow = baseShadow;
        e.currentTarget.style.border = baseBorder; // 👈 restore active border if needed
      }}
    >
      {children}
    </div>
  );
};

export default GlassCard;
