import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function IntentBandChartRB({ title, rows = [], isDarkMode }) {
  const order = { "0-2":0, "2-4":1, "4-6":2, "6-8":3, "8-10":4 };
  const data = [...rows]
    .sort((a,b)=> (order[a.band]||0) - (order[b.band]||0))
    .map(r => ({ band: r.band, SR: r.sr, Dismiss: r.dismissal_pct }));

  return (
    <div className={`rounded p-3 shadow-sm ${isDarkMode ? "bg-dark text-white border" : "bg-white text-dark border"}`}>
      <div className="h6 mb-2 fw-bold">{title}</div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="band" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Line yAxisId="left" type="monotone" dataKey="SR" dot />
          <Line yAxisId="right" type="monotone" dataKey="Dismiss" dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
