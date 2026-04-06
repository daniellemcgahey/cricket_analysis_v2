// src/pages/DetailedMatchTab.js
import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Row, Col, Card, Alert, Spinner, Modal, Button } from "react-bootstrap";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

import api from "../api";
import { useLanguage } from "../language/LanguageContext";
import DarkModeContext from "../DarkModeContext";
import "./MatchScorecardPage.css"; // reuse scorecard grid styles

import PitchMapChart from "./PitchMapChart";
import WagonWheelChart from "./WagonWheelChart";

import GlassCard from "../components/GlassCard";
import { useTheme } from "../theme/ThemeContext";


ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

const DetailedMatchTab = ({ selectedMatch, teamCategory }) => {
  const { t } = useLanguage();
  const { isDarkMode } = useContext(DarkModeContext);

  const [data, setData] = useState(null); // { match, innings, ball_by_ball }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const theme = useTheme();

  // Which detail section is visible: "ballByBall" | "wagon" | "pitch"
  const [activeDetail, setActiveDetail] = useState(null);
  const [expandedOvers, setExpandedOvers] = useState({});
  const [pitchViewMode, setPitchViewMode] = useState("Dots");

  const [ballDetails, setBallDetails] = useState(null);
  const [showBallModal, setShowBallModal] = useState(false);

  const cardStyle = {
    backgroundColor: "var(--color-surface-elevated)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
    color: "var(--color-text-primary)",
    borderRadius: 12,
  };

  const subtleTextStyle = {
    fontSize: "0.8rem",
    opacity: 0.8,
  };

  // Chart colours, respecting dark / light mode
  const axisTextColor = isDarkMode
    ? "rgba(226,232,240,0.9)"
    : "rgba(30,41,59,0.9)";
  const legendTextColor = axisTextColor;
  const gridColor = isDarkMode
    ? "rgba(148,163,184,0.35)"
    : "rgba(148,163,184,0.4)";

  /** ---------- Fetch detailed match data ---------- */
  useEffect(() => {
    if (!selectedMatch) {
      setData(null);
      setError("");
      return;
    }

    const fetchDetailed = async () => {
      try {
        setLoading(true);
        setError("");
        setData(null);

        const res = await api.post("/match-detailed", {
          team_category: teamCategory,
          tournament: selectedMatch.tournament,
          match_id: selectedMatch.match_id,
        });

        setData(res.data || null);
      } catch (err) {
        console.error("Error loading /match-detailed", err);
        setError(
          err?.response?.data?.detail ||
            err.message ||
            "Error loading detailed match data."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDetailed();
  }, [selectedMatch, teamCategory]);

  const innings = data?.innings || [];
  const matchMeta = data?.match || null;
  const ballByBall = data?.ball_by_ball || [];

/** ---------- Manhattan: per-innings runs per over + wicket dots ---------- */
const manhattanSeries = useMemo(() => {
  if (!innings || !innings.length) return [];

  const MAX_OVERS = 20; // 🔒 Always show O1–O20 on x-axis

  const barPalette = ["#22c55e", "#0ea5e9"]; // green, blue
  const wicketPalette = ["#f97316", "#e11d48"]; // orange, pink/red

  // Global fixed labels: O1, O2, ... O20
  const fixedLabels = Array.from({ length: MAX_OVERS }, (_, idx) => `O${idx + 1}`);

  return innings.map((inn, idx) => {
    const overs = inn.overs || [];
    const teamName =
      inn.batting_team_name ||
      inn.batting_team_id ||
      inn.team ||
      `Innings ${inn.innings_no}`;

    const inningsLabel =
      `${teamName} – ` +
      (inn.innings_no === 1
        ? (t("detailedMatch.innings1Label") || "1st innings")
        : inn.innings_no === 2
        ? (t("detailedMatch.innings2Label") || "2nd innings")
        : `${t("detailedMatch.inningsLabelShort") || "Inns"} ${inn.innings_no}`);

    if (!overs.length) {
      return {
        label: inningsLabel,
        labels: [],
        datasets: [],
      };
    }

    // Map actual overs -> { runs, wickets }
    const overMap = {};
    overs.forEach((ov, idxOv) => {
      const oNum =
        Number(ov.over) ||
        Number(ov.over_number) ||
        Number(ov.over_no) ||
        idxOv + 1;

      if (!oNum || oNum < 1 || oNum > MAX_OVERS) return;

      overMap[oNum] = {
        runs: ov.runs || 0,
        wickets: ov.wickets || 0,
      };
    });

    // Build runs array for all 20 overs
    const runsPerOver = fixedLabels.map((_, idxLabel) => {
      const overNum = idxLabel + 1;
      const entry = overMap[overNum];
      return entry ? entry.runs : 0; // 0 = no bar (visually “missing”)
    });

    // Wicket dots stacked just above that over's bar (only where overs exist)
    const wicketPoints = [];
    fixedLabels.forEach((label, idxLabel) => {
      const overNum = idxLabel + 1;
      const entry = overMap[overNum];
      if (!entry || !entry.wickets) return;

      const runs = entry.runs || 0;
      const wkts = entry.wickets || 0;

      for (let k = 0; k < wkts; k++) {
        wicketPoints.push({
          x: label,
          y: runs + 0.5 + k * 1.2,
        });
      }
    });

    const barColor = barPalette[idx % barPalette.length];
    const wicketColor = wicketPalette[idx % wicketPalette.length];

    const datasets = [
      {
        type: "bar",
        label: t("detailedMatch.runsShort") || "Runs",
        data: runsPerOver,
        backgroundColor: barColor + "DD",
        borderColor: barColor,
        borderWidth: 1,
        barPercentage: 0.9,
        categoryPercentage: 0.8,
        yAxisID: "y",
      },
      {
        type: "scatter",
        label: t("detailedMatch.wicketsShort") || "Wkts",
        data: wicketPoints,
        parsing: false,
        backgroundColor: wicketColor,
        borderColor: wicketColor,
        pointRadius: 4,
        pointHoverRadius: 5,
        showLine: false,
        yAxisID: "y",
        xAxisID: "x",
      },
    ];

    return {
      label: inningsLabel,
      labels: fixedLabels,
      datasets,
    };
  });
}, [innings, t]);


const manhattanOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false, // 🔇 hide legend
      labels: {
        color: legendTextColor,
        usePointStyle: true,
      },
    },
    tooltip: {
      mode: "index",
      intersect: false,
      // ✅ remove wicket (scatter) points from the tooltip
      filter: (context) => {
        // only show bar dataset tooltips
        return context.dataset.type !== "scatter";
      },
      callbacks: {
        // optional: clean label formatting
        label: (context) => {
          const value =
            context.parsed?.y ?? (context.raw && context.raw.y) ?? 0;
          return `Runs: ${value}`;
        },
      },
    },
  },
  layout: {
    padding: {
      top: 0,
      bottom: 0,
      left: 4,
      right: 4,
    },
  },
  scales: {
    x: {
      ticks: {
        color: axisTextColor,
        font: {
          size: 10,
        },
      },
      grid: {
        display: false,
      },
      stacked: false,
    },
    y: {
      ticks: {
        color: axisTextColor,
        font: {
          size: 10,
        },
      },
      grid: {
        color: gridColor,
        borderDash: [4, 4],
      },
      beginAtZero: true,
    },
  },
};


  /** ---------- Run rate comparison (lines stop when innings ends) ---------- */
  const runRateData = useMemo(() => {
    if (!innings || !innings.length) {
      return { labels: [], datasets: [] };
    }

    // Build series: per innings, run rate after each over
    const rrSeries = [];
    const overSet = new Set();

    innings.forEach((inn, idx) => {
      const overs = inn.overs || [];
      if (!overs.length) return;

      const teamName =
        inn.batting_team_name ||
        inn.batting_team_id ||
        inn.team ||
        `Innings ${inn.innings_no}`;

      let cumRuns = 0;
      const points = [];

      overs.forEach((ov, idxOv) => {
        const overNum =
          Number(ov.over) ||
          Number(ov.over_number) ||
          Number(ov.over_no) ||
          idxOv + 1;

        cumRuns += ov.runs || 0;
        const oversSoFar = overNum || idxOv + 1;
        const rr = oversSoFar ? cumRuns / oversSoFar : 0;

        points.push({ over: overNum, rr });
        overSet.add(overNum);
      });

      rrSeries.push({
        label: teamName,
        points,
        colorIdx: idx,
      });
    });

    const overList = Array.from(overSet).sort((a, b) => a - b);
    const labels = overList.map((n) => `O${n}`);

    const linePalette = ["#22c55e", "#0ea5e9"]; // green, blue

    const datasets = rrSeries.map((series) => {
      const map = {};
      series.points.forEach((p) => {
        map[p.over] = p.rr;
      });

      const color = linePalette[series.colorIdx % linePalette.length];

      return {
        type: "line",
        label: series.label,
        data: overList.map((ov) => map[ov] ?? null),
        borderColor: color,
        backgroundColor: color + "33",
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 4,
        spanGaps: true,
        tension: 0.25,
        yAxisID: "y",
      };
    });

    return { labels, datasets };
  }, [innings]);

  const runRateOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: legendTextColor,
            usePointStyle: true,
          },
        },
        tooltip: {
          mode: "index",
          intersect: false,
        },
      },
      scales: {
        x: {
          ticks: {
            color: axisTextColor,
          },
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: axisTextColor,
          },
          grid: {
            color: gridColor,
            borderDash: [4, 4],
          },
        },
      },
    }),
    [axisTextColor, legendTextColor, gridColor]
  );

  /** ---------- Phase breakdown (side-by-side: both teams) ---------- */
  const phaseLayout = useMemo(() => {
    if (!innings || !innings.length) {
      return { teams: [], rows: [] };
    }

    const PHASE_ORDER = ["powerplay", "middle", "death"];

    const phaseLabel = (phaseKey) => {
      if (phaseKey === "powerplay") {
        return t("detailedMatch.phasePowerplay") || "Powerplay";
      }
      if (phaseKey === "middle") {
        return t("detailedMatch.phaseMiddle") || "Middle overs";
      }
      if (phaseKey === "death") {
        return t("detailedMatch.phaseDeath") || "Death overs";
      }
      return phaseKey;
    };

    // We’ll treat each innings as "Team A / Team B" based on batting order
    const teamInfos = innings.map((inn) => ({
      teamName:
        inn.batting_team_name ||
        inn.batting_team_id ||
        inn.team ||
        `Innings ${inn.innings_no}`,
      phaseSummary: inn.phase_summary || {},
      inningsNo: inn.innings_no,
    }));

    const teams = teamInfos.map((ti) => ti.teamName);

    const rows = PHASE_ORDER.map((phaseKey) => {
      const label = phaseLabel(phaseKey);

      const teamCells = teamInfos.map((ti) => {
        const p = ti.phaseSummary[phaseKey] || {};
        const runs = p.runs || 0;
        const wickets = p.wickets || 0;
        const balls = p.balls || 0;
        const dots = p.dot_balls ?? p.dots ?? 0;

        // Try to pull 2s if backend provides them under any sensible key
        const twos =
          p.twos ??
          p["2s"] ??
          p.two ??
          0;

        const fours = p.fours || 0;
        const sixes = p.sixes || 0;

        const scoringPctStr =
            p.scoring_pct != null
            ? `${p.scoring_pct.toFixed(1)}%`
            : "-";

        return {
          teamName: ti.teamName,
          runs,
          wickets,
          scoring_pct: scoringPctStr,
          twos,
          fours,
          sixes,
        };
      });

      return {
        key: phaseKey,
        phaseLabel: label,
        teamCells,
      };
    });

    return { teams, rows };
  }, [innings, t]);

  const phaseTeams = phaseLayout.teams || [];
  const phaseRows = phaseLayout.rows || [];


 /** ---------- Ball-by-ball breakdown (grouped by over, collapsible) ---------- */
