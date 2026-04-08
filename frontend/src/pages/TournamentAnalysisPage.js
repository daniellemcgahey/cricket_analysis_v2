// src/pages/TournamentAnalysisPage.jsx
import React, { useContext, useEffect, useMemo, useState, } from "react";
import { Card, Alert, Spinner, Form, Row, Col, Modal } from "react-bootstrap";
import api from "../api";
import { useLanguage } from "../language/LanguageContext";
import DarkModeContext from "../DarkModeContext";
import GlassCard from "../components/GlassCard";
import { useTheme } from "../theme/ThemeContext";
import useUITheme from "../theme/useUITheme";
import { useAuth } from "../auth/AuthContext";
import { normalizeName, getFlagUrlForTeam } from "../utils/flags";
import MatchScorecardPage from "./MatchScorecardPage";

const TournamentAnalysisPage = () => {
  const { t } = useLanguage();
  const ui = useUITheme();
  const { isDarkMode } = useContext(DarkModeContext);
  const theme = useTheme();
  const { user } = useAuth();

  const teamName = theme.teamName;
  const teamCategory = user?.teamCategory || "Women";

  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("group");
  const [activeDetail, setActiveDetail] = useState(null);

  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState("");

  const [showOnlyOurPlayers, setShowOnlyOurPlayers] = useState(true);

  const [tournamentMatches, setTournamentMatches] = useState([]);
  const [tournamentTable, setTournamentTable] = useState([]);

  const [battingLeaders, setBattingLeaders] = useState({});
  const [loadingBattingLeaders, setLoadingBattingLeaders] = useState(false);
  const [battingLeadersError, setBattingLeadersError] = useState("");
  const [selectedBattingStat, setSelectedBattingStat] = useState("Most Runs");
  const [ourBattingPlayerNames, setOurBattingPlayerNames] = useState(new Set());
  const [battingPlayerCountryMap, setBattingPlayerCountryMap] = useState({});

  const [bowlingLeaders, setBowlingLeaders] = useState({});
  const [loadingBowlingLeaders, setLoadingBowlingLeaders] = useState(false);
  const [bowlingLeadersError, setBowlingLeadersError] = useState("");
  const [selectedBowlingStat, setSelectedBowlingStat] = useState("Most Wickets");
  const [bowlingPlayerCountryMap, setBowlingPlayerCountryMap] = useState({});

  const [fieldingLeaders, setFieldingLeaders] = useState({});
  const [loadingFieldingLeaders, setLoadingFieldingLeaders] = useState(false);
  const [fieldingLeadersError, setFieldingLeadersError] = useState("");
  const [selectedFieldingStat, setSelectedFieldingStat] = useState("Most Catches");
  const [fieldingPlayerCountryMap, setFieldingPlayerCountryMap] = useState({});

  const [selectedResultMatch, setSelectedResultMatch] = useState(null);
  const [showScorecardModal, setShowScorecardModal] = useState(false);

  const cardStyle = {
    backgroundColor: "var(--color-surface-elevated)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
    color: "var(--color-text-primary)",
    borderRadius: 12,
  };

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        setLoadingTournaments(true);
        setError("");

        const res = await api.get("/tournaments", {
          params: { team_category: teamCategory },
        });

        setTournaments(res.data || []);
      } catch (err) {
        console.error("Error loading tournaments", err);
        setError(
          err?.response?.data?.detail ||
            err.message ||
            "Error loading tournaments."
        );
      } finally {
        setLoadingTournaments(false);
      }
    };

    fetchTournaments();
  }, [teamCategory]);

  useEffect(() => {
    if (
      activeDetail !== "batting" ||
      !selectedTournament ||
      battingStatOptions.length === 0 ||
      tournamentMatches.length === 0
    ) {
      return;
    }

    const fetchBattingLeaders = async () => {
      try {
        setLoadingBattingLeaders(true);
        setBattingLeadersError("");

        const allTournamentTeams = Array.from(
          new Set(
            tournamentMatches.flatMap((m) => [m.team_a, m.team_b]).filter(Boolean)
          )
        ).sort();

        const visiblePayload = {
          team_category: teamCategory,
          tournament: selectedTournament,
          countries: showOnlyOurPlayers ? [teamName] : allTournamentTeams,
        };

        const visibleRes = await api.post("/tournament-leaders/batting", visiblePayload);
        const visibleData = visibleRes.data || {};
        setBattingLeaders(visibleData);

        // Build player -> country map by querying each team separately
        const perTeamResponses = await Promise.all(
          allTournamentTeams.map(async (countryName) => {
            try {
              const res = await api.post("/tournament-leaders/batting", {
                team_category: teamCategory,
                tournament: selectedTournament,
                countries: [countryName],
              });

              return {
                countryName,
                data: res.data || {},
              };
            } catch (err) {
              console.error(`Error loading batting leaders for ${countryName}`, err);
              return {
                countryName,
                data: {},
              };
            }
          })
        );

        const nextPlayerCountryMap = {};

        perTeamResponses.forEach(({ countryName, data }) => {
          Object.values(data).forEach((list) => {
            if (!Array.isArray(list)) return;

            list.forEach((player) => {
              const key = normalizeName(player?.name);
              if (key) {
                nextPlayerCountryMap[key] = countryName;
              }
            });
          });
        });

        setBattingPlayerCountryMap(nextPlayerCountryMap);
      } catch (err) {
        console.error("Error loading batting leaders", err);
        console.error("Batting leader response detail:", err?.response?.data);
        setBattingLeaders({});
        setBattingPlayerCountryMap({});
        setBattingLeadersError(
          err?.response?.data?.detail ||
            err.message ||
            "Error loading batting leaderboards."
        );
      } finally {
        setLoadingBattingLeaders(false);
      }
    };

    fetchBattingLeaders();
  }, [
    activeDetail,
    selectedTournament,
    teamCategory,
    showOnlyOurPlayers,
    teamName,
    tournamentMatches,
  ]);

  useEffect(() => {
    if (
      activeDetail !== "bowling" ||
      !selectedTournament ||
      bowlingStatOptions.length === 0 ||
      tournamentMatches.length === 0
    ) {
      return;
    }

    const fetchBowlingLeaders = async () => {
      try {
        setLoadingBowlingLeaders(true);
        setBowlingLeadersError("");

        const allTournamentTeams = Array.from(
          new Set(
            tournamentMatches.flatMap((m) => [m.team_a, m.team_b]).filter(Boolean)
          )
        ).sort();

        const visiblePayload = {
          team_category: teamCategory,
          tournament: selectedTournament,
          countries: showOnlyOurPlayers ? [teamName] : allTournamentTeams,
        };

        const visibleRes = await api.post("/tournament-leaders/bowling", visiblePayload);
        const visibleData = visibleRes.data || {};
        setBowlingLeaders(visibleData);

        const perTeamResponses = await Promise.all(
          allTournamentTeams.map(async (countryName) => {
            try {
              const res = await api.post("/tournament-leaders/bowling", {
                team_category: teamCategory,
                tournament: selectedTournament,
                countries: [countryName],
              });

              return { countryName, data: res.data || {} };
            } catch (err) {
              console.error(`Error loading bowling leaders for ${countryName}`, err);
              return { countryName, data: {} };
            }
          })
        );

        const nextPlayerCountryMap = {};
        perTeamResponses.forEach(({ countryName, data }) => {
          Object.values(data).forEach((list) => {
            if (!Array.isArray(list)) return;
            list.forEach((player) => {
              const key = normalizeName(player?.name);
              if (key) nextPlayerCountryMap[key] = countryName;
            });
          });
        });

        setBowlingPlayerCountryMap(nextPlayerCountryMap);
      } catch (err) {
        console.error("Error loading bowling leaders", err);
        setBowlingLeaders({});
        setBowlingPlayerCountryMap({});
        setBowlingLeadersError(
          err?.response?.data?.detail ||
            err.message ||
            "Error loading bowling leaderboards."
        );
      } finally {
        setLoadingBowlingLeaders(false);
      }
    };

    fetchBowlingLeaders();
  }, [
    activeDetail,
    selectedTournament,
    teamCategory,
    showOnlyOurPlayers,
    teamName,
    tournamentMatches,
  ]);

  useEffect(() => {
    if (
      activeDetail !== "fielding" ||
      !selectedTournament ||
      fieldingStatOptions.length === 0 ||
      tournamentMatches.length === 0
    ) {
      return;
    }

    const fetchFieldingLeaders = async () => {
      try {
        setLoadingFieldingLeaders(true);
        setFieldingLeadersError("");

        const allTournamentTeams = Array.from(
          new Set(
            tournamentMatches.flatMap((m) => [m.team_a, m.team_b]).filter(Boolean)
          )
        ).sort();

        const visiblePayload = {
          team_category: teamCategory,
          tournament: selectedTournament,
          countries: showOnlyOurPlayers ? [teamName] : allTournamentTeams,
        };

        const visibleRes = await api.post("/tournament-leaders/fielding", visiblePayload);
        const visibleData = visibleRes.data || {};
        setFieldingLeaders(visibleData);

        const perTeamResponses = await Promise.all(
          allTournamentTeams.map(async (countryName) => {
            try {
              const res = await api.post("/tournament-leaders/fielding", {
                team_category: teamCategory,
                tournament: selectedTournament,
                countries: [countryName],
              });

              return { countryName, data: res.data || {} };
            } catch (err) {
              console.error(`Error loading fielding leaders for ${countryName}`, err);
              return { countryName, data: {} };
            }
          })
        );

        const nextPlayerCountryMap = {};
        perTeamResponses.forEach(({ countryName, data }) => {
          Object.values(data).forEach((list) => {
            if (!Array.isArray(list)) return;
            list.forEach((player) => {
              const key = normalizeName(player?.name);
              if (key) nextPlayerCountryMap[key] = countryName;
            });
          });
        });

        setFieldingPlayerCountryMap(nextPlayerCountryMap);
      } catch (err) {
        console.error("Error loading fielding leaders", err);
        setFieldingLeaders({});
        setFieldingPlayerCountryMap({});
        setFieldingLeadersError(
          err?.response?.data?.detail ||
            err.message ||
            "Error loading fielding leaderboards."
        );
      } finally {
        setLoadingFieldingLeaders(false);
      }
    };

    fetchFieldingLeaders();
  }, [
    activeDetail,
    selectedTournament,
    teamCategory,
    showOnlyOurPlayers,
    teamName,
    tournamentMatches,
  ]);

  useEffect(() => {
    if (!selectedTournament) {
      setLoadingPage(false);
      setTournamentMatches([]);
      setTournamentTable([]);
      return;
    }

    const bootstrapTournamentPage = async () => {
      try {
        setLoadingPage(true);
        setError("");

        const matchesRes = await api.get("/matches", {
          params: { teamCategory },
        });

        const allMatches = matchesRes.data || [];
        const filteredMatches = allMatches.filter(
          (m) => m.tournament === selectedTournament
        );

        // Pull scorecard results for each match
        const enrichedMatches = await Promise.all(
          filteredMatches.map(async (match) => {
            try {
              const scorecardRes = await api.post("/match-scorecard", {
                team_category: teamCategory,
                tournament: match.tournament,
                match_id: match.match_id,
              });

              return {
                ...match,
                resolvedResult: scorecardRes.data?.result || match.result || "",
              };
            } catch (err) {
              console.error(
                `Error loading scorecard result for match ${match.match_id}`,
                err
              );

              return {
                ...match,
                resolvedResult: match.result || "",
              };
            }
          })
        );

        setTournamentMatches(enrichedMatches);

        const standingsRes = await api.post("/tournament-standings", {
          team_category: teamCategory,
          tournament: selectedTournament,
        });

        setTournamentTable(standingsRes.data || []);
      } catch (err) {
        console.error("Error preparing tournament page", err);
        setError(
          err?.response?.data?.detail ||
            err.message ||
            "Error preparing tournament page."
        );
      } finally {
        setLoadingPage(false);
      }
    };

    bootstrapTournamentPage();
  }, [selectedTournament, teamCategory]);

  const tournamentStageOptions = useMemo(() => {
    if (!selectedTournament) return [];

    // Temporary hardcoded config for this tournament.
    // Later this should come from the DB.
    return [
      {
        id: "group",
        name: "Round Robin",
        type: "league",
        teamsCount: 6,
        matchesPerTeam: 5,
        qualifyTop: 3,
        qualifyBottom: 3,
        nextStageTopLabel: "Super League",
        nextStageBottomLabel: "Plate League",
        advancementLine: 3,
        status: "current",
      },
      {
        id: "super_league",
        name: "Super League",
        type: "league",
        teamsCount: 3,
        matchesPerTeam: 2,
        qualifyTop: 2,
        advancementLine: 2,
        nextStageTopLabel: "Final",
        status: "upcoming",
      },
      {
        id: "plate_league",
        name: "Plate League",
        type: "league",
        teamsCount: 3,
        matchesPerTeam: 2,
        qualifyTop: 1,
        advancementLine: 1,
        nextStageTopLabel: "3rd Place Playoff",
        status: "upcoming",
      },
    ];
  }, [selectedTournament]);

  const currentStage =
    tournamentStageOptions.find((s) => s.status === "current") ||
    tournamentStageOptions[0] ||
    null;

  const availableStageOptions = tournamentStageOptions.filter(
    (s) => s.status === "current" || s.status === "completed"
  );

  const selectedStage =
    availableStageOptions.find((s) => s.id === selectedStageId) ||
    currentStage ||
    null;

  useEffect(() => {
    if (availableStageOptions.length > 0) {
      setSelectedStageId(availableStageOptions[0].id);
    }
  }, [selectedTournament, availableStageOptions]);

  const standingsWithMath = useMemo(() => {
    if (!selectedStage || !tournamentTable.length) return [];

    const POINTS_PER_WIN = 2;
    const matchesPerTeam = selectedStage.matchesPerTeam || 0;
    const advancementLine = selectedStage.advancementLine || 1;

    const enriched = tournamentTable.map((row) => {
      const played = Number(row.played || 0);
      const points = Number(row.points || 0);
      const gamesRemaining = Math.max(matchesPerTeam - played, 0);
      const maxPossiblePoints = points + gamesRemaining * POINTS_PER_WIN;

      return {
        ...row,
        played,
        points,
        wins: Number(row.wins || 0),
        losses: Number(row.losses || 0),
        no_results: Number(row.no_results || 0),
        nrr: typeof row.nrr === "number" ? row.nrr : Number(row.nrr || 0),
        gamesRemaining,
        maxPossiblePoints,
        status: "alive",
        bracketLabel: "",
      };
    });

    return enriched.map((team, idx, arr) => {
      const cutoffTeam = arr[advancementLine - 1];
      const cutoffPoints = cutoffTeam?.points ?? 0;

      const teamsThatCanStillReachTeam = arr.filter(
        (other) =>
          other.team !== team.team &&
          other.maxPossiblePoints >= team.points
      ).length;

      const qualifiedTop = teamsThatCanStillReachTeam < advancementLine;
      const eliminatedTop = team.maxPossiblePoints < cutoffPoints;

      let status = "alive";
      if (qualifiedTop) {
        status = "qualified";
      } else if (eliminatedTop) {
        status = "eliminated";
      }

      let bracketLabel = "";

      // Only assign next-stage brackets while viewing the current group stage.
      if (selectedStage.id === "group") {
        if (qualifiedTop) {
          bracketLabel = selectedStage.nextStageTopLabel || "Super League";
        } else if (eliminatedTop) {
          bracketLabel = selectedStage.nextStageBottomLabel || "Plate League";
        } else {
          bracketLabel = "";
        }
      }

      return {
        ...team,
        status,
        rank: idx + 1,
        isCutoff: idx === advancementLine - 1,
        bracketLabel,
      };
    });
  }, [tournamentTable, selectedStage]);

  const getStandingsRowStyle = (row) => {
    const base = {
      transition: "all 0.2s ease",
      borderRadius: 12,
      overflow: "hidden",
    };

    if (row.status === "qualified") {
      return {
        ...base,
        background: isDarkMode
          ? "linear-gradient(90deg, rgba(34,197,94,0.20), rgba(34,197,94,0.08))"
          : "linear-gradient(90deg, rgba(34,197,94,0.18), rgba(34,197,94,0.06))",
        boxShadow: "inset 4px 0 0 #22c55e",
      };
    }

    if (row.status === "eliminated") {
      return {
        ...base,
        background: isDarkMode
          ? "linear-gradient(90deg, rgba(239,68,68,0.18), rgba(239,68,68,0.07))"
          : "linear-gradient(90deg, rgba(239,68,68,0.14), rgba(239,68,68,0.05))",
        boxShadow: "inset 4px 0 0 #ef4444",
      };
    }

    return {
      ...base,
      background: isDarkMode
        ? "rgba(255,255,255,0.02)"
        : "rgba(255,255,255,0.55)",
    };
  };


  const battingStatOptions = [
    "Most Runs",
    "High Scores",
    "Highest Averages",
    "Highest Strike Rates",
    "Most Fifties and Over",
    "Most Ducks",
    "Most Fours",
    "Most Sixes",
    "Highest Average Intent",
    "Highest Scoring Shot %",
  ];

  const battingStatMeta = {
    "Most Runs": {
      keyLabel: t("tournament.battingMostRunsValue") || "Runs",
      getValue: (p) => p.runs,
      subFields: [
        { label: t("tournament.matchesShort") || "Mat", value: (p) => p.matches },
        { label: t("tournament.inningsShort") || "Inns", value: (p) => p.innings },
      ],
    },
    "High Scores": {
      keyLabel: t("tournament.battingHighScoreValue") || "High Score",
      getValue: (p) => p.high_score,
      subFields: [],
    },
    "Highest Averages": {
      keyLabel: t("tournament.battingAverageValue") || "Average",
      getValue: (p) => p.average,
      subFields: [],
    },
    "Highest Strike Rates": {
      keyLabel: t("tournament.battingStrikeRateValue") || "SR",
      getValue: (p) => p.strike_rate,
      subFields: [
        { label: t("tournament.ballsShort") || "Balls", value: (p) => p.balls_faced },
      ],
    },
    "Most Fifties and Over": {
      keyLabel: t("tournament.battingFiftiesValue") || "50+",
      getValue: (p) => p.fifties,
      subFields: [],
    },
    "Most Ducks": {
      keyLabel: t("tournament.battingDucksValue") || "Ducks",
      getValue: (p) => p.ducks,
      subFields: [],
    },
    "Most Fours": {
      keyLabel: t("tournament.battingFoursValue") || "Fours",
      getValue: (p) => p.fours,
      subFields: [],
    },
    "Most Sixes": {
      keyLabel: t("tournament.battingSixesValue") || "Sixes",
      getValue: (p) => p.sixes,
      subFields: [],
    },
    "Highest Average Intent": {
      keyLabel: t("tournament.battingIntentValue") || "Intent",
      getValue: (p) => p.average_intent,
      subFields: [],
    },
    "Highest Scoring Shot %": {
      keyLabel: t("tournament.battingScoringShotValue") || "Scoring %",
      getValue: (p) => `${p.scoring_shot_percentage}%`,
      subFields: [],
    },
  };

  const bowlingStatOptions = [
    "Most Wickets",
    "Best Bowling Figures",
    "Best Averages",
    "Best Economy Rates",
    "Best Strike Rates",
    "Most 3+ Wickets",
    "Most Dot Balls",
    "Most Wides",
    "Most No Balls",
  ];

  const bowlingStatMeta = {
    "Most Wickets": {
      keyLabel: t("tournament.bowlingMostWicketsValue") || "Wickets",
      getValue: (p) => p.wickets,
      subFields: [],
    },
    "Best Bowling Figures": {
      keyLabel: t("tournament.bowlingBestFiguresValue") || "Figures",
      getValue: (p) => p.figures,
      subFields: [
        { label: t("tournament.opponentShort") || "Opp", value: (p) => p.opponent },
      ],
    },
    "Best Averages": {
      keyLabel: t("tournament.bowlingAverageValue") || "Average",
      getValue: (p) =>
        typeof p.average === "number" ? p.average.toFixed(2) : p.average,
      subFields: [
        { label: t("tournament.wicketsShort") || "Wkts", value: (p) => p.wickets },
      ],
    },
    "Best Economy Rates": {
      keyLabel: t("tournament.bowlingEconomyValue") || "Econ",
      getValue: (p) =>
        typeof p.economy === "number" ? p.economy.toFixed(2) : p.economy,
      subFields: [],
    },
    "Best Strike Rates": {
      keyLabel: t("tournament.bowlingStrikeRateValue") || "SR",
      getValue: (p) =>
        typeof p.strike_rate === "number" ? p.strike_rate.toFixed(2) : p.strike_rate,
      subFields: [
        { label: t("tournament.wicketsShort") || "Wkts", value: (p) => p.wickets },
      ],
    },
    "Most 3+ Wickets": {
      keyLabel: t("tournament.bowlingThreePlusValue") || "3+ Hauls",
      getValue: (p) => p.value ?? p.three_plus,
      subFields: [],
    },
    "Most Dot Balls": {
      keyLabel: t("tournament.bowlingDotBallsValue") || "Dots",
      getValue: (p) => p.dot_balls ?? p.dots ?? p.value,
      subFields: [],
    },
    "Most Wides": {
      keyLabel: t("tournament.bowlingWidesValue") || "Wides",
      getValue: (p) => p.wides ?? p.value,
      subFields: [],
    },
    "Most No Balls": {
      keyLabel: t("tournament.bowlingNoBallsValue") || "No Balls",
      getValue: (p) => p.no_balls ?? p.value,
      subFields: [],
    },
  };

  const fieldingStatOptions = [
    "Most Catches",
    "Most Run Outs",
    "Most Dismissals",
    "Best Conversion Rate",
    "Cleanest Hands",
    "WK Catches",
  ];

  const fieldingStatMeta = {
    "Most Catches": {
      keyLabel: t("tournament.fieldingCatchesValue") || "Catches",
      getValue: (p) => p.value,
      subFields: [],
    },
    "Most Run Outs": {
      keyLabel: t("tournament.fieldingRunOutsValue") || "Run Outs",
      getValue: (p) => p.value,
      subFields: [],
    },
    "Most Dismissals": {
      keyLabel: t("tournament.fieldingDismissalsValue") || "Dismissals",
      getValue: (p) => p.value,
      subFields: [],
    },
    "Best Conversion Rate": {
      keyLabel: t("tournament.fieldingConversionValue") || "Conversion %",
      getValue: (p) =>
        typeof p.value === "number" ? `${p.value.toFixed(1)}%` : p.value,
      subFields: [],
    },
    "Cleanest Hands": {
      keyLabel: t("tournament.fieldingCleanHandsValue") || "Clean Hands %",
      getValue: (p) =>
        typeof p.value === "number" ? `${p.value.toFixed(1)}%` : p.value,
      subFields: [],
    },
    "WK Catches": {
      keyLabel: t("tournament.fieldingWKCatchesValue") || "WK Catches",
      getValue: (p) => p.value,
      subFields: [],
    },
  };

  if (loadingTournaments) {
    return (
      <div className="d-flex align-items-center gap-2">
        <Spinner animation="border" size="sm" />
        <span style={{ fontSize: "0.9rem" }}>
          {t("tournament.loading") || "Loading tournaments…"}
        </span>
      </div>
    );
  }

  if (error && tournaments.length === 0) {
    return (
      <Alert variant="danger" style={{ fontSize: "0.9rem" }}>
        {t("tournament.error") || "There was a problem loading tournaments."}
        <br />
        <small>{error}</small>
      </Alert>
    );
  }

  return (
    <>
      <Card
        className="mb-3 position-relative"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor}33, ${theme.accentColor}33)`,
          border: `1px solid ${ui.border.subtle}`,
          color: ui.text.primary,
          borderRadius: "1rem",
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
            borderTopLeftRadius: "1rem",
            borderBottomLeftRadius: "1rem",
          }}
        />

        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div>
              <Card.Title className="mb-1" style={{ fontWeight: 700 }}>
                {t("tournamentAnalysis.title") || "Tournament analysis"}
              </Card.Title>
              <small style={{ color: ui.text.secondary }}>
                {t("tournamentAnalysis.subtitle") ||
                  "Choose a tournament, then explore results, standings and leaderboards."}
              </small>
            </div>

            <div className="text-end d-none d-md-block">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 8,
                  fontWeight: 600,
                }}
              >
                {theme.flagUrl && (
                  <img
                    src={theme.flagUrl}
                    alt={t("home.teamFlagAlt") || "Team flag"}
                    style={{
                      width: 56,
                      height: 36,
                      borderRadius: 6,
                      objectFit: "cover",
                      boxShadow: "0 0 10px rgba(0,0,0,0.6)",
                    }}
                  />
                )}
                <span>{teamName}</span>
              </div>
            </div>
          </div>

          {error && (
            <Alert
              variant="danger"
              className="py-2 mb-2"
              style={{ fontSize: "0.85rem" }}
            >
              {error}
            </Alert>
          )}

          {!loadingTournaments && tournaments.length === 0 && !error && (
            <Alert
              variant="info"
              className="py-2 mb-0"
              style={{ fontSize: "0.85rem" }}
            >
              {t("tournamentAnalysis.noTournaments") ||
                "No tournaments found for this team yet. Once tournaments are recorded, you’ll be able to analyse them here."}
            </Alert>
          )}

          {tournaments.length > 0 && (
            <Row className="g-3 align-items-end mt-1">
              <Col md={6}>
                <Form.Group controlId="tournamentAnalysisTournament">
                  <Form.Label className="mb-1" style={{ fontSize: "0.85rem" }}>
                    {t("tournamentAnalysis.tournamentLabel") || "Tournament"}
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={selectedTournament}
                    onChange={(e) => {
                      setSelectedTournament(e.target.value);
                      setActiveDetail(null);
                    }}
                  >
                    <option value="">
                      {t("tournamentAnalysis.tournamentPlaceholder") ||
                        "Select tournament"}
                    </option>
                    {tournaments.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={6} className="d-flex justify-content-md-end align-items-end">
                <Form.Group controlId="tournamentAnalysisScope">
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: 3,
                      borderRadius: 999,
                      backgroundColor: isDarkMode
                        ? "rgba(15,23,42,0.72)"
                        : "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(148,163,184,0.35)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowOnlyOurPlayers(true)}
                      style={{
                        border: "none",
                        borderRadius: 999,
                        padding: "7px 12px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        transition: "all 0.25s ease",
                        background: showOnlyOurPlayers
                          ? theme.accentColor
                          : "transparent",
                        color: showOnlyOurPlayers
                          ? "#020617"
                          : "var(--color-text-primary)",
                        boxShadow: showOnlyOurPlayers
                          ? "0 4px 12px rgba(0,0,0,0.22)"
                          : "none",
                        opacity: showOnlyOurPlayers ? 1 : 0.8,
                      }}
                    >
                      {t("tournamentAnalysis.scopeOurPlayers") || "Our players"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowOnlyOurPlayers(false)}
                      style={{
                        border: "none",
                        borderRadius: 999,
                        padding: "7px 12px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        transition: "all 0.25s ease",
                        background: !showOnlyOurPlayers
                          ? theme.accentColor
                          : "transparent",
                        color: !showOnlyOurPlayers
                          ? "#020617"
                          : "var(--color-text-primary)",
                        boxShadow: !showOnlyOurPlayers
                          ? "0 4px 12px rgba(0,0,0,0.22)"
                          : "none",
                        opacity: !showOnlyOurPlayers ? 1 : 0.8,
                      }}
                    >
                      {t("tournamentAnalysis.scopeTournamentWide") ||
                        "Tournament-wide"}
                    </button>
                  </div>
                </Form.Group>
              </Col>
            </Row>
          )}

          {selectedTournament && (
            <div
              className="mt-3 p-2 rounded"
              style={{
                fontSize: "0.8rem",
                backgroundColor: "rgba(15,23,42,0.55)",
                border: "1px solid rgba(148,163,184,0.5)",
              }}
            >
              <strong>
                {t("tournamentAnalysis.selectedTournamentLabel") ||
                  "Selected tournament"}
                :
              </strong>{" "}
              {selectedTournament}
              <span style={{ opacity: 0.75 }}>
                {" • "}
                {showOnlyOurPlayers
                  ? t("tournamentAnalysis.scopeOurPlayers") || "Our players"
                  : t("tournamentAnalysis.scopeTournamentWide") ||
                    "Tournament-wide"}
              </span>
            </div>
          )}
        </Card.Body>
      </Card>

      {!selectedTournament ? (
        <Alert variant="info" style={{ fontSize: "0.9rem" }}>
          {t("tournament.selectTournamentHint") ||
            "Select a tournament above to view tournament details."}
        </Alert>
      ) : (
        <>
          <Card className="mb-3" style={cardStyle}>
            <Card.Body style={{ minHeight: 420 }}>
              <div
                style={{
                  fontSize: "1rem",
                  marginBottom: 10,
                  fontWeight: 700,
                }}
              >
                {t("tournament.overviewTitle") || "Tournament overview"}
              </div>

              {loadingPage ? (
                <div className="d-flex align-items-center gap-2">
                  <Spinner animation="border" size="sm" />
                  <span style={{ fontSize: "0.9rem" }}>
                    {t("tournament.preparing") || "Preparing tournament page…"}
                  </span>
                </div>
              ) : (
                <Row className="g-3">

                  {/* Results */}
                  <Col md={4}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 18,
                        border: "1px solid rgba(148,163,184,0.28)",
                        background: isDarkMode
                          ? "linear-gradient(180deg, rgba(15,23,42,0.78), rgba(15,23,42,0.62))"
                          : "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(248,250,252,0.74))",
                        padding: 14,
                        boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.96rem",
                          fontWeight: 700,
                          marginBottom: 10,
                        }}
                      >
                        {t("tournament.resultsTitle") || "Match Results"}
                      </div>

                      {tournamentMatches.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                            flex: 1,
                            maxHeight: 800,
                            overflowY: tournamentMatches.length > 4 ? "auto" : "visible",
                            paddingRight: tournamentMatches.length > 4 ? 4 : 0,
                            scrollbarWidth: "thin",
                          }}
                        >
                          {tournamentMatches.map((match, idx) => {
                            const isOurMatch =
                              [match.team_a, match.team_b]
                                .map((x) => String(x || "").trim().toLowerCase())
                                .includes(String(teamName || "").trim().toLowerCase());

                            return (
                            <div
                              key={match.match_id || idx}
                              onClick={() => {
                                setSelectedResultMatch(match);
                                setShowScorecardModal(true);
                              }}
                              style={{
                                position: "relative",
                                flex: 1,
                                minHeight: 60,
                                borderRadius: 14,
                                padding: "12px 12px 12px 14px",
                                cursor: "pointer",
                                transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
                                background: isOurMatch
                                  ? isDarkMode
                                    ? "linear-gradient(180deg, rgba(30,41,59,0.9), rgba(15,23,42,0.88))"
                                    : "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(241,245,249,0.95))"
                                  : isDarkMode
                                  ? "rgba(255,255,255,0.03)"
                                  : "rgba(255,255,255,0.65)",
                                border: isOurMatch
                                  ? `1px solid ${theme.accentColor}`
                                  : "1px solid rgba(148,163,184,0.18)",
                                boxShadow: isOurMatch
                                  ? `0 0 0 1px ${theme.accentColor}22, 0 8px 18px rgba(0,0,0,0.18)`
                                  : "0 4px 12px rgba(0,0,0,0.08)",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                              }}
                            >

                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    gap: 10,
                                    marginBottom: 6,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: "0.72rem",
                                      fontWeight: 600,
                                      lineHeight: 1.25,
                                    }}
                                  >
                                    {match.team_a} vs {match.team_b}

                                  </div>

                                  <div
                                    style={{
                                      fontSize: "0.55rem",
                                      opacity: 0.72,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {match.match_date || "—"}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    fontSize: "0.55rem",
                                    opacity: 0.92,
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {match.resolvedResult ||
                                    match.result ||
                                    t("tournament.resultTbc") ||
                                    "Result TBC"}
                                </div>
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: "0.52rem",
                                    opacity: 0.58,
                                    letterSpacing: "0.02em",
                                  }}
                                >
                                  {t("tournament.clickForScorecard") || "Click to view scorecard"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                          {t("tournament.noResults") || "No match results available yet."}
                        </div>
                      )}
                    </div>
                  </Col>

                  {/* Points table */}
                  <Col md={8}>
                    <div
                      style={{
                        height: "100%",
                        minHeight: 320,
                        borderRadius: 18,
                        border: "1px solid rgba(148,163,184,0.28)",
                        background: isDarkMode
                          ? "linear-gradient(180deg, rgba(15,23,42,0.78), rgba(15,23,42,0.62))"
                          : "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(248,250,252,0.74))",
                        padding: 14,
                        boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "0.96rem",
                              fontWeight: 700,
                              marginBottom: 2,
                            }}
                          >
                            {t("tournament.pointsTableTitle") || "Points Table"}
                          </div>
                          <div
                            style={{
                              fontSize: "0.74rem",
                              opacity: 0.72,
                            }}
                          >
                            {selectedStage?.name || "Stage standings"}
                          </div>
                        </div>

                        <div>
                          {availableStageOptions.length > 1 ? (
                            <Form.Select
                              size="sm"
                              value={selectedStageId}
                              onChange={(e) => setSelectedStageId(e.target.value)}
                              style={{
                                minWidth: 180,
                                borderRadius: 999,
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                backgroundColor: isDarkMode
                                  ? "rgba(15,23,42,0.92)"
                                  : "rgba(255,255,255,0.96)",
                                color: "var(--color-text-primary)",
                                border: "1px solid rgba(148,163,184,0.35)",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                              }}
                            >
                              {availableStageOptions.map((stage) => (
                                <option key={stage.id} value={stage.id}>
                                  {stage.name}
                                </option>
                              ))}
                            </Form.Select>
                          ) : (
                            <div
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                padding: "6px 12px",
                                borderRadius: 999,
                                backgroundColor: isDarkMode
                                  ? "rgba(30,41,59,0.72)"
                                  : "rgba(255,255,255,0.72)",
                                border: "1px solid rgba(148,163,184,0.25)",
                              }}
                            >
                              {currentStage?.name || "Round Robin"}
                            </div>
                          )}
                        </div>
                      </div>

                      {standingsWithMath.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          {/* Header */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "0.45fr 1.5fr 0.95fr 0.5fr 0.5fr 0.5fr 0.6fr 0.8fr 0.8fr",
                              columnGap: 8,
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              opacity: 0.72,
                              padding: "0 10px",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            <div>#</div>
                            <div>{t("tournament.teamShort") || "Team"}</div>
                            <div>{t("tournament.stageShort") || "Next stage"}</div>
                            <div>{t("tournament.playedShort") || "P"}</div>
                            <div>{t("tournament.winsShort") || "W"}</div>
                            <div>{t("tournament.lossesShort") || "L"}</div>
                            <div>{t("tournament.pointsShort") || "Pts"}</div>
                            <div>{t("tournament.nrrShort") || "NRR"}</div>
                            <div>{t("tournament.maxPtsShort") || "Max"}</div>
                          </div>

                          {/* Rows */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                            }}
                          >
                            {standingsWithMath.map((row) => {
                              const isOurTeam =
                                String(row.team || "").trim().toLowerCase() ===
                                String(teamName || "").trim().toLowerCase();

                              return (
                                <React.Fragment key={row.team}>
                                  <div
                                    style={{
                                      ...getStandingsRowStyle(row),
                                      display: "grid",
                                      gridTemplateColumns: "0.45fr 1.5fr 0.95fr 0.5fr 0.5fr 0.5fr 0.6fr 0.8fr 0.8fr",
                                      columnGap: 8,
                                      alignItems: "center",
                                      padding: "10px 12px",
                                      fontSize: "0.8rem",
                                      border: isOurTeam
                                        ? `1px solid ${theme.accentColor}`
                                        : "1px solid rgba(148,163,184,0.14)",
                                      boxShadow: isOurTeam
                                        ? `0 0 0 1px ${theme.accentColor}33, 0 8px 20px rgba(0,0,0,0.16)`
                                        : getStandingsRowStyle(row).boxShadow,
                                    }}
                                  >
                                    <div style={{ fontWeight: 700, opacity: 0.9 }}>
                                      {row.rank}
                                    </div>

                                    <div>
                                      <div style={{ fontWeight: 700, lineHeight: 1.15 }}>
                                        {row.team}

                                      </div>
                                      <div
                                        style={{
                                          fontSize: "0.68rem",
                                          opacity: 0.68,
                                          marginTop: 2,
                                        }}
                                      >
                                        {row.status === "qualified"
                                          ? t("tournament.statusQualified") || "Qualified"
                                          : row.status === "eliminated"
                                          ? t("tournament.statusEliminated") || "Eliminated"
                                          : t("tournament.statusAlive") || "Alive"}
                                      </div>
                                    </div>

                                    <div>
                                      {row.bracketLabel ? (
                                        <span
                                          style={{
                                            display: "inline-block",
                                            padding: "4px 8px",
                                            borderRadius: 999,
                                            fontSize: "0.68rem",
                                            fontWeight: 700,
                                            background:
                                              row.bracketLabel === "Super League"
                                                ? "rgba(34,197,94,0.18)"
                                                : "rgba(239,68,68,0.16)",
                                            color:
                                              row.bracketLabel === "Super League"
                                                ? "#22c55e"
                                                : "#f87171",
                                            border:
                                              row.bracketLabel === "Super League"
                                                ? "1px solid rgba(34,197,94,0.32)"
                                                : "1px solid rgba(239,68,68,0.28)",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {row.bracketLabel}
                                        </span>
                                      ) : (
                                        <span style={{ opacity: 0.35 }}>—</span>
                                      )}
                                    </div>

                                    <div>{row.played}</div>
                                    <div>{row.wins}</div>
                                    <div>{row.losses}</div>
                                    <div style={{ fontWeight: 700 }}>{row.points}</div>
                                    <div>
                                      {typeof row.nrr === "number"
                                        ? row.nrr.toFixed(3)
                                        : row.nrr}
                                    </div>
                                    <div>{row.maxPossiblePoints}</div>
                                  </div>

                                  {row.isCutoff && (
                                    <div
                                      style={{
                                        position: "relative",
                                        height: 14,
                                        marginTop: -2,
                                        marginBottom: 2,
                                      }}
                                    >
                                      <div
                                        style={{
                                          position: "absolute",
                                          left: 8,
                                          right: 8,
                                          top: "50%",
                                          height: 2,
                                          borderRadius: 999,
                                          background: `linear-gradient(90deg, transparent, ${theme.accentColor}, transparent)`,
                                          boxShadow: `0 0 12px ${theme.accentColor}66`,
                                        }}
                                      />
                                      <div
                                        style={{
                                          position: "absolute",
                                          right: 14,
                                          top: -2,
                                          fontSize: "0.66rem",
                                          fontWeight: 700,
                                          padding: "2px 8px",
                                          borderRadius: 999,
                                          backgroundColor: isDarkMode
                                            ? "rgba(15,23,42,0.96)"
                                            : "rgba(255,255,255,0.96)",
                                          border: `1px solid ${theme.accentColor}66`,
                                          color: theme.accentColor,
                                          letterSpacing: "0.02em",
                                        }}
                                      >
                                        {t("tournament.cutoffLabel") || "Cutoff"}
                                      </div>
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>

                          <div
                            style={{
                              marginTop: 8,
                              fontSize: "0.72rem",
                              opacity: 0.72,
                              lineHeight: 1.4,
                            }}
                          >
                            {t("tournament.pointsTableNote") ||
                              "Green = mathematically locked into the top bracket. Red = mathematically eliminated from the top bracket. Teams remain unassigned until their next stage is confirmed."}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                          {t("tournament.noPointsTable") ||
                            "No points table available yet."}
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>
              )}
            </Card.Body>
          </Card>

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
                  id: "batting",
                  label: t("tournament.btnBatting") || "Batting Leaderboards",
                  subLabel:
                    t("tournament.btnBattingSub") ||
                    "Tournament batting leaders",
                },
                {
                  id: "bowling",
                  label: t("tournament.btnBowling") || "Bowling Leaderboards",
                  subLabel:
                    t("tournament.btnBowlingSub") ||
                    "Tournament bowling leaders",
                },
                {
                  id: "fielding",
                  label: t("tournament.btnFielding") || "Fielding Leaderboards",
                  subLabel:
                    t("tournament.btnFieldingSub") ||
                    "Tournament fielding leaders",
                },
              ].map((cfg) => {
                const isActive = activeDetail === cfg.id;

                return (
                  <GlassCard
                    key={cfg.id}
                    active={isActive}
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

          {activeDetail === "batting" && (
            <Card className="mt-3" style={cardStyle}>
              <Card.Body>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "1rem",
                        marginBottom: 2,
                        fontWeight: 700,
                      }}
                    >
                      {t("tournament.battingTitle") || "Batting leaderboards"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        opacity: 0.72,
                      }}
                    >
                      {showOnlyOurPlayers
                        ? t("tournament.battingScopeOurPlayers") || "Showing only our players"
                        : t("tournament.battingScopeAllPlayers") || "Showing all tournament players"}
                    </div>
                  </div>

                  <Form.Select
                    size="sm"
                    value={selectedBattingStat}
                    onChange={(e) => setSelectedBattingStat(e.target.value)}
                    style={{
                      minWidth: 230,
                      borderRadius: 999,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      backgroundColor: isDarkMode
                        ? "rgba(15,23,42,0.92)"
                        : "rgba(255,255,255,0.96)",
                      color: "var(--color-text-primary)",
                      border: "1px solid rgba(148,163,184,0.35)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                    }}
                  >
                    {battingStatOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Form.Select>
                </div>

                {loadingBattingLeaders ? (
                  <div className="d-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" />
                    <span style={{ fontSize: "0.9rem" }}>
                      {t("tournament.loadingBattingLeaders") || "Loading batting leaderboards…"}
                    </span>
                  </div>
                ) : battingLeadersError ? (
                  <Alert variant="danger" style={{ fontSize: "0.85rem" }}>
                    {battingLeadersError}
                  </Alert>
                ) : (battingLeaders[selectedBattingStat] || []).length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {(battingLeaders[selectedBattingStat] || []).map((player, idx) => {
                      const statMeta = battingStatMeta[selectedBattingStat];
                      const normalizedPlayerName = normalizeName(player.name);
                      const playerCountry = battingPlayerCountryMap[normalizedPlayerName] || "";
                      const isOurPlayer = playerCountry === teamName || showOnlyOurPlayers;
                      const shouldHighlightOurPlayer = isOurPlayer;
                      const playerFlag = getFlagUrlForTeam(playerCountry, 80);

                      return (
                          <div
                            key={`${selectedBattingStat}-${player.name}-${idx}`}
                            style={{
                              position: "relative",
                              display: "grid",
                              gridTemplateColumns: "0.45fr 0.45fr 1.8fr 0.9fr",
                              columnGap: 12,
                              alignItems: "center",
                              padding: "12px 14px",
                              borderRadius: 14,
                              border: shouldHighlightOurPlayer
                                ? `1px solid ${theme.accentColor}`
                                : "1px solid rgba(148,163,184,0.16)",
                              background: isDarkMode
                                ? "linear-gradient(180deg, rgba(15,23,42,0.82), rgba(15,23,42,0.68))"
                                : "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,250,252,0.78))",
                              boxShadow: shouldHighlightOurPlayer
                                ? `0 0 0 1px ${theme.accentColor}22, 0 8px 20px rgba(0,0,0,0.14)`
                                : "0 8px 20px rgba(0,0,0,0.12)",
                            }}
                          >
                          <div
                            style={{
                              fontSize: "0.95rem",
                              fontWeight: 800,
                              opacity: 0.9,
                              textAlign: "center",
                            }}
                          >
                            {idx + 1}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            {playerFlag ? (
                              <img
                                src={playerFlag}
                                alt={playerCountry || (t("home.teamFlagAlt") || "Team flag")}
                                style={{
                                  width: 26,
                                  height: 18,
                                  borderRadius: 4,
                                  objectFit: "cover",
                                  boxShadow: "0 0 8px rgba(0,0,0,0.35)",
                                }}
                              />
                            ) : (
                              <span style={{ opacity: 0.2 }}>—</span>
                            )}
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: "0.92rem",
                                fontWeight: 700,
                                lineHeight: 1.2,
                                marginBottom: 4,
                              }}

                            >
                              {player.name}
  
                            </div>

                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                                fontSize: "0.72rem",
                                opacity: 0.76,
                              }}
                            >
                              {statMeta.subFields.map((field) => (
                                <span
                                  key={field.label}
                                  style={{
                                    padding: "3px 8px",
                                    borderRadius: 999,
                                    background: isDarkMode
                                      ? "rgba(255,255,255,0.04)"
                                      : "rgba(255,255,255,0.7)",
                                    border: "1px solid rgba(148,163,184,0.16)",
                                  }}
                                >
                                  <strong>{field.label}:</strong> {field.value(player)}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                fontSize: "0.72rem",
                                opacity: 0.7,
                                marginBottom: 2,
                              }}
                            >
                              {statMeta.keyLabel}
                            </div>
                            <div
                              style={{
                                fontSize: "1.05rem",
                                fontWeight: 800,
                                color: theme.accentColor,
                              }}
                            >
                              {statMeta.getValue(player)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Alert variant="secondary" style={{ fontSize: "0.85rem" }}>
                    {t("tournament.noBattingLeaders") || "No batting leaderboard data available."}
                  </Alert>
                )}
              </Card.Body>
            </Card>
          )}

          {activeDetail === "bowling" && (
            <Card className="mt-3" style={cardStyle}>
              <Card.Body>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "1rem", marginBottom: 2, fontWeight: 700 }}>
                      {t("tournament.bowlingTitle") || "Bowling leaderboards"}
                    </div>
                    <div style={{ fontSize: "0.78rem", opacity: 0.72 }}>
                      {showOnlyOurPlayers
                        ? t("tournament.bowlingScopeOurPlayers") || "Showing only our players"
                        : t("tournament.bowlingScopeAllPlayers") || "Showing all tournament players"}
                    </div>
                  </div>

                  <Form.Select
                    size="sm"
                    value={selectedBowlingStat}
                    onChange={(e) => setSelectedBowlingStat(e.target.value)}
                    style={{
                      minWidth: 230,
                      borderRadius: 999,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      backgroundColor: isDarkMode
                        ? "rgba(15,23,42,0.92)"
                        : "rgba(255,255,255,0.96)",
                      color: "var(--color-text-primary)",
                      border: "1px solid rgba(148,163,184,0.35)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                    }}
                  >
                    {bowlingStatOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Form.Select>
                </div>

                {loadingBowlingLeaders ? (
                  <div className="d-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" />
                    <span style={{ fontSize: "0.9rem" }}>
                      {t("tournament.loadingBowlingLeaders") || "Loading bowling leaderboards…"}
                    </span>
                  </div>
                ) : bowlingLeadersError ? (
                  <Alert variant="danger" style={{ fontSize: "0.85rem" }}>
                    {bowlingLeadersError}
                  </Alert>
                ) : (bowlingLeaders[selectedBowlingStat] || []).length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(bowlingLeaders[selectedBowlingStat] || []).map((player, idx) => {
                      const statMeta = bowlingStatMeta[selectedBowlingStat];
                      const normalizedPlayerName = normalizeName(player.name);
                      const playerCountry = bowlingPlayerCountryMap[normalizedPlayerName] || "";
                      const isOurPlayer = playerCountry === teamName || showOnlyOurPlayers;
                      const shouldHighlightOurPlayer = isOurPlayer;
                      const playerFlag = getFlagUrlForTeam(playerCountry, 80);

                      return (
                        <div
                          key={`${selectedBowlingStat}-${player.name}-${idx}`}
                          style={{
                            position: "relative",
                            display: "grid",
                            gridTemplateColumns: "0.45fr 0.45fr 1.8fr 0.9fr",
                            columnGap: 12,
                            alignItems: "center",
                            padding: "12px 14px",
                            borderRadius: 14,
                            border: shouldHighlightOurPlayer
                              ? `1px solid ${theme.accentColor}`
                              : "1px solid rgba(148,163,184,0.16)",
                            background: isDarkMode
                              ? "linear-gradient(180deg, rgba(15,23,42,0.82), rgba(15,23,42,0.68))"
                              : "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,250,252,0.78))",
                            boxShadow: shouldHighlightOurPlayer
                              ? `0 0 0 1px ${theme.accentColor}22, 0 8px 20px rgba(0,0,0,0.14)`
                              : "0 8px 20px rgba(0,0,0,0.12)",
                          }}
                        >
                          <div style={{ fontSize: "0.95rem", fontWeight: 800, opacity: 0.9, textAlign: "center" }}>
                            {idx + 1}
                          </div>

                          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                            {playerFlag ? (
                              <img
                                src={playerFlag}
                                alt={playerCountry || (t("home.teamFlagAlt") || "Team flag")}
                                style={{
                                  width: 26,
                                  height: 18,
                                  borderRadius: 4,
                                  objectFit: "cover",
                                  boxShadow: "0 0 8px rgba(0,0,0,0.35)",
                                }}
                              />
                            ) : (
                              <span style={{ opacity: 0.2 }}>—</span>
                            )}
                          </div>

                          <div>
                            <div style={{ fontSize: "0.92rem", fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>
                              {player.name}
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: "0.72rem", opacity: 0.76 }}>
                              {statMeta.subFields.map((field) => (
                                <span
                                  key={field.label}
                                  style={{
                                    padding: "3px 8px",
                                    borderRadius: 999,
                                    background: isDarkMode
                                      ? "rgba(255,255,255,0.04)"
                                      : "rgba(255,255,255,0.7)",
                                    border: "1px solid rgba(148,163,184,0.16)",
                                  }}
                                >
                                  <strong>{field.label}:</strong> {field.value(player)}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "0.72rem", opacity: 0.7, marginBottom: 2 }}>
                              {statMeta.keyLabel}
                            </div>
                            <div
                              style={{
                                fontSize: "1.05rem",
                                fontWeight: 800,
                                color: theme.accentColor,
                              }}
                            >
                              {statMeta.getValue(player)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Alert variant="secondary" style={{ fontSize: "0.85rem" }}>
                    {t("tournament.noBowlingLeaders") || "No bowling leaderboard data available."}
                  </Alert>
                )}
              </Card.Body>
            </Card>
          )}

          {activeDetail === "fielding" && (
            <Card className="mt-3" style={cardStyle}>
              <Card.Body>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "1rem", marginBottom: 2, fontWeight: 700 }}>
                      {t("tournament.fieldingTitle") || "Fielding leaderboards"}
                    </div>
                    <div style={{ fontSize: "0.78rem", opacity: 0.72 }}>
                      {showOnlyOurPlayers
                        ? t("tournament.fieldingScopeOurPlayers") || "Showing only our players"
                        : t("tournament.fieldingScopeAllPlayers") || "Showing all tournament players"}
                    </div>
                  </div>

                  <Form.Select
                    size="sm"
                    value={selectedFieldingStat}
                    onChange={(e) => setSelectedFieldingStat(e.target.value)}
                    style={{
                      minWidth: 230,
                      borderRadius: 999,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      backgroundColor: isDarkMode
                        ? "rgba(15,23,42,0.92)"
                        : "rgba(255,255,255,0.96)",
                      color: "var(--color-text-primary)",
                      border: "1px solid rgba(148,163,184,0.35)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                    }}
                  >
                    {fieldingStatOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Form.Select>
                </div>

                {loadingFieldingLeaders ? (
                  <div className="d-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" />
                    <span style={{ fontSize: "0.9rem" }}>
                      {t("tournament.loadingFieldingLeaders") || "Loading fielding leaderboards…"}
                    </span>
                  </div>
                ) : fieldingLeadersError ? (
                  <Alert variant="danger" style={{ fontSize: "0.85rem" }}>
                    {fieldingLeadersError}
                  </Alert>
                ) : (fieldingLeaders[selectedFieldingStat] || []).length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(fieldingLeaders[selectedFieldingStat] || []).map((player, idx) => {
                      const statMeta = fieldingStatMeta[selectedFieldingStat];
                      const normalizedPlayerName = normalizeName(player.name);
                      const playerCountry = fieldingPlayerCountryMap[normalizedPlayerName] || "";
                      const isOurPlayer = playerCountry === teamName || showOnlyOurPlayers;
                      const shouldHighlightOurPlayer = isOurPlayer;
                      const playerFlag = getFlagUrlForTeam(playerCountry, 80);

                      return (
                        <div
                          key={`${selectedFieldingStat}-${player.name}-${idx}`}
                          style={{
                            position: "relative",
                            display: "grid",
                            gridTemplateColumns: "0.45fr 0.45fr 1.8fr 0.9fr",
                            columnGap: 12,
                            alignItems: "center",
                            padding: "12px 14px",
                            borderRadius: 14,
                            border: shouldHighlightOurPlayer
                              ? `1px solid ${theme.accentColor}`
                              : "1px solid rgba(148,163,184,0.16)",
                            background: isDarkMode
                              ? "linear-gradient(180deg, rgba(15,23,42,0.82), rgba(15,23,42,0.68))"
                              : "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,250,252,0.78))",
                            boxShadow: shouldHighlightOurPlayer
                              ? `0 0 0 1px ${theme.accentColor}22, 0 8px 20px rgba(0,0,0,0.14)`
                              : "0 8px 20px rgba(0,0,0,0.12)",
                          }}
                        >
                          <div style={{ fontSize: "0.95rem", fontWeight: 800, opacity: 0.9, textAlign: "center" }}>
                            {idx + 1}
                          </div>

                          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                            {playerFlag ? (
                              <img
                                src={playerFlag}
                                alt={playerCountry || (t("home.teamFlagAlt") || "Team flag")}
                                style={{
                                  width: 26,
                                  height: 18,
                                  borderRadius: 4,
                                  objectFit: "cover",
                                  boxShadow: "0 0 8px rgba(0,0,0,0.35)",
                                }}
                              />
                            ) : (
                              <span style={{ opacity: 0.2 }}>—</span>
                            )}
                          </div>

                          <div>
                            <div style={{ fontSize: "0.92rem", fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>
                              {player.name}
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "0.72rem", opacity: 0.7, marginBottom: 2 }}>
                              {statMeta.keyLabel}
                            </div>
                            <div
                              style={{
                                fontSize: "1.05rem",
                                fontWeight: 800,
                                color: theme.accentColor,
                              }}
                            >
                              {statMeta.getValue(player)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Alert variant="secondary" style={{ fontSize: "0.85rem" }}>
                    {t("tournament.noFieldingLeaders") || "No fielding leaderboard data available."}
                  </Alert>
                )}
              </Card.Body>
            </Card>
          )}
        </>
        
      )}
      <Modal
        show={showScorecardModal}
        onHide={() => {
          setShowScorecardModal(false);
          setSelectedResultMatch(null);
        }}
        fullscreen
        centered
        contentClassName="themed-modal-content"
      >
      <Modal.Header className="scorecard-modal-header-gradient">
        <Modal.Title style={{ fontSize: "0.95rem" }}>
          {selectedResultMatch
            ? `${selectedResultMatch.team_a} vs ${selectedResultMatch.team_b}`
            : t("tournament.scorecardTitle") || "Match scorecard"}
        </Modal.Title>
      </Modal.Header>

        <Modal.Body
          style={{
            backgroundColor: isDarkMode ? "#020617" : "#f8fafc",
            color: isDarkMode ? "#e5e7eb" : "#0f172a",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setShowScorecardModal(false);
              setSelectedResultMatch(null);
            }}
            aria-label={t("common.close") || "Close"}
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              marginLeft: "auto",
              display: "block",
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.35)",
              background: isDarkMode ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.96)",
              color: isDarkMode ? "#e5e7eb" : "#0f172a",
              fontSize: "1.35rem",
              lineHeight: 1,
              cursor: "pointer",
              boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
              marginBottom: 8,
            }}
          >
            ×
          </button>
          {selectedResultMatch && (
            <MatchScorecardPage
              selectedMatch={selectedResultMatch}
              teamCategory={teamCategory}
            />
          )}
        </Modal.Body>
      </Modal>
    </>
    
  );
};

export default TournamentAnalysisPage;