import React from "react";

export default function CoachPackHeaderRB({ ms = {}, isDarkMode }) {
  const boxClass = `p-3 rounded ${isDarkMode ? "bg-secondary text-white" : "bg-white text-dark border"}`;
  return (
    <div className={boxClass}>
      <div className="d-flex justify-content-between align-items-center">
        <div className="h5 mb-0 fw-bold">{ms.team_a} vs {ms.team_b}</div>
        <div className="text-muted">{ms.match_date}</div>
      </div>
      <div className="d-flex justify-content-between mt-1">
        <div>Toss: {ms.toss_winner} ({ms.toss_decision})</div>
        <div className="fw-semibold">Result: {ms.result}</div>
      </div>
    </div>
  );
}