const ballsByInnings = useMemo(() => {
  if (!ballByBall || !ballByBall.length || !innings.length) return [];

  // Group raw balls by innings
  const groupedByInnings = {};
  ballByBall.forEach((ball) => {
    const innNo = ball.innings_no || ball.innings || 1;
    if (!groupedByInnings[innNo]) groupedByInnings[innNo] = [];
    groupedByInnings[innNo].push(ball);
  });

  const buildDismissalText = (b) => {
    const dtype = (b.dismissal_type || "").trim();
    if (!dtype) return "";

    const bowlerName =
      b.bowler_name || b.bowler || t("detailedMatch.colBowler") || "bowler";
    const fielder = b.fielder_name || b.fielder || "";
    const dismissedName =
      b.dismissed_player_name ||
      b.batter_name ||
      b.non_striker_name ||
      "";

    if (/run ?out/i.test(dtype)) {
      if (dismissedName && fielder) {
        return `run out ${dismissedName} (${fielder})`;
      }
      if (dismissedName) return `run out ${dismissedName}`;
      return "run out";
    }
    if (/stumped/i.test(dtype)) {
      return fielder ? `stumped ${fielder}` : "stumped";
    }
    if (/caught/i.test(dtype) || /^c\b/i.test(dtype)) {
      if (fielder && bowlerName) {
        const fTrim = fielder.trim();
        const bTrim = bowlerName.trim();

        // c & b (bowler takes the catch)
        if (fTrim && bTrim && fTrim.toLowerCase() === bTrim.toLowerCase()) {
          return `c & b ${bowlerName}`;
        }

        // normal caught
        return `c ${fielder} b ${bowlerName}`;
      }
      return `c ? b ${bowlerName}`;
    }
    if (/bowled/i.test(dtype)) {
      return `b ${bowlerName}`;
    }
    if (/lbw/i.test(dtype)) {
      return `lbw ${bowlerName}`;
    }

    return dtype;
  };

  return innings.map((inn) => {
    const innNo = inn.innings_no;
    const list = (groupedByInnings[innNo] || []).slice();

    // Ensure stable ordering
    list.sort((a, b) => {
      const ao = Number(a.over_index) || 0;
      const bo = Number(b.over_index) || 0;
      if (ao !== bo) return ao - bo;
      const ab =
        a.ball_in_over != null ? Number(a.ball_in_over) : Number(a.ball_number) || 0;
      const bb =
        b.ball_in_over != null ? Number(b.ball_in_over) : Number(b.ball_number) || 0;
      if (ab !== bb) return ab - bb;
      const aid = Number(a.ball_id) || 0;
      const bid = Number(b.ball_id) || 0;
      return aid - bid;
    });

    const teamName =
      inn.batting_team_name ||
      inn.batting_team_id ||
      inn.team ||
      `Innings ${innNo}`;

    const overMap = {};

    list.forEach((b, idx) => {
      const overNum = Number(b.over_index) || 0; // 1-based from backend
      if (!overNum) return;

      if (!overMap[overNum]) {
        overMap[overNum] = {
          overNum,
          bowler: b.bowler_name || b.bowler || "",
          totalRuns: 0,
          wickets: 0,
          balls: [],
        };
      }

      const runsBat = b.runs_bat != null ? b.runs_bat : b.runs || 0;
      const wides = b.wides || 0;
      const noBalls = b.no_balls || 0;
      const byes = b.byes || 0;
      const legByes = b.leg_byes || 0;
      const penalty = b.penalty_runs || 0;

      const extrasTotal = wides + noBalls + byes + legByes + penalty;

      const totalRuns =
        b.total_runs != null ? b.total_runs : runsBat + extrasTotal;

      const hasDismissal =
        b.dismissal_type && String(b.dismissal_type).trim() !== "";
      const dismissalText = hasDismissal ? buildDismissalText(b) : "";

      overMap[overNum].totalRuns += totalRuns;
      if (hasDismissal) {
        overMap[overNum].wickets += 1;
      }

      // ---- label: "over.ball" (zero-based over; handles ball 0) ----
      const rawOverIndex = Number(b.over_index || overNum || 1);
      const displayOver = rawOverIndex - 1; // Over 1 → 0.x, Over 2 → 1.x, etc.

      let ballInOver = null;
      if (b.ball_in_over != null) {
        ballInOver = Number(b.ball_in_over);
      } else if (b.balls_this_over != null) {
        ballInOver = Number(b.balls_this_over);
      } else if (b.ball_number != null) {
        ballInOver = Number(b.ball_number);
      }

      let label;
      if (
        !Number.isNaN(displayOver) &&
        ballInOver != null &&
        !Number.isNaN(ballInOver)
      ) {
        // e.g. Over 1 ball 1 => 0.1, Over 13 first-ball wide (0) => 12.0
        label = `${displayOver}.${ballInOver}`;
      } else if (!Number.isNaN(displayOver)) {
        label = `${displayOver}.?`;
      } else {
        label = "-";
      }

      

      // --- coords & meta for pop-out ---
      const pitchXRaw =
        b.pitch_x ?? b.pitchX ?? null;
      const pitchYRaw =
        b.pitch_y ?? b.pitchY ?? null;

      const shotXRaw =
        b.shot_x ?? b.shotX ?? b.wagon_x ?? null;
      const shotYRaw =
        b.shot_y ?? b.shotY ?? b.wagon_y ?? null;

      const hasPitch =
        pitchXRaw !== null && pitchXRaw !== undefined &&
        pitchYRaw !== null && pitchYRaw !== undefined;

      const hasWagon =
        shotXRaw !== null && shotXRaw !== undefined &&
        shotYRaw !== null && shotYRaw !== undefined;

      const hasDetail = hasPitch || hasWagon;

      overMap[overNum].balls.push({
        key: `${innNo}_${b.ball_id || idx}`,
        label,
        batter: b.batter_name || "",
        runsOffBat: runsBat,
        extrasTotal,
        wides,
        noBalls,
        byes,
        legByes,
        penalty,
        isBoundary: runsBat === 4 || runsBat === 6,
        isWicket: hasDismissal,
        isExtra: extrasTotal > 0,
        dismissalText,

        // pop-out flags
        hasPitch,
        hasWagon,
        hasDetail,

        // raw coords
        pitchXRaw,
        pitchYRaw,
        shotXRaw,
        shotYRaw,

        // extra info
        shotType: b.shot_type,
        footwork: b.footwork,
        shotSelection: b.shot_selection,
        aerial: b.aerial,
        edged: b.edged,
        ballMissed: b.ball_missed,
        cleanHit: b.clean_hit,
        deliveryType: b.delivery_type,
        expectedRuns: b.expected_runs,
        expectedWicket: b.expected_wicket,
        battingIntent: b.batting_intent_score,
        battingBPI: b.batting_bpi,
        bowlingBPI: b.bowling_bpi,
      });

    });

    const overs = Object.values(overMap).sort(
      (a, b) => a.overNum - b.overNum
    );

    return {
      inningsNo: innNo,
      team: teamName,
      overs,
    };
  });
}, [ballByBall, innings, t]);

  /** ---------- Match wagon wheels: per-innings shot data ---------- */
  const wagonByInnings = useMemo(() => {
    if (!innings || !innings.length || !ballByBall || !ballByBall.length) {
      return [];
    }

    const grouped = {};

    innings.forEach((inn) => {
      const innNo = inn.innings_no;
      const teamName =
        inn.batting_team_name ||
        inn.batting_team_id ||
        inn.team ||
        `Innings ${innNo}`;
      grouped[innNo] = {
        inningsNo: innNo,
        team: teamName,
        balls: [],
      };
    });

    ballByBall.forEach((b) => {
      const innNo = b.innings_no || b.innings || 1;
      const bucket = grouped[innNo];
      if (!bucket) return;

      const x =
        b.shot_x ??
        b.shotX ??
        b.wagon_x ??
        null;
      const y =
        b.shot_y ??
        b.shotY ??
        b.wagon_y ??
        null;

      if (x === null || x === undefined || y === null || y === undefined) {
        return; // no wagon data for this ball
      }

      const runs =
        b.runs_bat != null
          ? b.runs_bat
          : b.runs != null
          ? b.runs
          : 0;

      bucket.balls.push({
        x,
        y,
        runs,
        dismissal_type: b.dismissal_type || null,
      });
    });

    return Object.values(grouped)
      .filter((blk) => blk.balls.length > 0)
      .sort((a, b) => a.inningsNo - b.inningsNo);
  }, [innings, ballByBall]);

  /** ---------- Match pitch maps: per-innings pitch data ---------- */
  const pitchByInnings = useMemo(() => {
    if (!innings || !innings.length || !ballByBall || !ballByBall.length) {
      return [];
    }

    const grouped = {};

    innings.forEach((inn) => {
      const innNo = inn.innings_no;
      const teamName =
        inn.batting_team_name ||
        inn.batting_team_id ||
        inn.team ||
        `Innings ${innNo}`;
      grouped[innNo] = {
        inningsNo: innNo,
        team: teamName,
        balls: [],
      };
    });

    ballByBall.forEach((b) => {
      const innNo = b.innings_no || b.innings || 1;
      const bucket = grouped[innNo];
      if (!bucket) return;

      const pitch_x = b.pitch_x ?? b.pitchX ?? null;
      const pitch_y = b.pitch_y ?? b.pitchY ?? null;

      if (
        pitch_x === null ||
        pitch_x === undefined ||
        pitch_y === null ||
        pitch_y === undefined
      ) {
        return; // no pitch map data for this ball
      }

      const runs =
        b.runs_bat != null
          ? b.runs_bat
          : b.runs != null
          ? b.runs
          : 0;

      bucket.balls.push({
        ball_id: b.ball_id,
        pitch_x,
        pitch_y,
        runs,
        wides: b.wides || 0,
        no_balls: b.no_balls || 0,
        dismissal_type: b.dismissal_type || null,
      });
    });

    return Object.values(grouped)
      .filter((blk) => blk.balls.length > 0)
      .sort((a, b) => a.inningsNo - b.inningsNo);
  }, [innings, ballByBall]);




  /** ---------- Top-level render states ---------- */

  if (!selectedMatch) {
    return (
      <Alert variant="info" style={{ fontSize: "0.9rem" }}>
        {t("detailedMatch.selectMatchHint") ||
          "Select a match above to view detailed over-by-over breakdown."}
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2">
        <Spinner animation="border" size="sm" />
        <span style={{ fontSize: "0.9rem" }}>
          {t("detailedMatch.loading") ||
            "Loading detailed match data…"}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" style={{ fontSize: "0.9rem" }}>
        {t("detailedMatch.error") ||
          "There was a problem loading this match."}
        <br />
        <small>{error}</small>
      </Alert>
    );
  }

  if (!innings.length) {
    return (
      <Alert variant="secondary" style={{ fontSize: "0.9rem" }}>
        {t("detailedMatch.noData") ||
          "No detailed data available for this match yet."}
      </Alert>
    );
  }

  /** ---------- Render ---------- */

  return (
    <>
      {/* Match header */}
      <Card className="mb-3" style={cardStyle}>
        <Card.Body>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 8,
              fontSize: "0.9rem",
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {matchMeta?.tournament_name ||
                selectedMatch.tournament}
            </div>
            <div style={subtleTextStyle}>
              {matchMeta?.venue && (
                <span>{matchMeta.venue} &nbsp;•&nbsp;</span>
              )}
              {matchMeta?.match_date}
            </div>
          </div>
          {matchMeta?.result && (
            <div
              style={{
                marginTop: 6,
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              {matchMeta.result}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Over-by-over charts */}
      <Row className="g-3">
        {/* Manhattan – per innings vertically */}
        <Col md={6}>
          <Card style={cardStyle}>
            <Card.Body style={{ height: 480 }}>
              <div
                style={{
                  fontSize: "0.85rem",
                  marginBottom: 0,
                  fontWeight: 600,
                }}
              >
                {t("detailedMatch.manhattanTitle") ||
                  "Runs per over (with wickets)"}
              </div>

              {!manhattanSeries.length ? (
                <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                  {t("detailedMatch.noOverData") ||
                    "No over-level data available for this match."}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    height: "100%",
                  }}
                >
                  {manhattanSeries.map((series, idx) => (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        minHeight: 0,
                        paddingBottom:
                          idx === manhattanSeries.length - 1 ? 0 : 1,
                        borderBottom:
                          idx === manhattanSeries.length - 1
                            ? "none"
                            : "1px solid rgba(148,163,184,0.25)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.8rem",
                          marginBottom: 0,
                          opacity: 0.9,
                        }}
                      >
                        {series.label}
                      </div>

                      {series.labels.length ? (
                        <div style={{ height: 200 }}>
                          <Bar
                            data={{
                              labels: series.labels,
                              datasets: series.datasets,
                            }}
                            options={manhattanOptions}
                          />
                        </div>
                      ) : (
                        <div
                          style={{ fontSize: "0.75rem", opacity: 0.7 }}
                        >
                          {t(
                            "detailedMatch.noOverDataInnings"
                          ) || "No over-level data for this innings."}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Run rate comparison */}
        <Col md={6}>
          <Card style={cardStyle}>
            <Card.Body style={{ height: 480 }}>
              <div
                style={{
                  fontSize: "0.85rem",
                  marginBottom: 0,
                  fontWeight: 600,
                }}
              >
                {t("detailedMatch.rrTitle") ||
                  "Run rate comparison"}
              </div>

              {runRateData.labels.length ? (
                <div style={{ height: "90%" }}>
                  <Line
                    data={runRateData}
                    options={runRateOptions}
                  />
                </div>
              ) : (
                <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                  {t("detailedMatch.noOverData") ||
                    "No over-level data available for this match."}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Phase breakdown */}
      <Card className="mt-3" style={cardStyle}>
        <Card.Body>
          <div
            style={{
              fontSize: "1rem",
              marginBottom: 6,
              fontWeight: 700,
            }}
          >
            {t("detailedMatch.phaseTitle") || "Phase breakdown"}
          </div>

          {!phaseRows.length ? (
            <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
              {t("detailedMatch.noPhaseData") ||
                "No phase summary data available for this match."}
            </div>
          ) : (
            <div className="scorecard-grid scorecard-grid--batting">
              {/* Header row: Phase | Team A | Team B */}
                <div
                    className="scorecard-row scorecard-row--header"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 1fr 1fr",
                        columnGap: 12
                    }}
                    >
                    <div>
                        {t("detailedMatch.colPhase") || "Phase"}
                    </div>
                    <div className="text-start">
                        {phaseTeams[0] ||
                        t("detailedMatch.colTeamA") ||
                        "Team A"}
                    </div>
                    <div className="text-start">
                        {phaseTeams[1] ||
                        t("detailedMatch.colTeamB") ||
                        "Team B"}
                    </div>
                </div>


              {/* One row per phase; team summaries side-by-side */}
                {phaseRows.map((row) => (
                <div
                    key={row.key}
                    className="scorecard-row scorecard-row--data"
                    style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr 1fr",
                    columnGap: 12
                    }}
                >
                    {/* Phase name */}
                    <div
                    style={{
                        fontWeight: 700,
                        fontSize: "1rem"
                    }}
                    >
                    {row.phaseLabel}
                    </div>

                    {/* Team A cell */}
                    <div
                    style={{
                        fontSize: "0.8rem",
                        lineHeight: 1.8
                    }}
                    >
                    {row.teamCells[0] ? (
                        <>
                        <div>
                            {row.teamCells[0].runs}{" "}
                            {t("detailedMatch.phaseRunsLabel") || "runs"}{" "}
                            <span style={{ opacity: 0.85 }}>
                            / {row.teamCells[0].wickets}{" "}
                            {t("detailedMatch.phaseWicketsLabel") || "wickets"}
                            </span>
                        </div>
                        <div style={{ opacity: 0.9 }}>
                            {t("detailedMatch.phaseScoringShotPct") ||
                            "Scoring shot %"}
                            : {row.teamCells[0].scoring_pct}
                        </div>
                        <div style={{ opacity: 0.9 }}>
                            {`2's: ${row.teamCells[0].twos}   /   4's: ${row.teamCells[0].fours}   /   6's: ${row.teamCells[0].sixes}`}
                        </div>
                        </>
                    ) : (
                        <div style={{ opacity: 0.7 }}>–</div>
                    )}
                    </div>

                    {/* Team B cell */}
                    <div
                    style={{
                        fontSize: "0.8rem",
                        lineHeight: 1.8
                    }}
                    >
                    {row.teamCells[1] ? (
                        <>
                        <div>
                            {row.teamCells[1].runs}{" "}
                            {t("detailedMatch.phaseRunsLabel") || "runs"}{" "}
                            <span style={{ opacity: 0.85 }}>
                            / {row.teamCells[1].wickets}{" "}
                            {t("detailedMatch.phaseWicketsLabel") || "wickets"}
                            </span>
                        </div>
                        <div style={{ opacity: 0.9 }}>
                            {t("detailedMatch.phaseScoringShotPct") ||
                            "Scoring shot %"}
                            : {row.teamCells[1].scoring_pct}
                        </div>
                        <div style={{ opacity: 0.9 }}>
                            {`2's: ${row.teamCells[1].twos}   /   4's: ${row.teamCells[1].fours}   /   6's: ${row.teamCells[1].sixes}`}
                        </div>
                        </>
                    ) : (
                        <div style={{ opacity: 0.7 }}>–</div>
                    )}
                    </div>
                </div>
                ))}

            </div>
          )}
        </Card.Body>
      </Card>

      {/* Detail toggle "glass" cards (Ball-by-ball / Wagon wheels / Pitch maps) */}
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {[
            {
              id: "ballByBall",
              label: t("detailedMatch.btnBallByBall") || "Ball by ball",
              subLabel:
                t("detailedMatch.btnBallByBallSub") ||
                "Full delivery log",
            },
            {
              id: "wagon",
              label:
                t("detailedMatch.btnWagonWheels") ||
                "Match wagon wheels",
              subLabel:
                t("detailedMatch.btnWagonWheelsSub") ||
                "Scoring zones for this match",
            },
            {
              id: "pitch",
              label:
                t("detailedMatch.btnPitchMaps") ||
                "Match pitch maps",
              subLabel:
                t("detailedMatch.btnPitchMapsSub") ||
                "Bowling pitch map overview",
            },
          ].map((cfg) => {
            const isActive = activeDetail === cfg.id;
            return (
              <GlassCard
                key={cfg.id}
                active={activeDetail === cfg.id} 
                  onClick={() =>
                        setActiveDetail((prev) => (prev === cfg.id ? null : cfg.id))
                    }
                style={{
                  textAlign: "center",
                  padding: "12px 14px",
                  border: isActive
                    ? `1px solid ${theme.accentColor}`
                    : undefined,
                  boxShadow: isActive
                    ? `0 0 0 1px ${theme.accentColor}33`
                    : "none",
                }}
              >
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 2,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {cfg.label}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    opacity: 0.8,
                    color:
                      "var(--color-text-secondary, rgba(148,163,184,0.9))",
                  }}
                >
                  {cfg.subLabel}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>


      {/* Panel: Ball-by-ball */}
      {activeDetail === "ballByBall" && (
 <Card className="mt-3" style={cardStyle}>
        <Card.Body>
          <div
            style={{
              fontSize: "1rem",
              marginBottom: 8,
              fontWeight: 700,
            }}
          >
            {t("detailedMatch.ballByBallTitle") || "Ball-by-ball summary"}
          </div>

          {!ballsByInnings.length ? (
            <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
              {t("detailedMatch.noBallByBall") ||
                "No ball-by-ball data available for this match."}
            </div>
          ) : (
            <Row className="g-3">
              {ballsByInnings.map((block) => (
                <Col key={block.inningsNo} md={6}>
                  {/* Innings header */}
                  <div
                    style={{
                      fontSize: "0.85rem",
                      marginBottom: 6,
                      fontWeight: 600,
                    }}
                  >
                    {block.team} –{" "}
                    {block.inningsNo === 1
                      ? t("detailedMatch.innings1Label") || "1st innings"
                      : block.inningsNo === 2
                      ? t("detailedMatch.innings2Label") || "2nd innings"
                      : `${t("detailedMatch.inningsLabelShort") || "Inns"} ${
                          block.inningsNo
                        }`}
                  </div>

                  {!block.overs.length ? (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        opacity: 0.7,
                      }}
                    >
                      {t("detailedMatch.noBallByBallInnings") ||
                        "No deliveries recorded for this innings."}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {block.overs.map((over) => {
                        const overKey = `${block.inningsNo}_${over.overNum}`;
                        const isExpanded = !!expandedOvers[overKey];
                        const hasWicket = over.wickets > 0;

                        return (
                          <div
                            key={overKey}
                            style={{
                              borderRadius: 12,
                              border: isExpanded
                                ? `1px solid rgba(248,250,252,0.65)`
                                : "1px solid rgba(148,163,184,0.45)",
                              backgroundColor: isDarkMode
                                ? "rgba(15,23,42,0.9)"
                                : "rgba(248,250,252,0.95)",
                              boxShadow: isExpanded
                                ? "0 8px 22px rgba(0,0,0,0.45)"
                                : "0 4px 12px rgba(15,23,42,0.35)",
                              overflow: "hidden",
                            }}
                          >
                            {/* Over header (click to expand/collapse) */}
                            <div
                            onClick={() =>
                                setExpandedOvers((prev) => ({
                                ...prev,
                                [overKey]: !prev[overKey],
                                }))
                            }
                            style={{
                                position: "relative",
                                display: "grid",
                                gridTemplateColumns: "1.6fr 1fr auto", // left | numbers | chevron
                                columnGap: 8,
                                alignItems: "center",
                                padding: "6px 10px 6px 12px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                            }}
                            >
                            {/* Red accent strip if any wicket in this over */}
                            <div
                                style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 4,
                                borderRadius: "12px 0 0 12px",
                                backgroundColor: hasWicket ? "#ef4444" : "transparent",
                                }}
                            />

                            {/* Left column: Over + Bowler */}
                            <div style={{ paddingLeft: 10 }}>
                                <div style={{ fontWeight: 600 }}>
                                {t("detailedMatch.overLabel") || "Over"} {over.overNum}
                                </div>
                                <div
                                style={{
                                    opacity: 0.8,
                                    fontSize: "0.75rem",
                                }}
                                >
                                {over.bowler ||
                                    t("detailedMatch.colBowler") ||
                                    "Bowler"}
                                </div>
                            </div>

                            {/* Middle column: Runs + Wickets (aligned down the page) */}
                            <div
                                style={{
                                textAlign: "right",
                                fontSize: "0.8rem",
                                fontVariantNumeric: "tabular-nums", // keeps numbers nicely lined up
                                }}
                            >
                                <div style={{ fontWeight: 600 }}>
                                {over.totalRuns}{" "}
                                {t("detailedMatch.phaseRunsLabel") || "runs"}
                                </div>
                                <div style={{ opacity: 0.8 }}>
                                {over.wickets > 0
                                    ? `${over.wickets} ${
                                        t("detailedMatch.phaseWicketsShort") || "wkts"
                                    }`
                                    : t("detailedMatch.noWicketsOver") || "No wickets"}
                                </div>
                            </div>

                            {/* Right column: Chevron */}
                            <div
                                style={{
                                fontSize: "0.85rem",
                                opacity: 0.8,
                                }}
                            >
                                {isExpanded ? "▴" : "▾"}
                            </div>
                            </div>


                            {/* Over details (balls) */}
                            {isExpanded && (
                              <div
                                style={{
                                  padding: "6px 10px 8px 12px",
                                  borderTop: "1px solid rgba(148,163,184,0.35)",
                                  backgroundColor: isDarkMode
                                    ? "rgba(15,23,42,1)"
                                    : "rgba(255,255,255,0.98)",
                                }}
                              >
                                {over.balls.map((ball) => {
                                  const highlightBackground = ball.isWicket
                                    ? "rgba(248,113,113,0.12)" // red-ish
                                    : ball.isBoundary
                                    ? "rgba(34,197,94,0.10)" // green-ish
                                    : ball.isExtra
                                    ? "rgba(202, 199, 18, 0.1)"
                                    : "transparent";

                                  return (
                                    <div
                                      key={ball.key}
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns:
                                          "0.25fr 0.7fr 0.4fr 1fr 0.7fr",
                                        columnGap: 8,
                                        alignItems: "center",
                                        padding: "4px 6px",
                                        marginBottom: 3,
                                        borderRadius: 8,
                                        background: highlightBackground,
                                        borderLeft: ball.isWicket
                                          ? "3px solid #ef4444"
                                          : "3px solid transparent",
                                        fontSize: "0.78rem",
                                      }}
                                    >
                                      {/* Over.ball label */}
                                      <div
                                        style={{
                                          fontVariantNumeric:
                                            "tabular-nums",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {ball.label}
                                      </div>

                                      {/* Batter */}
                                      <div>
                                        {ball.batter || (
                                          <span style={{ opacity: 0.7 }}>
                                            {t(
                                              "detailedMatch.unknownBatter"
                                            ) || "Batter"}
                                          </span>
                                        )}
                                      </div>

                                    {/* Runs + extras (only show non-zero extras) */}
                                      <div
                                        style={{
                                          textAlign: "right",
                                          fontVariantNumeric: "tabular-nums",
                                          fontSize: "0.78rem",
                                        }}
                                      >
                                        {/* Runs off bat */}
                                        <div>
                                          {t(
                                            "detailedMatch.runsOffBatShort"
                                          ) || "Bat"}
                                          :{" "}
                                          <span
                                            style={{
                                              fontWeight: ball.isBoundary
                                                ? 700
                                                : 500,
                                            }}
                                          >
                                            {ball.runsOffBat}
                                          </span>
                                        </div>

                                        {/* Extras total */}
                                        <div style={{ marginTop: 2 }}>
                                          {t("detailedMatch.extrasLabel") ||
                                            "Extras"}
                                          :{" "}
                                          <span
                                            style={{
                                              fontWeight: 500,
                                              opacity:
                                                ball.extrasTotal > 0
                                                  ? 0.95
                                                  : 0.6,
                                            }}
                                          >
                                            {ball.extrasTotal}
                                          </span>
                                        </div>

                                        {/* Only show breakdown if there ARE extras */}
                                        {ball.extrasTotal > 0 && (() => {
                                          const lines = [];

                                          if (ball.wides > 0) {
                                            lines.push({
                                              key: "wide",
                                              label:
                                                t("detailedMatch.extrasWide") ||
                                                "Wide",
                                              value: ball.wides,
                                            });
                                          }
                                          if (ball.noBalls > 0) {
                                            lines.push({
                                              key: "nb",
                                              label:
                                                t("detailedMatch.extrasNoBall") ||
                                                "No ball",
                                              value: ball.noBalls,
                                            });
                                          }
                                          if (ball.byes > 0) {
                                            lines.push({
                                              key: "byes",
                                              label:
                                                t("detailedMatch.extrasByes") ||
                                                "Byes",
                                              value: ball.byes,
                                            });
                                          }
                                          if (ball.legByes > 0) {
                                            lines.push({
                                              key: "legbyes",
                                              label:
                                                t("detailedMatch.extrasLegByes") ||
                                                "Leg byes",
                                              value: ball.legByes,
                                            });
                                          }
                                          if (ball.penalty > 0) {
                                            lines.push({
                                              key: "penalty",
                                              label:
                                                t("detailedMatch.extrasPenalty") ||
                                                "Penalty",
                                              value: ball.penalty,
                                            });
                                          }

                                          if (!lines.length) return null;

                                          return (
                                            <div
                                              style={{
                                                marginTop: 2,
                                                opacity: 0.85,
                                              }}
                                            >
                                              {lines.map((ln) => (
                                                <div key={ln.key}>
                                                  {ln.label}: {ln.value}
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        })()}
                                      </div>

                                      {/* Dismissal / notes + More details */}
                                        <div
                                        style={{
                                            fontStyle: ball.isWicket ? "italic" : "normal",
                                            color: ball.isWicket ? "#b91c1c" : "inherit",
                                            textAlign: "right",
                                        }}
                                        >
                                        {ball.dismissalText ||
                                            (ball.isBoundary
                                            ? t("detailedMatch.boundaryNote") || "Boundary"
                                            : "")}
                                         </div>
                                         
                                         <div>
                                        {ball.hasDetail && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                            e.stopPropagation(); // don't toggle the over
                                            setBallDetails({
                                                ...ball,
                                                inningsNo: block.inningsNo,
                                                team: block.team,
                                                overNum: over.overNum,
                                                bowler: over.bowler,
                                            });
                                            setShowBallModal(true);
                                            }}
                                            style={{
                                            marginTop: 4,
                                            fontSize: "0.7rem",
                                            borderRadius: 999,
                                            padding: "2px 8px",
                                            border: "1px solid rgba(148,163,184,0.6)",
                                            backgroundColor: isDarkMode ? "rgba(15,23,42,0.95)" : "#e5e7eb",
                                            color: isDarkMode ? "#e5e7eb" : "#0f172a",
                                            display: "inline-flex",
                                            alignItems: "right",
                                            gap: 4,
                                            cursor: "pointer",
                                            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                                            }}
                                        >
                                            <span
                                            style={{
                                                fontSize: "0.8rem",
                                                opacity: 0.9,
                                            }}
                                            >
                                            🔍
                                            </span>
                                            <span style={{ fontWeight: 600 }}>
                                            {t("detailedMatch.moreDetails") || "More details"}
                                            </span>
                                        </button>
                                        )}

                                        </div>

                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Col>
              ))}
            </Row>
          )}
        </Card.Body>
      </Card>
      )}

      {/* Wagon wheels – match comparison */}
      {activeDetail === "wagon" && (
        <Card className="mt-3" style={cardStyle}>
          <Card.Body>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                }}
              >
                {t("detailedMatch.wagonTitle") || "Match wagon wheels"}
              </div>

              {/* Small hint text */}
              <div
                style={{
                  fontSize: "0.75rem",
                  opacity: 0.75,
                  color:
                    "var(--color-text-secondary, rgba(148,163,184,0.9))",
                  textAlign: "right",
                }}
              >
                {t("detailedMatch.wagonSubtitle") ||
                  "Visualising scoring zones for each innings"}
              </div>
            </div>

            {!wagonByInnings.length ? (
              <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                {t("detailedMatch.noWagonData") ||
                  "No wagon wheel data available for this match."}
              </div>
            ) : (
              <Row className="g-3">
                {wagonByInnings.map((block) => (
                  <Col md={6} key={block.inningsNo}>
                    <div
                      style={{
                        marginBottom: 6,
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {block.team} –{" "}
                      {block.inningsNo === 1
                        ? t("detailedMatch.innings1Label") || "1st innings"
                        : block.inningsNo === 2
                        ? t("detailedMatch.innings2Label") || "2nd innings"
                        : `${t("detailedMatch.inningsLabelShort") || "Inns"} ${
                            block.inningsNo
                          }`}
                    </div>
                    

                    <div
                      style={{
                        borderRadius: 14,
                        padding: 10,
                        backgroundColor: isDarkMode
                          ? "rgba(15,23,42,0.95)"
                          : "rgba(248,250,252,0.98)",
                        border:
                          "1px solid var(--color-border-subtle, rgba(148,163,184,0.45))",
                        boxShadow:
                          "0 10px 24px rgba(15,23,42,0.65)",
                      }}
                    >
                      <WagonWheelChart
                        data={block.balls}
                        perspective="Lines"
                        compact={false}
                      />
                    </div>
                  </Col>
                ))}
              </Row>
            )}
          </Card.Body>
        </Card>
      )}


      {/* Pitch maps – match comparison */}
      {activeDetail === "pitch" && (
        <Card className="mt-3" style={cardStyle}>
          <Card.Body>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                }}
              >
                {t("detailedMatch.pitchTitle") || "Match pitch maps"}
              </div>
              {/* Small hint text */}
              <div
                style={{
                  fontSize: "0.75rem",
                  opacity: 0.75,
                  color:
                    "var(--color-text-secondary, rgba(148,163,184,0.9))",
                  textAlign: "right",
                }}
              >
                {t("detailedMatch.pitchSubtitle") ||
                  "Balls bowled for each batting innings"}
              </div>
              {/* View mode toggle: Dots vs Heat */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  fontSize: "0.75rem",
                }}
              >
                {["Dots", "Heat"].map((mode) => {
                  const active = pitchViewMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPitchViewMode(mode)}
                      style={{
                        cursor: "pointer",
                        padding: "3px 10px",
                        borderRadius: 999,
                        border: active
                          ? `1px solid ${theme.accentColor}`
                          : "1px solid rgba(148,163,184,0.6)",
                        background: active
                          ? theme.accentColor
                          : isDarkMode
                          ? "rgba(15,23,42,0.95)"
                          : "rgba(241,245,249,0.9)",
                        color: active
                          ? "#020617"
                          : isDarkMode
                          ? "#e5e7eb"
                          : "#0f172a",
                        fontWeight: 600,
                        lineHeight: 1.1,
                      }}
                    >
                      {mode === "Dots"
                        ? t("detailedMatch.pitchModeDots") || "Dots"
                        : t("detailedMatch.pitchModeHeat") || "Heatmap"}
                    </button>
                  );
                })}
              </div>
            </div>

            {!pitchByInnings.length ? (
              <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                {t("detailedMatch.noPitchData") ||
                  "No pitch map data available for this match."}
              </div>
            ) : (
              <Row className="g-3">
                {pitchByInnings.map((block) => (
                  <Col md={6} key={block.inningsNo}>
                    <div
                      style={{
                        marginBottom: 6,
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {block.team} –{" "}
                      {block.inningsNo === 1
                        ? t("detailedMatch.innings1Label") || "1st innings"
                        : block.inningsNo === 2
                        ? t("detailedMatch.innings2Label") || "2nd innings"
                        : `${t("detailedMatch.inningsLabelShort") || "Inns"} ${
                            block.inningsNo
                          }`}
                    </div>

                    <div
                      style={{
                        borderRadius: 14,
                        padding: 10,
                        backgroundColor: isDarkMode
                          ? "rgba(15,23,42,0.95)"
                          : "rgba(248,250,252,0.98)",
                        border:
                          "1px solid var(--color-border-subtle, rgba(148,163,184,0.45))",
                        boxShadow:
                          "0 10px 24px rgba(15,23,42,0.65)",
                      }}
                    >
                      <PitchMapChart
                        data={block.balls}
                        viewMode={pitchViewMode}
                        compact={false}
                      />
                    </div>
                  </Col>
                ))}
              </Row>
            )}
          </Card.Body>
        </Card>
      )}

        {/* Ball details modal */}
        <Modal
        show={showBallModal && !!ballDetails}
        onHide={() => setShowBallModal(false)}
        size="lg"
        centered
        contentClassName="themed-modal-content"
        >
        <Modal.Header
            closeButton
            className="scorecard-modal-header-gradient"
        >
            <Modal.Title style={{ fontSize: "0.9rem" }}>
            {ballDetails && (
                <>
                {(t("detailedMatch.overLabel") || "Over")} {ballDetails.overNum},{" "}
                {ballDetails.label} –{" "}
                {ballDetails.batter ||
                    t("detailedMatch.unknownBatter") ||
                    "Batter"}
                </>
            )}
            </Modal.Title>
        </Modal.Header>

        <Modal.Body
            style={{
            backgroundColor: isDarkMode ? "#020617" : "#f9fafb",
            color: isDarkMode ? "#e5e7eb" : "#0f172a",
            fontSize: "0.8rem",
            }}
        >
            {ballDetails && (
            <>
                {/* Summary line */}
                <div style={{ marginBottom: 8, opacity: 0.9 }}>
                {ballDetails.team} –{" "}
                {t("detailedMatch.colBowler") || "Bowler"}:{" "}
                <strong>{ballDetails.bowler || "-"}</strong>
                {" • "}
                {t("detailedMatch.runsOffBatShort") || "Bat"}:{" "}
                <strong>{ballDetails.runsOffBat}</strong>
                {" • "}
                {t("detailedMatch.extrasLabel") || "Extras"}:{" "}
                <strong>{ballDetails.extrasTotal}</strong>
                {ballDetails.dismissalText && (
                    <>
                    {" • "}
                    <span style={{ color: "#b91c1c", fontStyle: "italic" }}>
                        {ballDetails.dismissalText}
                    </span>
                    </>
                )}
                </div>

                {/* Pitch map + Wagon wheel side by side */}
                <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 12,
                    marginBottom: 12,
                }}
                >
                {/* Pitch map */}
                <div>
                    <div
                    style={{
                        fontWeight: 600,
                        marginBottom: 4,
                    }}
                    >
                    {t("detailedMatch.pitchMapSingle") || "Pitch map"}
                    </div>
                    {ballDetails.hasPitch ? (
                    <PitchMapChart
                        data={[
                        {
                            ball_id: 1,
                            pitch_x: ballDetails.pitchXRaw,
                            pitch_y: ballDetails.pitchYRaw,
                            runs: ballDetails.runsOffBat,
                            wides: ballDetails.wides,
                            no_balls: ballDetails.noBalls,
                            dismissal_type: ballDetails.isWicket
                            ? "Wicket"
                            : null,
                        },
                        ]}
                        viewMode="Dots"
                        selectedBallId={null}
                        compact={true}
                        hideLegend={true}
                        disableUpload={true}
                    />
                    ) : (
                    <div
                        style={{
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,0.5)",
                        padding: 12,
                        fontSize: "0.75rem",
                        opacity: 0.7,
                        minHeight: 120,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        }}
                    >
                        {t("detailedMatch.noPitchForBall") ||
                        "No pitch location recorded for this ball."}
                    </div>
                    )}
                </div>

                {/* Wagon wheel */}
                <div>
                    <div
                    style={{
                        fontWeight: 600,
                        marginBottom: 4,
                    }}
                    >
                    {t("detailedMatch.wagonSingle") || "Wagon wheel"}
                    </div>
                    {ballDetails.hasWagon ? (
                    <WagonWheelChart
                        data={[
                        {
                            x: ballDetails.shotXRaw,
                            y: ballDetails.shotYRaw,
                            runs: ballDetails.runsOffBat,
                            dismissal_type: ballDetails.isWicket
                            ? "Wicket"
                            : null,
                            highlight: true,
                        },
                        ]}
                        perspective="Lines"
                        compact={true}
                        hideLegend={true}
                        disableUpload={true}
                    />
                    ) : (
                    <div
                        style={{
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,0.5)",
                        padding: 12,
                        fontSize: "0.75rem",
                        opacity: 0.7,
                        minHeight: 120,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        }}
                    >
                        {t("detailedMatch.noWagonForBall") ||
                        "No wagon wheel location recorded for this ball."}
                    </div>
                    )}
                </div>
                </div>

                {/* Extra info grid – same as we designed before */}
                <div
                style={{
                    borderTop: "1px solid rgba(148,163,184,0.35)",
                    paddingTop: 8,
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 8,
                    fontSize: "0.78rem",
                }}
                >
                {ballDetails.shotType && (
                    <div>
                    <strong>
                        {t("detailedMatch.shotTypeLabel") || "Shot type"}:
                    </strong>{" "}
                    {ballDetails.shotType}
                    </div>
                )}
                {ballDetails.footwork && (
                    <div>
                    <strong>
                        {t("detailedMatch.footworkLabel") || "Footwork"}:
                    </strong>{" "}
                    {ballDetails.footwork}
                    </div>
                )}
                {ballDetails.shotSelection && (
                    <div>
                    <strong>
                        {t("detailedMatch.shotSelectionLabel") ||
                        "Shot selection"}
                        :
                    </strong>{" "}
                    {ballDetails.shotSelection}
                    </div>
                )}
                {ballDetails.deliveryType && (
                    <div>
                    <strong>
                        {t("detailedMatch.deliveryTypeLabel") ||
                        "Delivery type"}
                        :
                    </strong>{" "}
                    {ballDetails.deliveryType}
                    </div>
                )}
                {ballDetails.aerial != null && (
                    <div>
                    <strong>
                        {t("detailedMatch.aerialLabel") || "Aerial"}:
                    </strong>{" "}
                    {ballDetails.aerial ? "Yes" : "No"}
                    </div>
                )}
                {ballDetails.edged == 1 && (
                    <div>
                    <strong>
                        {t("detailedMatch.edgedLabel") || "Edged"}:
                    </strong>{" "}
                    {t("detailedMatch.edgedYes") || "Yes"}
                    </div>
                )}
                {ballDetails.ballMissed == 1 && (
                    <div>
                    <strong>
                        {t("detailedMatch.missedLabel") || "Missed"}:
                    </strong>{" "}
                    {t("detailedMatch.missedYes") || "Yes"}
                    </div>
                )}
                {ballDetails.cleanHit == 1 && (
                    <div>
                    <strong>
                        {t("detailedMatch.cleanHitLabel") || "Clean hit"}:
                    </strong>{" "}
                    {t("detailedMatch.cleanHitYes") || "Middle of the bat"}
                    </div>
                )}
                {ballDetails.battingIntent != null && (
                    <div>
                    <strong>
                        {t("detailedMatch.intentLabel") || "Intent score"}:
                    </strong>{" "}
                    {ballDetails.battingIntent}
                    </div>
                )}
                </div>
            </>
            )}
        </Modal.Body>

        </Modal>


    </>
  );
};

export default DetailedMatchTab;
