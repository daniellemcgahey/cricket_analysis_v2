// src/pages/CoachesHub.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBarChart2,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiArrowUpRight,
  FiArrowDownRight,
} from "react-icons/fi";
import { Line } from "react-chartjs-2";

import { useTheme } from "../theme/ThemeContext";
import useUITheme from "../theme/useUITheme";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../language/LanguageContext";

import KPIBlock from "../components/KPIBlock";
import SectionGrid from "../components/SectionGrid";
import GlassCard from "../components/GlassCard";

import PreGame from "./PreGame";
import PostGame from "./PostGame";
import PostTournament from "./PostTournament";
import Training from "./Training";

import {
  Chart as ChartJS,
  LineElement,
  LinearScale,
  TimeScale,
  PointElement,
  CategoryScale,
} from "chart.js";

import "chartjs-adapter-date-fns";

ChartJS.register(LineElement, LinearScale, TimeScale, PointElement, CategoryScale);

const API_BASE = process.env.REACT_APP_API_BASE_URL;

/* ======================================================
   Determine whether team uses ICC rankings
======================================================= */
const isICCEligible = (themeKey) => {
  const key = themeKey.toLowerCase();
  return (
    (key.includes("women") || key.includes("men")) &&
    !key.includes("u19") &&
    !key.includes("u17") &&
    !key.includes("u15")
  );
};

