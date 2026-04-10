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
  const [selectedTournamentId, setSelectedTournamentId] = useState(null);
  const [selectedStageId, setSelectedStageId] = useState(null);
  const [activeDetail, setActiveDetail] = useState(null);

  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [loadingStageTable, setLoadingStageTable] = useState(false);
  const [error, setError] = useState("");

  const [showOnlyOurPlayers, setShowOnlyOurPlayers] = useState(true);

  const [tournamentMatches, setTournamentMatches] = useState([]);
  const [tournamentTable, setTournamentTable] = useState([]);
  const [tournamentStructure, setTournamentStructure] = useState(null);
  const [stageOptions, setStageOptions] = useState([]);
  const [currentStage, setCurrentStage] = useState(null);
  const [selectedStageMeta, setSelectedStageMeta] = useState(null);
  const [derivedStageTable, setDerivedStageTable] = useState([]);
  const [podiumStandings, setPodiumStandings] = useState([]);

  const [battingLeaders, setBattingLeaders] = useState({});
  const [loadingBattingLeaders, setLoadingBattingLeaders] = useState(false);
  const [battingLeadersError, setBattingLeadersError] = useState("");
  const [selectedBattingStat, setSelectedBattingStat] = useState("Most Runs");
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

  const safeDateValue = (match) => {
    const raw =
      match?.match_date ||
      match?.date ||
      match?.scheduled_date ||
      "";
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) ? ts : 0;
  };

  const hasMatchResult = (match) =>
    !!String(match?.resolvedResult || match?.result || "").trim();

  const sortedTournamentMatches = useMemo(() => {
    return [...tournamentMatches].sort(
      (a, b) => safeDateValue(a) - safeDateValue(b)
    );
  }, [tournamentMatches]);

  const completedMatches = useMemo(() => {
    return sortedTournamentMatches.filter((match) => hasMatchResult(match));
  }, [sortedTournamentMatches]);

  const upcomingMatches = useMemo(() => {
    return sortedTournamentMatches.filter((match) => !hasMatchResult(match));
  }, [sortedTournamentMatches]);

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        setLoadingTournaments(true);
        setError("");

        const res = await api.get("/tournaments", {
          params: { team_category: teamCategory },
        });

        const rawTournaments = Array.isArray(res.data) ? res.data : [];

        const filteredTournaments = rawTournaments.filter((name) => {
          const normalized = String(name || "").toLowerCase();

          if (teamCategory === "Women") {
            return normalized.includes("women") || normalized.includes("women's");
          }

          if (teamCategory === "Men") {
            return !normalized.includes("women") && !normalized.includes("women's");
          }

          return true;
        });

        setTournaments(filteredTournaments);
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
      setTournamentStructure(null);
      setStageOptions([]);
      setCurrentStage(null);
      setSelectedStageMeta(null);
      setSelectedTournamentId(null);
      setSelectedStageId(null);
      return;
    }

    const bootstrapTournamentPage = async () => {
      try {
        setLoadingPage(true);
        setError("");

        // 1) Load DB-driven tournament structure
        const structureRes = await api.get("/tournament-structure", {
          params: {
            tournament_name: selectedTournament,
          },
        });

        const structure = structureRes.data || null;

        setTournamentStructure(structure);
        setSelectedTournamentId(structure?.tournament?.tournament_id || null);
        setStageOptions(structure?.available_stage_options || []);
        setCurrentStage(structure?.current_stage || null);

        const defaultStageId =
          structure?.current_stage?.stage_id ||
          structure?.available_stage_options?.[0]?.stage_id ||
          null;

        setSelectedStageId(defaultStageId);

        // 2) Load matches
        const matchesRes = await api.get("/matches", {
          params: { teamCategory },
        });

        const allMatches = Array.isArray(matchesRes.data) ? matchesRes.data : [];
        const filteredMatches = allMatches.filter(
          (m) => m.tournament === selectedTournament
        );

        // 3) Pull scorecard results for each match
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
                resolvedResult:
                  scorecardRes.data?.result || match.result || "",
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

  useEffect(() => {
    if (!selectedTournamentId || !selectedStageId) {
      setTournamentTable([]);
      setSelectedStageMeta(null);
      setDerivedStageTable([]);
      return;
    }

    const fetchStageStandings = async () => {
      try {
        setLoadingStageTable(true);
        setError("");
        setDerivedStageTable([]);

        const standingsRes = await api.post("/tournament-stage-standings", {
          tournament_id: selectedTournamentId,
          stage_id: selectedStageId,
        });

        const payload = standingsRes.data || {};
        setTournamentTable(payload?.standings || []);
        setSelectedStageMeta(payload?.stage || null);
      } catch (err) {
        console.error("Error loading tournament stage standings", err);
        setTournamentTable([]);
        setSelectedStageMeta(null);
        setDerivedStageTable([]);
        setError(
          err?.response?.data?.detail ||
            err.message ||
            "Error loading tournament stage standings."
        );
      } finally {
        setLoadingStageTable(false);
      }
    };

    fetchStageStandings();
  }, [selectedTournamentId, selectedStageId]);

  useEffect(() => {
    const fetchPodiumStandings = async () => {
      setPodiumStandings([]);

      if (!tournamentStructure?.stages || !selectedTournamentId) return;

      const leagueStages = tournamentStructure.stages.filter(
        (stage) => String(stage.stage_type || "").toLowerCase() === "league"
      );

      if (!leagueStages.length) return;

      const decisiveLeagueStage =
        [...leagueStages].sort(
          (a, b) => Number(b.display_order || 0) - Number(a.display_order || 0)
        )[0] || null;

      if (!decisiveLeagueStage?.stage_id) return;

      try {
        const res = await api.post("/tournament-stage-standings", {
          tournament_id: selectedTournamentId,
          stage_id: decisiveLeagueStage.stage_id,
        });

        const payload = res.data || {};
        setPodiumStandings(payload?.standings || []);
      } catch (err) {
        console.error("Error loading podium standings", err);
        setPodiumStandings([]);
      }
    };

    fetchPodiumStandings();
  }, [tournamentStructure, selectedTournamentId]);

    useEffect(() => {
    const buildDerivedStageTable = async () => {
      if (!selectedTournamentId || !selectedStageMeta?.stage_id) return;

      // If backend already has rows for this stage, do not derive anything
      if (Array.isArray(tournamentTable) && tournamentTable.length > 0) {
        setDerivedStageTable([]);
        return;
      }

      const incomingRules = Array.isArray(tournamentStructure?.progressions)
        ? tournamentStructure.progressions.filter(
            (p) => Number(p.destination_stage_id) === Number(selectedStageMeta.stage_id)
          )
        : [];

      if (!incomingRules.length) {
        setDerivedStageTable([]);
        return;
      }

      const sourceStageId = Number(incomingRules[0].source_stage_id);

      try {
        const sourceRes = await api.post("/tournament-stage-standings", {
          tournament_id: selectedTournamentId,
          stage_id: sourceStageId,
        });

        const sourcePayload = sourceRes.data || {};
        const sourceStandings = Array.isArray(sourcePayload?.standings)
          ? sourcePayload.standings
          : [];
        const sourceStage = sourcePayload?.stage || null;

        if (!sourceStandings.length || !sourceStage) {
          setDerivedStageTable([]);
          return;
        }

        const sourceMatchesPerTeam = Number(sourceStage.matches_per_team || 0);
        const sourceComplete =
          String(sourceStage.status || "").toLowerCase() === "completed" ||
          (sourceMatchesPerTeam > 0 &&
            sourceStandings.every(
              (row) => Number(row.played || 0) >= sourceMatchesPerTeam
            ));

        if (!sourceComplete) {
          setDerivedStageTable([]);
          return;
        }

        const carryOverMode = String(selectedStageMeta.carry_over_mode || "reset_all").toLowerCase();

        const derivedTeams = sourceStandings
          .map((row, idx) => {
            const rank = idx + 1;

            const matchingRule = incomingRules.find(
              (rule) =>
                rank >= Number(rule.rank_from) &&
                rank <= Number(rule.rank_to)
            );

            if (!matchingRule) return null;

            return {
              team: row.team,
              played: carryOverMode === "reset_all" ? 0 : Number(row.played || 0),
              wins: carryOverMode === "reset_all" ? 0 : Number(row.wins || 0),
              losses: carryOverMode === "reset_all" ? 0 : Number(row.losses || 0),
              no_results: carryOverMode === "reset_all" ? 0 : Number(row.no_results || 0),
              points: carryOverMode === "reset_all" ? 0 : Number(row.points || 0),
              nrr: carryOverMode === "reset_all" ? 0 : Number(row.nrr || 0),
            };
          })
          .filter(Boolean)
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.nrr !== a.nrr) return b.nrr - a.nrr;
            return String(a.team).localeCompare(String(b.team));
          });

        setDerivedStageTable(derivedTeams);
      } catch (err) {
        console.error("Error deriving future stage standings", err);
        setDerivedStageTable([]);
      }
    };

    buildDerivedStageTable();
  }, [
    selectedTournamentId,
    selectedStageMeta,
    tournamentTable,
    tournamentStructure,
  ]);

  const selectedStage = useMemo(() => {
    return (
      stageOptions.find(
        (stage) => String(stage.stage_id) === String(selectedStageId)
      ) || currentStage || null
    );
  }, [stageOptions, selectedStageId, currentStage]);

  const standingsWithMath = useMemo(() => {
    const baseTable =
      Array.isArray(tournamentTable) && tournamentTable.length > 0
        ? tournamentTable
        : derivedStageTable;

    if (!selectedStageMeta || !Array.isArray(baseTable) || baseTable.length === 0) {
      return [];
    }

    const advancementLine = Number(selectedStageMeta?.advancement_line || 0);
    const matchesPerTeam = Number(selectedStageMeta?.matches_per_team || 0);
    const stageStatus = String(selectedStageMeta?.status || "").toLowerCase();
    const progressionMode = String(selectedStageMeta?.progression_mode || "").toLowerCase();

    const relevantProgressions = Array.isArray(tournamentStructure?.progressions)
      ? tournamentStructure.progressions.filter(
          (p) => Number(p.source_stage_id) === Number(selectedStageMeta.stage_id)
        )
      : [];

    const getBracketLabelForRank = (rank) => {
      if (!relevantProgressions.length) return "";

      const matchingRule = relevantProgressions.find(
        (p) => rank >= Number(p.rank_from) && rank <= Number(p.rank_to)
      );

      return matchingRule?.destination_stage_name || "";
    };

    const pointsPerWin =
      Number(tournamentStructure?.tournament?.points_per_win || 2);

    const enriched = baseTable.map((row, idx) => {
      const played = Number(row.played || 0);
      const points = Number(row.points || 0);
      const wins = Number(row.wins || 0);
      const losses = Number(row.losses || 0);
      const no_results = Number(row.no_results || 0);
      const nrr =
        typeof row.nrr === "number" ? row.nrr : Number(row.nrr || 0);

      const gamesRemaining =
        matchesPerTeam > 0 ? Math.max(matchesPerTeam - played, 0) : 0;

      const maxPossiblePoints = points + gamesRemaining * pointsPerWin;
      const rank = idx + 1;

      return {
        ...row,
        played,
        points,
        wins,
        losses,
        no_results,
        nrr,
        gamesRemaining,
        maxPossiblePoints,
        rank,
        isCutoff: advancementLine > 0 && idx === advancementLine - 1,
        bracketLabel: getBracketLabelForRank(rank),
        status: "alive",
      };
    });

    // No advancement line means no qualification colouring
    if (!advancementLine || advancementLine <= 0) {
      return enriched;
    }

    // If stage is completed, ranking is final
    if (stageStatus === "completed" || (matchesPerTeam > 0 && enriched.every((row) => row.played >= matchesPerTeam))) {
      return enriched.map((row) => ({
        ...row,
        status: row.rank <= advancementLine ? "qualified" : "eliminated",
      }));
    }

    // Live mathematical status
    return enriched.map((team) => {
      const cutoffTeam = enriched[advancementLine - 1];
      const cutoffPoints = Number(cutoffTeam?.points || 0);

      const teamsThatCanStillReachTeam = enriched.filter(
        (other) =>
          other.team !== team.team &&
          Number(other.maxPossiblePoints || 0) >= Number(team.points || 0)
      ).length;

      const qualifiedTop = teamsThatCanStillReachTeam < advancementLine;
      const eliminatedTop = Number(team.maxPossiblePoints || 0) < cutoffPoints;

      let status = "alive";
      if (qualifiedTop) {
        status = "qualified";
      } else if (eliminatedTop) {
        status = "eliminated";
      }

      return {
        ...team,
        status,
      };
    });
  }, [tournamentTable, derivedStageTable, selectedStageMeta, tournamentStructure]);

    const selectedStageMatches = useMemo(() => {
    if (!selectedStageId) return [];

    return sortedTournamentMatches.filter(
      (match) => Number(match.stage_id) === Number(selectedStageId)
    );
  }, [sortedTournamentMatches, selectedStageId]);

  const selectedStageCompletedMatches = useMemo(() => {
    return selectedStageMatches.filter((match) => hasMatchResult(match));
  }, [selectedStageMatches]);

  const selectedStageUpcomingMatches = useMemo(() => {
    return selectedStageMatches.filter((match) => !hasMatchResult(match));
  }, [selectedStageMatches]);

  const derivedKnockoutFixtures = useMemo(() => {
    if (!selectedStageMeta?.stage_id || !tournamentStructure?.progressions) {
      return [];
    }

    const incomingRules = tournamentStructure.progressions
      .filter(
        (p) => Number(p.destination_stage_id) === Number(selectedStageMeta.stage_id)
      )
      .sort((a, b) => {
        const seedA = Number(a.destination_seed_from || 999);
        const seedB = Number(b.destination_seed_from || 999);
        return seedA - seedB;
      });

    if (!incomingRules.length) return [];

    const sourceStageIds = Array.from(
      new Set(incomingRules.map((p) => Number(p.source_stage_id)))
    );

    // Use whichever stage standings we already have in memory if they match the source stage,
    // otherwise fall back to derivedStageTable when appropriate.
    const sourceStageStandingsMap = new Map();

    sourceStageIds.forEach((sourceStageId) => {
      // If current visible table belongs to the source stage, use it.
      if (Number(selectedStageMeta?.stage_id) === Number(sourceStageId)) {
        sourceStageStandingsMap.set(sourceStageId, standingsWithMath);
      }
    });

    // For downstream knockout stages, build from completed source stages via fetch-derived table logic:
    // use the same tournamentStructure + stage standings already loaded in memory when possible.
    // Since we do not cache every stage table globally yet, use tournamentTable/derivedStageTable only
    // when it corresponds to the source stage. Otherwise this remains empty until actual match rows exist.
    if (!sourceStageStandingsMap.size) {
      return [];
    }

    const participants = incomingRules
      .map((rule) => {
        const sourceStageId = Number(rule.source_stage_id);
        const sourceRows = sourceStageStandingsMap.get(sourceStageId) || [];
        const rank = Number(rule.rank_from);

        const participant = sourceRows.find((row) => Number(row.rank) === rank);
        if (!participant) return null;

        return {
          seed: Number(rule.destination_seed_from || 999),
          sourceStageId,
          sourceStageName: rule.source_stage_name,
          destinationStageName: rule.destination_stage_name,
          team: participant.team,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.seed - b.seed);

    if (!participants.length) return [];

    // Pair sequentially: 1v2, 3v4, 5v6...
    const fixtures = [];
    for (let i = 0; i < participants.length; i += 2) {
      const a = participants[i];
      const b = participants[i + 1] || null;

      fixtures.push({
        fixture_id: `derived-${selectedStageMeta.stage_id}-${i / 2}`,
        team_a: a?.team || "",
        team_b: b?.team || "",
        isDerived: true,
        resolvedResult: "",
        result: "",
        match_date: "",
        venue: "",
      });
    }

    return fixtures;
  }, [
    selectedStageMeta,
    tournamentStructure,
    standingsWithMath,
  ]);

  const renderKnockoutTeam = (teamNameValue) => {
    const flagUrl = getFlagUrlForTeam(teamNameValue, 80);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          minWidth: 120,
        }}
      >
        {flagUrl ? (
          <img
            src={flagUrl}
            alt={teamNameValue || (t("home.teamFlagAlt") || "Team flag")}
            style={{
              width: 52,
              height: 36,
              borderRadius: 6,
              objectFit: "cover",
              boxShadow: "0 0 10px rgba(0,0,0,0.28)",
            }}
          />
        ) : (
          <div
            style={{
              width: 52,
              height: 36,
              borderRadius: 6,
              border: "1px solid rgba(148,163,184,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.35,
              fontSize: "0.8rem",
            }}
          >
            —
          </div>
        )}

        <div
          style={{
            fontSize: "0.82rem",
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          {teamNameValue || (t("tournament.toBeConfirmed") || "TBC")}
        </div>
      </div>
    );
  };

    const renderKnockoutStageView = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {knockoutFixturesToRender.length > 0 ? (
          knockoutFixturesToRender.map((match, idx) => {
            const hasResult = hasMatchResult(match);
            const clickable = !!match.match_id;

            return (
              <div
                key={match.match_id || match.fixture_id || idx}
                onClick={() => {
                  if (!clickable) return;
                  setSelectedResultMatch(match);
                  setShowScorecardModal(true);
                }}
                style={{
                  borderRadius: 16,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: isDarkMode
                    ? "linear-gradient(180deg, rgba(15,23,42,0.84), rgba(15,23,42,0.70))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(248,250,252,0.82))",
                  padding: 16,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                  cursor: clickable ? "pointer" : "default",
                  transition: "transform 0.18s ease, box-shadow 0.18s ease",
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
                  <div
                    style={{
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      opacity: 0.7,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {selectedStageMeta?.stage_name || selectedStage?.name || "Fixture"}
                    {knockoutFixturesToRender.length > 1 ? ` ${idx + 1}` : ""}
                  </div>

                  {(match.match_date || match.venue) && (
                    <div
                      style={{
                        fontSize: "0.7rem",
                        opacity: 0.7,
                        textAlign: "right",
                      }}
                    >
                      {match.match_date || ""}
                      {match.match_date && match.venue ? " • " : ""}
                      {match.venue || ""}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {renderKnockoutTeam(match.team_a)}

                  <div
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 800,
                      opacity: 0.75,
                      letterSpacing: "0.08em",
                    }}
                  >
                    VS
                  </div>

                  {renderKnockoutTeam(match.team_b)}
                </div>

                <div
                  style={{
                    minHeight: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                  }}
                >
                  {hasResult ? (
                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: theme.accentColor,
                      }}
                    >
                      {match.resolvedResult || match.result}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: "0.74rem",
                        opacity: 0.7,
                      }}
                    >
                      {match.isDerived
                        ? t("tournament.projectedMatchUp") || "Projected matchup"
                        : t("tournament.fixtureScheduledLabel") || "Scheduled fixture"}
                    </div>
                  )}
                </div>

                {clickable && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: "0.64rem",
                      opacity: 0.55,
                      textAlign: "center",
                    }}
                  >
                    {t("tournament.clickForScorecard") || "Click to view scorecard"}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
            {t("tournament.noKnockoutFixtures") ||
              "No fixtures are available for this elimination stage yet."}
          </div>
        )}
      </div>
    );
  };

  const knockoutFixturesToRender = useMemo(() => {
    if (selectedStageMatches.length > 0) {
      return selectedStageMatches;
    }
    return derivedKnockoutFixtures;
  }, [selectedStageMatches, derivedKnockoutFixtures]);

  const isKnockoutStyleStage = useMemo(() => {
    const stageType = String(selectedStageMeta?.stage_type || "").toLowerCase();
    return stageType === "knockout" || stageType === "classification";
  }, [selectedStageMeta]);

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

  const tournamentCompletion = useMemo(() => {
    const stages = Array.isArray(tournamentStructure?.stages)
      ? tournamentStructure.stages
      : [];

    const allMatches = Array.isArray(sortedTournamentMatches)
      ? sortedTournamentMatches
      : [];

    const finalStage = stages.find(
      (stage) =>
        String(stage.stage_name || "").toLowerCase() === "final" &&
        String(stage.stage_type || "").toLowerCase() === "knockout"
    );

    const thirdPlaceStage = stages.find((stage) => {
      const name = String(stage.stage_name || "").toLowerCase();
      return (
        String(stage.stage_type || "").toLowerCase() === "classification" &&
        (name.includes("3rd") || name.includes("third"))
      );
    });

    const finalMatch = finalStage
      ? allMatches.find(
          (match) => Number(match.stage_id) === Number(finalStage.stage_id)
        )
      : null;

    const thirdPlaceMatch = thirdPlaceStage
      ? allMatches.find(
          (match) => Number(match.stage_id) === Number(thirdPlaceStage.stage_id)
        )
      : null;

    const standingsOnlyTournament = !finalStage;

    const finalComplete =
      !finalStage ||
      (
        String(finalStage.status || "").toLowerCase() === "completed" &&
        !!finalMatch
      );

    const thirdPlaceComplete =
      !thirdPlaceStage ||
      (
        String(thirdPlaceStage.status || "").toLowerCase() === "completed" &&
        !!thirdPlaceMatch
      );

    return {
      isComplete: standingsOnlyTournament || (finalComplete && thirdPlaceComplete),
      standingsOnlyTournament,
      finalStage,
      thirdPlaceStage,
      finalMatch,
      thirdPlaceMatch,
    };
  }, [tournamentStructure, sortedTournamentMatches]);

  const podiumData = useMemo(() => {
    if (!tournamentCompletion.isComplete) return null;

    const stages = Array.isArray(tournamentStructure?.stages)
      ? tournamentStructure.stages
      : [];

    const allMatches = Array.isArray(sortedTournamentMatches)
      ? sortedTournamentMatches
      : [];

    const leagueStages = stages.filter(
      (stage) => String(stage.stage_type || "").toLowerCase() === "league"
    );

    const decisiveLeagueStage =
      [...leagueStages].sort(
        (a, b) => Number(b.display_order || 0) - Number(a.display_order || 0)
      )[0] || null;

    const decisiveLeagueStageId = Number(decisiveLeagueStage?.stage_id || 0);

    const decisiveLeagueRows =
      decisiveLeagueStageId && Array.isArray(allMatches)
        ? null
        : null;

    // Build standings source from currently visible standings if it belongs to the decisive stage.
    const decisiveStandings = Array.isArray(podiumStandings)
      ? podiumStandings.map((row, idx) => ({
          ...row,
          rank: idx + 1,
        }))
      : [];

    const finalMatch = tournamentCompletion.finalMatch;
    const thirdPlaceMatch = tournamentCompletion.thirdPlaceMatch;

    // CASE 1: standings-only tournament
    if (tournamentCompletion.standingsOnlyTournament) {
      if (!decisiveStandings || decisiveStandings.length < 3) return null;

      return {
        first: decisiveStandings[0]?.team || null,
        second: decisiveStandings[1]?.team || null,
        third: decisiveStandings[2]?.team || null,
      };
    }

    // CASE 2/3: tournament with final
    if (!finalMatch) return null;

    const finalWinnerId = Number(finalMatch.winner_id || 0);

    let first = null;
    let second = null;

    if (finalWinnerId && Number(finalMatch.team_a_id) === finalWinnerId) {
      first = finalMatch.team_a;
      second = finalMatch.team_b;
    } else if (finalWinnerId && Number(finalMatch.team_b_id) === finalWinnerId) {
      first = finalMatch.team_b;
      second = finalMatch.team_a;
    }

    if (!first || !second) return null;

    // CASE 2: final + 3rd place playoff
    if (thirdPlaceMatch) {
      const thirdWinnerId = Number(thirdPlaceMatch.winner_id || 0);

      let third = null;
      if (thirdWinnerId && Number(thirdPlaceMatch.team_a_id) === thirdWinnerId) {
        third = thirdPlaceMatch.team_a;
      } else if (thirdWinnerId && Number(thirdPlaceMatch.team_b_id) === thirdWinnerId) {
        third = thirdPlaceMatch.team_b;
      }

      return {
        first,
        second,
        third,
      };
    }

    // CASE 3: final only, no 3rd place playoff
    // 3rd comes from decisive league standings excluding the two finalists
    if (!decisiveStandings || decisiveStandings.length === 0) {
      return {
        first,
        second,
        third: null,
      };
    }

    const thirdCandidate = decisiveStandings.find(
      (row) => row.team !== first && row.team !== second
    );

    return {
      first,
      second,
      third: thirdCandidate?.team || null,
    };
  }, [
    tournamentCompletion,
    tournamentStructure,
    sortedTournamentMatches,
    podiumStandings,
  ]);


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

  const getWinningTeamFromResult = (match) => {
    if (!match) return null;

    const resultText = String(match.resolvedResult || match.result || "").toLowerCase();
    const teamA = match.team_a;
    const teamB = match.team_b;

    if (!teamA || !teamB || !resultText) return null;

    if (resultText.includes(String(teamA).toLowerCase())) return teamA;
    if (resultText.includes(String(teamB).toLowerCase())) return teamB;

    return null;
  };

  const getLosingTeamFromResult = (match) => {
    const winner = getWinningTeamFromResult(match);
    if (!winner || !match) return null;
    return winner === match.team_a ? match.team_b : match.team_a;
  };

  const tournamentPodium = useMemo(() => {
    if (!tournamentCompletion.isComplete) return null;

    const champion = getWinningTeamFromResult(tournamentCompletion.finalMatch);
    const runnerUp = getLosingTeamFromResult(tournamentCompletion.finalMatch);
    const thirdPlace = getWinningTeamFromResult(tournamentCompletion.thirdPlaceMatch);

    if (!champion || !runnerUp || !thirdPlace) return null;

    return {
      champion,
      runnerUp,
      thirdPlace,
    };
  }, [tournamentCompletion]);

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
                      setSelectedStageId(null);
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
                <>
                  {podiumData && (
                    <div
                      style={{
                        marginBottom: 18,
                        borderRadius: 20,
                        border: "1px solid rgba(148,163,184,0.22)",
                        background: isDarkMode
                          ? "linear-gradient(180deg, rgba(15,23,42,0.86), rgba(15,23,42,0.68))"
                          : "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(248,250,252,0.82))",
                        boxShadow: "0 10px 28px rgba(0,0,0,0.16)",
                        padding: "20px 18px 16px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "1rem",
                          fontWeight: 800,
                          marginBottom: 14,
                          textAlign: "center",
                        }}
                      >
                        {t("tournament.podiumTitle") || "Tournament Podium"}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 14,
                          alignItems: "end",
                        }}
                      >
                        {[
                          {
                            place: 2,
                            team: podiumData.second,
                            height: 88,
                          },
                          {
                            place: 1,
                            team: podiumData.first,
                            height: 128,
                          },
                          {
                            place: 3,
                            team: podiumData.third,
                            height: 68,
                          },
                        ].map((item) => {
                          const flagUrl = getFlagUrlForTeam(item.team, 80);

                          return (
                            <div
                              key={`${item.place}-${item.team}`}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "flex-end",
                              }}
                            >
                              <div
                                style={{
                                  marginBottom: 10,
                                  textAlign: "center",
                                }}
                              >
                                {flagUrl ? (
                                  <img
                                    src={flagUrl}
                                    alt={item.team || "Flag"}
                                    style={{
                                      width: 34,
                                      height: 24,
                                      borderRadius: 4,
                                      objectFit: "cover",
                                      boxShadow: "0 0 10px rgba(0,0,0,0.28)",
                                      marginBottom: 8,
                                    }}
                                  />
                                ) : null}

                                <div
                                  style={{
                                    fontSize: "0.82rem",
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                    maxWidth: 140,
                                  }}
                                >
                                  {item.team || "—"}
                                </div>
                              </div>

                              <div
                                style={{
                                  width: "100%",
                                  maxWidth: 140,
                                  height: item.height,
                                  borderRadius: "16px 16px 8px 8px",
                                  background:
                                    item.place === 1
                                      ? "linear-gradient(180deg, rgba(250,204,21,0.9), rgba(234,179,8,0.72))"
                                      : item.place === 2
                                      ? "linear-gradient(180deg, rgba(226,232,240,0.92), rgba(148,163,184,0.72))"
                                      : "linear-gradient(180deg, rgba(251,146,60,0.9), rgba(234,88,12,0.72))",
                                  border: "1px solid rgba(255,255,255,0.18)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  boxShadow: "0 8px 20px rgba(0,0,0,0.16)",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "1.4rem",
                                    fontWeight: 900,
                                    color: "#0f172a",
                                  }}
                                >
                                  {item.place}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

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
                              gap: 14,
                              flex: 1,
                              maxHeight: 800,
                              overflowY:
                                completedMatches.length + upcomingMatches.length > 4
                                  ? "auto"
                                  : "visible",
                              paddingRight:
                                completedMatches.length + upcomingMatches.length > 4
                                  ? 4
                                  : 0,
                              scrollbarWidth: "thin",
                            }}
                          >
                            {/* Completed matches */}
                            <div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  opacity: 0.72,
                                  marginBottom: 8,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                {t("tournament.completedMatchesTitle") || "Completed Matches"}
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {completedMatches.length > 0 ? (
                                  completedMatches.map((match, idx) => {
                                    const isOurMatch =
                                      [match.team_a, match.team_b]
                                        .map((x) => String(x || "").trim().toLowerCase())
                                        .includes(String(teamName || "").trim().toLowerCase());

                                    return (
                                      <div
                                        key={`completed_${match.match_id || idx}`}
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
                                          transition:
                                            "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
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
                                  })
                                ) : (
                                  <div style={{ fontSize: "0.72rem", opacity: 0.65 }}>
                                    {t("tournament.noCompletedMatches") || "No completed matches yet."}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Upcoming matches */}
                            <div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  opacity: 0.72,
                                  marginBottom: 8,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                {t("tournament.upcomingMatchesTitle") || "Upcoming Matches"}
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {upcomingMatches.length > 0 ? (
                                  upcomingMatches.map((match, idx) => {
                                    const isOurMatch =
                                      [match.team_a, match.team_b]
                                        .map((x) => String(x || "").trim().toLowerCase())
                                        .includes(String(teamName || "").trim().toLowerCase());

                                    return (
                                      <div
                                        key={`upcoming_${match.match_id || idx}`}
                                        style={{
                                          minHeight: 56,
                                          borderRadius: 14,
                                          padding: "12px 12px 12px 14px",
                                          background: isOurMatch
                                            ? isDarkMode
                                              ? "linear-gradient(180deg, rgba(30,41,59,0.82), rgba(15,23,42,0.76))"
                                              : "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(241,245,249,0.92))"
                                            : isDarkMode
                                            ? "rgba(255,255,255,0.025)"
                                            : "rgba(255,255,255,0.6)",
                                          border: isOurMatch
                                            ? `1px solid ${theme.accentColor}88`
                                            : "1px solid rgba(148,163,184,0.16)",
                                          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
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
                                            marginBottom: 4,
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
                                            opacity: 0.72,
                                            lineHeight: 1.3,
                                            fontStyle: "italic",
                                          }}
                                        >
                                          {t("tournament.scheduledMatchLabel") || "Scheduled"}
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div style={{ fontSize: "0.72rem", opacity: 0.65 }}>
                                    {t("tournament.noUpcomingMatches") || "No upcoming matches scheduled."}
                                  </div>
                                )}
                              </div>
                            </div>
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
                              {selectedStageMeta?.stage_name || selectedStage?.name || "Stage standings"}
                            </div>
                          </div>

                          <div>
                            {stageOptions.length > 1 ? (
                              <Form.Select
                                size="sm"
                                value={selectedStageId || ""}
                                onChange={(e) => setSelectedStageId(Number(e.target.value))}
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
                                {stageOptions.map((stage) => (
                                  <option key={stage.stage_id} value={stage.stage_id}>
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
                                {selectedStageMeta?.stage_name || currentStage?.stage_name || "Stage"}
                              </div>
                            )}
                          </div>
                        </div>

                      {isKnockoutStyleStage ? (
                        renderKnockoutStageView()
                      ) : standingsWithMath.length > 0 ? (
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
                                            background: isDarkMode
                                              ? "rgba(59,130,246,0.16)"
                                              : "rgba(59,130,246,0.10)",
                                            color: isDarkMode ? "#93c5fd" : "#1d4ed8",
                                            border: isDarkMode
                                              ? "1px solid rgba(147,197,253,0.24)"
                                              : "1px solid rgba(29,78,216,0.18)",
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
                            {selectedStageMeta?.advancement_line
                              ? (
                                  t("tournament.pointsTableNoteStageProgression") ||
                                  "Green = qualified. Red = eliminated. The line marks the qualification cutoff for this stage."
                                )
                              : (
                                  t("tournament.pointsTableNoteStage") ||
                                  "This table shows the standings for the selected stage."
                                )}
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
                 </>
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