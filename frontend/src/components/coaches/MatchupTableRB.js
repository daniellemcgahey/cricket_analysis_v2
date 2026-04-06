import React from "react";

export default function MatchupTableRB({ title, rows = [], isDarkMode }) {
  return (
    <div className={`rounded p-3 shadow-sm ${isDarkMode ? "bg-dark text-white border" : "bg-white text-dark border"}`}>
      <div className="h6 mb-2 fw-bold">{title}</div>
      <table className="table table-striped table-bordered table-sm mb-0">
        <thead>
          <tr>
            <th>Batter</th>
            <th>Bowler</th>
            <th className="text-end">Balls</th>
            <th className="text-end">RPB</th>
            <th className="text-end">Dot%</th>
            <th className="text-end">Dismiss%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>#{r.batter_id}</td>
              <td>#{r.bowler_id}</td>
              <td className="text-end">{r.legal_balls}</td>
              <td className="text-end">{Number(r.rpb).toFixed(2)}</td>
              <td className="text-end">{Number(r.dot_pct).toFixed(1)}</td>
              <td className="text-end">{Number(r.dismissal_pct).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
