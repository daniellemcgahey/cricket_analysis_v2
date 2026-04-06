/**
 * Match Pressure Page
 *
 * Displays over-by-over batting pressure, bowling pressure and net momentum
 * charts for the selected match. For each team, we plot three lines: batting
 * pressure, bowling pressure and momentum (bowling minus batting). Wickets
 * are marked along the momentum line. Uses Chart.js for rendering.
 */
import React, { useEffect, useState } from "react";
import { Card, Alert, Spinner } from "react-bootstrap";
import { useLanguage } from "../language/LanguageContext";
import { useTheme } from "../theme/ThemeContext";
import api from "../api";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Filler,
  Tooltip,
  Legend,
  annotationPlugin
);

const MatchPressurePage = ({ selectedMatch, teamCategory }) => {
  const { t } = useLanguage();
  const theme = useTheme();

  // Data state: array of team momentum objects
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Fetch pressure data when the selected match changes. If no match is
   * selected, clear the data state. The API returns momentum arrays for each
   * team containing batting and bowling pressure per over along with wickets.
   */
  useEffect(() => {
    setData(null);
    setError("");
    if (!selectedMatch) return;
    const fetchPressure = async () => {
      try {
        setLoading(true);
        const res = await api.post("/match-momentum", {
          team_category: teamCategory,
          tournament: selectedMatch.tournament,
          match_id: selectedMatch.match_id,
        });
        setData(res.data || {});
      } catch (err) {
        console.error("Error fetching momentum data", err);
        setError(
          err?.response?.data?.detail || err.message || "Error fetching pressure data"
        );
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchPressure();
  }, [selectedMatch, teamCategory]);

  /**
   * Build chart configuration for each team. We convert the API momentum
   * response into three datasets: batting pressure, bowling pressure and
   * momentum (bowling minus batting). Wickets are annotated on the chart.
   */
  const renderTeamChart = (teamData) => {
    // X-axis labels (O1 to O20)
    const overs = Array.from({ length: 20 }, (_, i) => i + 1);
    const batting = overs.map((o) => {
      const entry = teamData.momentum.find((v) => Number(v.over) === o);
      return entry ? entry.batting_bpi : null;
    });
    const bowling = overs.map((o) => {
      const entry = teamData.momentum.find((v) => Number(v.over) === o);
      return entry ? entry.bowling_bpi : null;
    });
    const net = batting.map((b, idx) => {
      const bow = bowling[idx];
      if (b === null || bow === null) return null;
      return +(bow - b).toFixed(2);
    });
    // Calculate total momentum
    const total = net.reduce((sum, n) => sum + (typeof n === "number" ? n : 0), 0);
    const roundedTotal = total.toFixed(1);
    // Determine color for momentum counter based on positive or negative total
    const momentumColor = total >= 0 ? theme.successColor || "rgba(34,197,94,0.8)" : theme.dangerColor || "rgba(220,38,38,0.8)";
    // Map wickets per over
    const wicketsPerOver = {};
    teamData.momentum.forEach((over) => {
      if (typeof over.wickets === "number") {
        wicketsPerOver[Number(over.over)] = over.wickets;
      }
    });
    // Build wicket annotations
    const wicketAnnotations = {};
    Object.entries(wicketsPerOver).forEach(([overStr, count]) => {
      const over = Number(overStr);
      for (let i = 0; i < count; i++) {
        wicketAnnotations[`wicket_${over}_${i}`] = {
          type: "label",
          xValue: over,
          yValue: 2 - i * 1.5,
          content: "❌",
          font: { size: 14, weight: "bold" },
          color: theme.dangerColor || "red",
          xAdjust: over === 1 ? 8 : 0,
          position: { x: "center", y: "center" },
          drawTime: "afterDatasetsDraw",
        };
      }
    });
    const chartData = {
      labels: overs.map((o) => `O${o}`),
      datasets: [
        {
          label: t("pressure.battingPressure") || "Batting pressure",
          data: batting,
          borderColor: theme.primaryColor || "rgba(0,123,255,0.6)",
          backgroundColor: theme.primaryColor || "rgba(0,123,255,0.6)",
          tension: 0.3,
          fill: false,
          borderDash: [5, 5],
          pointRadius: 2,
        },
        {
          label: t("pressure.bowlingPressure") || "Bowling pressure",
          data: bowling,
          borderColor: theme.accentColor || "rgba(220,53,69,0.6)",
          backgroundColor: theme.accentColor || "rgba(220,53,69,0.6)",
          tension: 0.3,
          fill: false,
          borderDash: [5, 5],
          pointRadius: 2,
        },
        {
          label: t("pressure.momentum") || "Momentum",
          data: net,
          borderColor: theme.successColor || "green",
          backgroundColor: theme.successColor || "green",
          tension: 0.3,
          fill: false,
          pointRadius: 2,
        },
      ],
    };
    const chartOptions = {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: theme.textPrimary || "#000",
          },
        },
        annotation: {
          annotations: {
            zeroLine: {
              type: "line",
              yMin: 0,
              yMax: 0,
              borderColor: theme.neutralColor || "#888",
              borderWidth: 1,
            },
            phaseLine6: {
              type: "line",
              xMin: 6,
              xMax: 6,
              borderColor: theme.borderColor || "#aaa",
              borderWidth: 1,
            },
            phaseLine15: {
              type: "line",
              xMin: 15,
              xMax: 15,
              borderColor: theme.borderColor || "#aaa",
              borderWidth: 1,
            },
            momentumCounter: {
              type: "label",
              xValue: 18.5,
              yValue: Math.max(...net.filter((n) => n !== null)) + 2 || 0,
              backgroundColor: momentumColor,
              borderColor: theme.borderColor || "#000",
              borderWidth: 1,
              cornerRadius: 4,
              padding: 6,
              content: [`${t("pressure.totalMomentum") || "Total momentum"}: ${roundedTotal}`],
              font: { size: 12, weight: "bold" },
              color: "#fff",
              position: { x: "end", y: "start" },
              drawTime: "afterDraw",
            },
            ...wicketAnnotations,
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: t("pressure.oversLabel") || "Overs",
            color: theme.textPrimary || "#000",
          },
          ticks: {
            color: theme.textPrimary || "#000",
          },
        },
        y: {
          title: {
            display: true,
            text: t("pressure.indexLabel") || "Pressure index",
            color: theme.textPrimary || "#000",
          },
          ticks: {
            color: theme.textPrimary || "#000",
          },
          beginAtZero: false,
        },
      },
    };
    return (
      <div className="mb-5" key={teamData.team}>
        <h6 style={{ fontWeight: 600 }}>
          {teamData.team} {t("pressure.battingLabel") || "batting"}
        </h6>
        <Line data={chartData} options={chartOptions} />
      </div>
    );
  };

  // Styles for container card
  const cardStyle = {
    backgroundColor: theme?.surfaceElevated || "var(--color-surface-elevated)",
    border: `1px solid rgba(255,255,255,0.08)`,
    boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
    color: "var(--color-text-primary)",
    borderRadius: 12,
  };

  // If no match selected, show hint
  if (!selectedMatch) {
    return (
      <Alert variant="secondary" className="my-3" style={{ fontSize: "0.85rem" }}>
        {t("matchAnalysis.selectMatchHint") ||
          "Select a match above to see scorecards, pressure graphs, partnerships and reports."}
      </Alert>
    );
  }

  return (
    <Card style={cardStyle} className="mb-3">
      <Card.Body>
        <Card.Title style={{ fontWeight: 700, fontSize: "1.1rem" }}>
          {t("matchAnalysis.tabs.pressure") || "Pressure analysis"}
        </Card.Title>
        <small style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
          {t("pressure.description") ||
            "Explore batting pressure, bowling pressure and momentum over each over of the match. Wickets are marked with ❌ symbols."}
        </small>
        {error && (
          <Alert variant="danger" className="mt-3" style={{ fontSize: "0.85rem" }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <div className="d-flex justify-content-center align-items-center" style={{ height: "200px" }}>
            <Spinner animation="border" />
          </div>
        ) : data?.momentum?.length > 0 ? (
          data.momentum.map((teamData) => renderTeamChart(teamData))
        ) : (
          <Alert variant="info" className="mt-3" style={{ fontSize: "0.85rem" }}>
            {t("pressure.noData") || "No momentum data available for this match."}
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
};

export default MatchPressurePage;