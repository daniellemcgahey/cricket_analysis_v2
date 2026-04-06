// src/components/SectionGrid.js
import React from "react";

const SectionGrid = ({ children }) => {
  return (
    <div
      style={{
        display: "grid",
        gap: "18px",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        marginTop: "20px",
      }}
    >
      {children}
    </div>
  );
};

export default SectionGrid;