const CoachesHub = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const ui = useUITheme();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [ranking, setRanking] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [showTrend, setShowTrend] = useState(false);
  const [activeTool, setActiveTool] = useState(null); // "pre-game" | "post-game" | ...

  const isRanked = isICCEligible(theme.key);

  const compType = theme.teamName.toLowerCase().includes("women")
    ? "t20w"
    : "t20";

  /* ======================================================
     Arrow rendering
  ======================================================= */
  const deltaArrow = (delta) => {
    if (!delta || delta === 0) return <span style={{ opacity: 0.4 }}>—</span>;
    return delta > 0 ? (
      <span style={{ color: "#4ade80", marginLeft: 6 }}>
        <FiArrowUpRight size={16} /> {delta}
      </span>
    ) : (
      <span style={{ color: "#f87171", marginLeft: 6 }}>
        <FiArrowDownRight size={16} /> {Math.abs(delta)}
      </span>
    );
  };

  /* ======================================================
     Load Data
  ======================================================= */
  useEffect(() => {
    fetch(
      `${API_BASE}/team-dashboard-stats?team_name=${encodeURIComponent(
        theme.teamName
      )}`
    )
      .then((res) => res.json())
      .then(setStats)
      .catch((err) => console.error("Stats fetch failed:", err));

    if (!isRanked) return;

    fetch(
      `${API_BASE}/latest-ranking?team_name=${encodeURIComponent(
        theme.teamName
      )}&comp_type=${compType}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "ok") setRanking(data.data);
      });

    fetch(
      `${API_BASE}/ranking-history?team_name=${encodeURIComponent(
        theme.teamName
      )}&comp_type=${compType}&months=24`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "ok") setHistory(data.rows);
      });
  }, [theme.teamName, compType, isRanked]);

  /* ======================================================
     Prepare history for charts
  ======================================================= */
  const ordered = history.slice().sort(
    (a, b) => new Date(a.scraped_at) - new Date(b.scraped_at)
  );

  // Extend line to today if last update is old
  const extended = [...ordered];
  if (extended.length > 0) {
    const last = extended[extended.length - 1];
    const lastDate = new Date(last.scraped_at);
    const today = new Date();
    if (lastDate < today) {
      extended.push({
        ...last,
        scraped_at: today.toISOString(),
        rank_date: today.toISOString().slice(0, 10),
      });
    }
  }

  const now = new Date();
  const start = new Date();
  start.setFullYear(now.getFullYear() - 2);

  /* ======================================================
     KPI Values
  ======================================================= */
  const last = ordered.length ? ordered[ordered.length - 1] : null;
  const prev = ordered.length > 1 ? ordered[ordered.length - 2] : null;

  const rankDelta = last && prev ? prev.rank - last.rank : 0;
  const ratingDelta = last && prev ? last.rating - prev.rating : 0;

  const kpis = isRanked
    ? [
        {
          label: t("coaches.kpiIccRank"),
          value: ranking ? `#${ranking.rank}` : "—",
          icon: <FiTrendingUp />,
          suffix: deltaArrow(rankDelta),
        },
        {
          label: t("coaches.kpiRating"),
          value: ranking?.rating ?? "—",
          icon: <FiBarChart2 />,
          suffix: deltaArrow(ratingDelta),
        },
        {
          label: t("coaches.kpiMatchesCounted"),
          value: ranking?.matches ?? "—",
          icon: <FiUsers />,
        },
        {
          label: t("coaches.kpiPoints"),
          value: ranking?.points ?? "—",
          icon: <FiTarget />,
        },
      ]
    : [
        {
          label: t("coaches.kpiWinPct"),
          value: stats?.win_pct ? `${stats.win_pct}%` : "—",
          icon: <FiTrendingUp />,
        },
        {
          label: t("coaches.kpiAvgRunsFor"),
          value: stats?.avg_for ?? "—",
          icon: <FiBarChart2 />,
        },
        {
          label: t("coaches.kpiAvgRunsAgainst"),
          value: stats?.avg_against ?? "—",
          icon: <FiTarget />,
        },
        {
          label: t("coaches.kpiMatchesPlayed"),
          value: stats?.matches_played ?? "—",
          icon: <FiUsers />,
        },
      ];

  /* ======================================================
     Chart builder (shared config)
  ======================================================= */
  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        type: "time",
        min: start.getTime(),
        max: now.getTime(),
        time: { unit: "month" },
        ticks: {
          color: ui.charts.ticks,
          callback: (value) => {
            const d = new Date(value);
            const showMonths = [0, 2, 4, 6, 8, 10]; // JAN / MAR / MAY / ...
            if (!showMonths.includes(d.getMonth())) return "";
            return `${d.toLocaleDateString("en-US", {
              month: "short",
            })} '${d.getFullYear().toString().slice(-2)}`;
          },
        },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: ui.charts.ticks,
          callback: (val) => (Number.isInteger(val) ? val : ""),
        },
        grid: { display: false },
      },
    },
  };

  /* ======================================================
     UI RENDER
  ======================================================= */
  return (
    <div
      className="container py-4"
      style={{
        minHeight: "100vh",
        color: ui.text.primary,
        background: ui.background.transparent,
      }}
    >
      {/* HERO HEADER */}
      <div
        className="mb-4 p-4 rounded-3 position-relative"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor}33, ${theme.accentColor}33)`,
          border: `1px solid ${ui.border.subtle}`,
          color: ui.text.primary,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 4,
            left: 0,
            top: 0,
            bottom: 0,
            background: theme.accentColor,
          }}
        />

        <h2
          style={{
            fontWeight: 700,
            marginBottom: 10,
            color: ui.text.primary,
          }}
        >
          {t("coaches.title") /* "Coaches Hub" */}
        </h2>

        {/* Buttons */}
        {isRanked && (
          <>
            <button
              onClick={() => setShowTrend((p) => !p)}
              style={{
                position: "absolute",
                top: 14,
                right: 195,
                border: `1px solid ${theme.accentColor}`,
                background: "transparent",
                padding: "6px 12px",
                borderRadius: 8,
                color: ui.text.primary,
                fontWeight: 600,
              }}
            >
              {showTrend
                ? t("coaches.iccToggleShowOverview") // "ICC Rating Overview"
                : t("coaches.iccToggleShowTrend") // "Ranking/Rating Trend"
              }
            </button>

            <button
              onClick={() => console.log("TODO: Update ranking")}
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                background: theme.accentColor,
                padding: "6px 12px",
                color: ui.text.primary,
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              {t("coaches.updateRankingButton") /* "Update ICC Ranking" */}
            </button>
          </>
        )}

        {/* KPI OR CHARTS */}
        {!showTrend ? (
          <div
            className="d-grid"
            style={{
              marginTop: 20,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))",
              gap: 14,
            }}
          >
            {kpis.map((k, i) => (
              <KPIBlock key={i} {...k} />
            ))}
          </div>
        ) : (
          <div
            style={{
              marginTop: 20,
              padding: 20,
              background: ui.background.card,
              borderRadius: 12,
              border: `1px solid ${ui.border.subtle}`,
            }}
          >
            <h5 style={{ marginBottom: 12, color: ui.text.primary }}>
              {t(
                "coaches.trendCardTitle"
              ) /* "ICC Ranking & Rating Trend (2 Years)" */}
            </h5>

            <div style={{ display: "flex", gap: 20, height: 260 }}>
              {/* Rank Chart */}
              <div style={{ flex: 1 }}>
                <Line
                  data={{
                    labels: extended.map((h) => new Date(h.scraped_at)),
                    datasets: [
                      {
                        label: t("coaches.rankLabel") || "Rank",
                        data: extended.map((h) => ({
                          x: new Date(h.scraped_at),
                          y: h.rank,
                        })),
                        borderColor: theme.accentColor,
                        pointRadius: 0,
                        tension: 0.3,
                        borderWidth: 3,
                      },
                    ],
                  }}
                  options={{
                    ...commonChartOptions,
                    scales: {
                      ...commonChartOptions.scales,
                      y: {
                        ...commonChartOptions.scales.y,
                        reverse: true,
                      },
                    },
                  }}
                />
              </div>

              {/* Rating Chart */}
              <div style={{ flex: 1 }}>
                <Line
                  data={{
                    labels: extended.map((h) => new Date(h.scraped_at)),
                    datasets: [
                      {
                        label: t("coaches.ratingLabel") || "Rating",
                        data: extended.map((h) => ({
                          x: new Date(h.scraped_at),
                          y: h.rating,
                        })),
                        borderColor: theme.accentColor,
                        pointRadius: 0,
                        tension: 0.3,
                        borderWidth: 3,
                      },
                    ],
                  }}
                  options={{
                    ...commonChartOptions,
                    scales: {
                      ...commonChartOptions.scales,
                      y: {
                        ...commonChartOptions.scales.y,
                        suggestedMin:
                          Math.min(...extended.map((h) => h.rating)) - 2,
                        suggestedMax:
                          Math.max(...extended.map((h) => h.rating)) + 2,
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PERFORMANCE TOOLS */}
      <div style={{ marginTop: 40 }}>
        <h5 style={{ color: ui.text.primary }} className="mb-3">
          {t("coaches.performanceToolsTitle") /* "Performance Tools" */}
        </h5>

        <SectionGrid>
          {/* Pre-Game */}
          <GlassCard
            active={activeTool === "pre-game"}   // ✅ highlight when active
            onClick={() =>
              setActiveTool((prev) => (prev === "pre-game" ? null : "pre-game"))
            }
            style={{ textAlign: "center", cursor: "pointer" }}
          >
            <FiTarget size={28} />
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              {t("coaches.toolPreGame") /* "Pre-Game Analysis" */}
            </div>
          </GlassCard>

          {/* Post-Game */}
          <GlassCard
            active={activeTool === "post-game"}  // ✅
            onClick={() =>
              setActiveTool((prev) => (prev === "post-game" ? null : "post-game"))
            }
            style={{ textAlign: "center", cursor: "pointer" }}
          >
            <FiBarChart2 size={28} />
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              {t("coaches.toolPostGame") /* "Post-Game Breakdown" */}
            </div>
          </GlassCard>

          {/* Post-Tournament */}
          <GlassCard
            active={activeTool === "post-tournament"}  // ✅
            onClick={() =>
              setActiveTool((prev) =>
                prev === "post-tournament" ? null : "post-tournament"
              )
            }
            style={{ textAlign: "center", cursor: "pointer" }}
          >
            <FiBarChart2 size={28} />
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              {t("coaches.toolPostTournament") /* "Post-Tournament Breakdown" */}
            </div>
          </GlassCard>

          {/* Training */}
          <GlassCard
            active={activeTool === "training"}  // ✅
            onClick={() =>
              setActiveTool((prev) => (prev === "training" ? null : "training"))
            }
            style={{ textAlign: "center", cursor: "pointer" }}
          >
            <FiBarChart2 size={28} />
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              {t("coaches.toolTraining") /* "Training Tools" */}
            </div>
          </GlassCard>
        </SectionGrid>

        {activeTool === "pre-game" && (
          <div style={{ marginTop: 32 }}>
            <PreGame />
          </div>
        )}

        {activeTool === "post-game" && (
          <div style={{ marginTop: 32 }}>
            <PostGame />
          </div>
        )}

        {activeTool === "post-tournament" && (
          <div style={{ marginTop: 32 }}>
            <PostTournament />
          </div>
        )}

        {activeTool === "training" && (
          <div style={{ marginTop: 32 }}>
            <Training />
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachesHub;
