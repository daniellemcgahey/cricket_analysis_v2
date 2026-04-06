// src/pages/PostTournament.js
import React, { useContext, useEffect, useState, useMemo } from "react";
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  Modal,
  Tabs,
  Tab,
  ProgressBar,
} from "react-bootstrap";
import DarkModeContext from "../DarkModeContext";
import { useTheme } from "../theme/ThemeContext";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../language/LanguageContext";
import BackButton from "../components/BackButton";
import api from "../api";

/** ===================== Config ===================== */

const CATEGORIES = ["Men", "Women", "U19 Men", "U19 Women", "Training"];

// Tournament-level endpoints
const EP_TOURNAMENTS = "/posttournament/tournaments"; // GET ?teamCategory=
const EP_TOURNAMENT_TEAMS = "/posttournament/teams"; // GET ?tournament_id=
const EP_TOURNAMENT_PLAYERS = "/posttournament/players"; // GET ?tournament_id=&team_id=
const EP_TOURNAMENT_PLAYER_SUMMARY =
  "/posttournament/player-summary"; // GET ?tournament_id=&team_id=&player_id=&team_category=
const EP_TEAM_SUMMARY = "/posttournament/team-summary"; // POST {teamCategory, tournamentId, teamId}

/** ===================== Small UI helpers ===================== */

function MetricRow({ label, value, sub }) {
  return (
    <div className="d-flex justify-content-between align-items-center mb-2">
      <div className="me-3">
        <div className="small text-muted text-uppercase">{label}</div>
        {sub && <div className="small text-muted">{sub}</div>}
      </div>
      <div className="fw-semibold text-end" style={{ minWidth: 80 }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function SectionBlock({ title, children }) {
  // Same style as other pages – use theme + optional tab translation
  const { isDarkMode } = useContext(DarkModeContext);
  const theme = useTheme();
  const { t } = useLanguage();

  const cardBg = useMemo(
    () =>
      `linear-gradient(135deg, ${theme.primaryColor}33, ${theme.accentColor}33)`,
    [theme.primaryColor, theme.accentColor]
  );
  const cardBorder = isDarkMode
    ? "rgba(148,163,184,0.45)"
    : "rgba(15,23,42,0.08)";

  // Tab-title translation fallback only (unchanged pattern)
  const translatedTitle = useMemo(() => {
    const key = `tabs.${title}`;
    const val = t(key);
    return val !== key ? val : title;
  }, [title, t]);

  return (
    <Card
      className="mb-3"
      style={{
        borderRadius: 14,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
      }}
    >
      <Card.Body>
        <div className="fw-bold mb-2">{translatedTitle}</div>
        {children}
      </Card.Body>
    </Card>
  );
}

/** ===================== Page ===================== */

export default function PostTournament() {
  const { isDarkMode } = useContext(DarkModeContext);
  

  const theme = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Themed colours
  const cardBg = useMemo(
    () =>
      `linear-gradient(135deg, ${theme.primaryColor}33, ${theme.accentColor}33)`,
    [theme.primaryColor, theme.accentColor]
  );
  const cardBorder = isDarkMode
    ? "rgba(148,163,184,0.45)"
    : "rgba(15,23,42,0.08)";
  const cardStyle = {
    borderRadius: 14,
    background: cardBg,
    border: `1px solid ${cardBorder}`,
  };

  // -------- Filters --------
  const initialCategory = user?.teamCategory || "Men";
  const [category, setCategory] = useState(initialCategory);
  useEffect(() => setCategory(initialCategory), [initialCategory]);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");

  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const [players, setPlayers] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");

  // -------- Player summary --------
  const [playerSummary, setPlayerSummary] = useState(null);
  const [playerSummaryLoading, setPlayerSummaryLoading] = useState(false);
  const [playerSummaryError, setPlayerSummaryError] = useState("");

  // modal/tab
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [playerModalTab, setPlayerModalTab] = useState("Batting");

  // -------- Team summary --------
  const [teamSummary, setTeamSummary] = useState(null);
  const [teamSummaryLoading, setTeamSummaryLoading] = useState(false);
  const [teamSummaryError, setTeamSummaryError] = useState("");
  const [showTeamModal, setShowTeamModal] = useState(false);

  // loading for filters / dropdowns
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [error, setError] = useState("");

  /** -------- Load tournaments for category -------- */
  useEffect(() => {
    let mounted = true;
    setError("");
    setTournaments([]);
    setSelectedTournamentId("");
    setTeams([]);
    setSelectedTeamId("");
    setPlayers([]);
    setSelectedPlayerId("");
    setPlayerSummary(null);
    setPlayerSummaryError("");
    setShowPlayerModal(false);
    setTeamSummary(null);
    setTeamSummaryError("");
    setShowTeamModal(false);

    setLoadingTournaments(true);
    api
      .get(EP_TOURNAMENTS, { params: { teamCategory: category } })
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.data?.tournaments)
          ? res.data.tournaments
          : [];
        setTournaments(list);
        if (list.length) {
          setSelectedTournamentId(String(list[0].id));
        }
      })
      .catch((err) => {
        console.error(err);
        setError(t("postTournament.errors.tournamentsLoad"));
      })
      .finally(() => setLoadingTournaments(false));

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  /** -------- Load teams for tournament -------- */
  useEffect(() => {
    if (!selectedTournamentId) {
      setTeams([]);
      setSelectedTeamId("");
      setPlayers([]);
      setSelectedPlayerId("");
      setPlayerSummary(null);
      setPlayerSummaryError("");
      setShowPlayerModal(false);
      setTeamSummary(null);
      setTeamSummaryError("");
      setShowTeamModal(false);
      return;
    }

    let mounted = true;
    setError("");
    setTeams([]);
    setSelectedTeamId("");
    setPlayers([]);
    setSelectedPlayerId("");
    setPlayerSummary(null);
    setPlayerSummaryError("");
    setShowPlayerModal(false);
    setTeamSummary(null);
    setTeamSummaryError("");
    setShowTeamModal(false);

    setLoadingTeams(true);
    api
      .get(EP_TOURNAMENT_TEAMS, { params: { tournament_id: selectedTournamentId } })
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.data?.teams) ? res.data.teams : [];
        setTeams(list);
        if (list.length) {
          setSelectedTeamId(String(list[0].id));
        }
      })
      .catch((err) => {
        console.error(err);
        setError(t("postTournament.errors.teamsLoad"));
      })
      .finally(() => setLoadingTeams(false));

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTournamentId]);

  /** -------- Load players for team -------- */
  useEffect(() => {
    if (!selectedTournamentId || !selectedTeamId) {
      setPlayers([]);
      setSelectedPlayerId("");
      setPlayerSummary(null);
      setPlayerSummaryError("");
      setShowPlayerModal(false);
      setTeamSummary(null);
      setTeamSummaryError("");
      setShowTeamModal(false);
      return;
    }

    let mounted = true;
    setError("");
    setPlayers([]);
    setSelectedPlayerId("");
    setPlayerSummary(null);
    setPlayerSummaryError("");
    setShowPlayerModal(false);
    setTeamSummary(null);
    setTeamSummaryError("");
    setShowTeamModal(false);

    setLoadingPlayers(true);
    api
      .get(EP_TOURNAMENT_PLAYERS, {
        params: {
          tournament_id: selectedTournamentId,
          team_id: selectedTeamId,
        },
      })
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.data?.players) ? res.data.players : [];
        setPlayers(list);
        if (list.length) {
          setSelectedPlayerId(String(list[0].id));
        }
      })
      .catch((err) => {
        console.error(err);
        setError(t("postTournament.errors.playersLoad"));
      })
      .finally(() => setLoadingPlayers(false));

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTournamentId, selectedTeamId]);

  /** -------- Load player tournament summary -------- */
  useEffect(() => {
    if (!selectedTournamentId || !selectedTeamId || !selectedPlayerId) {
      setPlayerSummary(null);
      setPlayerSummaryError("");
      return;
    }

    let mounted = true;
    setPlayerSummary(null);
    setPlayerSummaryError("");
    setPlayerSummaryLoading(true);
    setPlayerModalTab("Batting");

    api
      .get(EP_TOURNAMENT_PLAYER_SUMMARY, {
        params: {
          tournament_id: selectedTournamentId,
          team_id: selectedTeamId,
          player_id: selectedPlayerId,
          team_category: category,
        },
      })
      .then((res) => {
        if (!mounted) return;
        setPlayerSummary(res.data || null);
      })
      .catch((err) => {
        console.error(err);
        setPlayerSummaryError(t("postTournament.errors.playerSummaryLoad"));
      })
      .finally(() => setPlayerSummaryLoading(false));

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTournamentId, selectedTeamId, selectedPlayerId, category]);

  /** -------- Fetch team tournament summary -------- */
  const fetchTeamSummary = () => {
    if (!selectedTournamentId || !selectedTeamId) {
      setTeamSummary(null);
      setTeamSummaryError(
        t("postTournament.teamSummary.selectTournamentAndTeamFirst")
      );
      return;
    }

    setTeamSummaryLoading(true);
    setTeamSummaryError("");

    api
      .post(EP_TEAM_SUMMARY, {
        teamCategory: category,
        tournamentId: Number(selectedTournamentId),
        teamId: Number(selectedTeamId),
      })
      .then((res) => {
        setTeamSummary(res.data || null);
      })
      .catch((err) => {
        console.error(err);
        setTeamSummaryError(t("postTournament.errors.teamSummaryLoad"));
      })
      .finally(() => {
        setTeamSummaryLoading(false);
      });
  };

  /** -------- Batting tab renderer (Tournament) -------- */
  const renderBattingSummary = () => {
    const batting = playerSummary?.batting;
    if (!batting || !batting.has_data) {
      return (
        <div className="text-muted">
          {t("postTournament.player.noBattingData")}
        </div>
      );
    }

    const runs = batting.runs ?? null;
    const balls = batting.balls ?? null;
    const sr = batting.strike_rate ?? null;

    const fours = batting.fours ?? 0;
    const sixes = batting.sixes ?? 0;
    const ones = batting.ones ?? 0;
    const twos = batting.twos ?? 0;
    const threes = batting.threes ?? 0;

    const boundaryPct = batting.boundary_percentage ?? null;
    const dotPct = batting.dot_ball_percentage ?? null;
    const scoringShotPct =
      typeof dotPct === "number" ? Number((100 - dotPct).toFixed(1)) : null;

    const phase = batting.phase_breakdown || {};
    const matchSummaries = Array.isArray(batting.match_summaries)
      ? batting.match_summaries
      : [];

    return (
      <>
        {/* Score (Tournament) */}
        <SectionBlock title={t("postTournament.batting.scoreSectionTitle")}>
          <MetricRow
            label={t("postTournament.batting.runsBallsLabel")}
            value={
              runs != null && balls != null
                ? `${runs} (${balls})`
                : runs != null
                ? runs
                : "—"
            }
          />
          <MetricRow
            label={t("postTournament.batting.strikeRateLabel")}
            value={sr != null ? sr.toFixed(1) : "—"}
            sub={t("postTournament.batting.strikeRateSub")}
          />
          <MetricRow
            label={t("postTournament.batting.foursSixesLabel")}
            value={`${fours} / ${sixes}`}
          />
          <MetricRow
            label={t("postTournament.batting.onesTwosThreesLabel")}
            value={`${ones} / ${twos} / ${threes}`}
          />
        </SectionBlock>

        {/* Scoring Shots (Tournament) */}
        <SectionBlock title={t("postTournament.batting.scoringShotsSectionTitle")}>
          <div className="mb-2">
            <div className="d-flex justify-content-between mb-1">
              <span className="small text-muted text-uppercase">
                {t("postTournament.batting.scoringShotPctLabel")}
              </span>
              <span className="fw-semibold">
                {scoringShotPct != null
                  ? `${scoringShotPct.toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <ProgressBar
              now={scoringShotPct != null ? scoringShotPct : 0}
              variant={
                scoringShotPct == null
                  ? "secondary"
                  : scoringShotPct >= 60
                  ? "success"
                  : scoringShotPct >= 50
                  ? "warning"
                  : "danger"
              }
            />
          </div>
          <MetricRow
            label={t("postTournament.batting.boundaryPctLabel")}
            value={
              boundaryPct != null ? `${boundaryPct.toFixed(1)}%` : "—"
            }
            sub={t("postTournament.batting.boundaryPctSub")}
          />
        </SectionBlock>

        {/* Phases (Tournament) */}
        <SectionBlock title={t("postTournament.batting.phasesSectionTitle")}>
          {/* Powerplay */}
          <MetricRow
            label={t("tabs.Powerplay")}
            value={
              phase.powerplay_runs != null || phase.powerplay_balls != null
                ? `${phase.powerplay_runs ?? 0} ${
                    t("postGame.common.runsWord")
                  }${
                    phase.powerplay_balls != null
                      ? ` | ${phase.powerplay_balls} ${t(
                          "postGame.common.ballsWord"
                        )}`
                      : ""
                  }`
                : "—"
            }
            sub={
              phase.powerplay_scoring_shot_pct != null
                ? `${phase.powerplay_scoring_shot_pct.toFixed(
                    1
                  )}% ${t("postGame.common.scoringShotsWord")}`
                : undefined
            }
          />

          {/* Middle overs */}
          <MetricRow
            label={t("tabs.Middle Overs")}
            value={
              phase.middle_overs_runs != null ||
              phase.middle_overs_balls != null
                ? `${phase.middle_overs_runs ?? 0} ${
                    t("postGame.common.runsWord")
                  }${
                    phase.middle_overs_balls != null
                      ? ` | ${phase.middle_overs_balls} ${t(
                          "postGame.common.ballsWord"
                        )}`
                      : ""
                  }`
                : "—"
            }
            sub={
              phase.middle_overs_scoring_shot_pct != null
                ? `${phase.middle_overs_scoring_shot_pct.toFixed(
                    1
                  )}% ${t("postGame.common.scoringShotsWord")}`
                : undefined
            }
          />

          {/* Death overs */}
          <MetricRow
            label={t("tabs.Death Overs")}
            value=
              {phase.death_overs_runs != null ||
              phase.death_overs_balls != null
                ? `${phase.death_overs_runs ?? 0} ${
                    t("postGame.common.runsWord")
                  }${
                    phase.death_overs_balls != null
                      ? ` | ${phase.death_overs_balls} ${t(
                          "postGame.common.ballsWord"
                        )}`
                      : ""
                  }`
                : "—"}
            sub={
              phase.death_overs_scoring_shot_pct != null
                ? `${phase.death_overs_scoring_shot_pct.toFixed(
                    1
                  )}% ${t("postGame.common.scoringShotsWord")}`
                : undefined
            }
          />
        </SectionBlock>

        {/* Match-by-Match Tournament Summary */}
        {matchSummaries.length > 0 && (
          <SectionBlock
            title={t("postTournament.batting.matchSummarySectionTitle")}
          >
            {matchSummaries.map((ms) => {
              const ss = ms.scoring_shot_pct;
              const ssDisplay = ss != null ? `${ss.toFixed(1)}%` : "—";

              const barVariant =
                ss == null
                  ? "secondary"
                  : ss >= 60
                  ? "success"
                  : ss >= 50
                  ? "warning"
                  : "danger";

              return (
                <Card key={ms.match_id} className="mb-2">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <div>
                        <div className="small text-muted">
                          {t("home.vs")}
                        </div>
                        <div className="fw-semibold">{ms.opponent}</div>
                      </div>
                      <div className="text-end">
                        <div className="small text-muted">
                          {ms.dismissal}
                        </div>
                        <div className="fw-semibold">
                          {ms.runs} {t("postGame.common.runsWord")}{" "}
                          {t("postGame.common.ballsWord")
                            ? ` ${t("postGame.common.ballsWord")}`
                            : ""}{" "}
                          {t("postGame.common.ballsWord") &&
                          ms.balls != null
                            ? ` (${ms.balls})`
                            : `from ${ms.balls} ${t(
                                "postGame.common.ballsWord"
                              )}`}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="small text-muted">
                          {t("postTournament.batting.scoringShotPctLabel")}
                        </span>
                        <span className="fw-semibold">
                          {ssDisplay}
                        </span>
                      </div>
                      <ProgressBar
                        now={ss != null ? ss : 0}
                        variant={barVariant}
                      />
                    </div>
                  </Card.Body>
                </Card>
              );
            })}
          </SectionBlock>
        )}
      </>
    );
  };

  // -------- Bowling tab renderer (Tournament) --------
  const renderBowlingSummary = () => {
    const bowling = playerSummary?.bowling;
    if (!bowling || !bowling.has_data) {
      return (
        <div className="text-muted">
          {t("postTournament.player.noBowlingData")}
        </div>
      );
    }

    const overs = bowling.overs ?? null;
    const runs = bowling.runs_conceded ?? null;
    const wkts = bowling.wickets ?? null;
    const econ = bowling.economy ?? null;
    const dotPct = bowling.dot_ball_percentage ?? null;
    const dotBallsCount = bowling.dot_balls ?? null;

    const phase = bowling.phase_breakdown || {};
    const matchSummaries = Array.isArray(bowling.match_summaries)
      ? bowling.match_summaries
      : [];

    const dotPctDisplay =
      dotPct != null ? `${dotPct.toFixed(1)}%` : "—";

    const dotBarVariant =
      dotPct == null
        ? "secondary"
        : dotPct >= 60
        ? "success"
        : dotPct >= 50
        ? "warning"
        : "danger";

    return (
      <>
        {/* Figures (Tournament) with dot ball progress bar */}
        <SectionBlock title={t("postTournament.bowling.figuresSectionTitle")}>
          <MetricRow
            label={t("postTournament.bowling.figuresLabel")}
            value={
              overs != null ||
              dotBallsCount != null ||
              runs != null ||
              wkts != null
                ? `${overs ?? 0}-${dotBallsCount ?? 0}-${runs ?? 0}-${
                    wkts ?? 0
                  }`
                : "—"
            }
          />
          <MetricRow
            label={t("postTournament.bowling.economyLabel")}
            value={econ != null ? econ.toFixed(2) : "—"}
            sub={t("postTournament.bowling.economySub")}
          />

          <div className="mt-2">
            <div className="d-flex justify-content-between mb-1">
              <span className="small text-muted text-uppercase">
                {t("postTournament.bowling.dotBallPctLabel")}
              </span>
              <span className="fw-semibold">{dotPctDisplay}</span>
            </div>
            <ProgressBar
              now={dotPct != null ? dotPct : 0}
              variant={dotBarVariant}
            />
          </div>
        </SectionBlock>

        {/* Extras & Boundaries */}
        <SectionBlock title={t("postTournament.bowling.extrasSectionTitle")}>
          <MetricRow
            label={t("postGame.bowling.widesLabel")}
            value={bowling.wides ?? 0}
          />
          <MetricRow
            label={t("postGame.bowling.noBallsLabel")}
            value={bowling.no_balls ?? 0}
          />
          <MetricRow
            label={t("postGame.bowling.boundaryBallsLabel")}
            value={bowling.boundary_balls ?? 0}
          />
        </SectionBlock>

        {/* Phases (Tournament) – including wickets */}
        <SectionBlock title={t("postTournament.bowling.phasesSectionTitle")}>
          {/* Powerplay */}
          <MetricRow
            label={t("tabs.Powerplay")}
            value={
              phase.powerplay_overs != null ||
              phase.powerplay_runs != null ||
              phase.powerplay_wickets != null ||
              phase.powerplay_dot_balls != null
                ? `${(phase.powerplay_overs ?? 0).toFixed(1)}-${
                    phase.powerplay_dot_balls ?? 0
                  }-${phase.powerplay_runs ?? 0}-${
                    phase.powerplay_wickets ?? 0
                  }`
                : "—"
            }
            sub={
              phase.powerplay_dot_ball_pct != null
                ? `${phase.powerplay_dot_ball_pct.toFixed(
                    1
                  )}% ${t("postGame.common.dotBallsWord")}`
                : undefined
            }
          />

          {/* Middle overs */}
          <MetricRow
            label={t("tabs.Middle Overs")}
            value={
              phase.middle_overs_overs != null ||
              phase.middle_overs_runs != null ||
              phase.middle_overs_wickets != null ||
              phase.middle_overs_dot_balls != null
                ? `${(phase.middle_overs_overs ?? 0).toFixed(1)}-${
                    phase.middle_overs_dot_balls ?? 0
                  }-${phase.middle_overs_runs ?? 0}-${
                    phase.middle_overs_wickets ?? 0
                  }`
                : "—"
            }
            sub={
              phase.middle_overs_dot_ball_pct != null
                ? `${phase.middle_overs_dot_ball_pct.toFixed(
                    1
                  )}% ${t("postGame.common.dotBallsWord")}`
                : undefined
            }
          />

          {/* Death overs */}
          <MetricRow
            label={t("tabs.Death Overs")}
            value={
              phase.death_overs_overs != null ||
              phase.death_overs_runs != null ||
              phase.death_overs_wickets != null ||
              phase.death_overs_dot_balls != null
                ? `${(phase.death_overs_overs ?? 0).toFixed(1)}-${
                    phase.death_overs_dot_balls ?? 0
                  }-${phase.death_overs_runs ?? 0}-${
                    phase.death_overs_wickets ?? 0
                  }`
                : "—"
            }
            sub={
              phase.death_overs_dot_ball_pct != null
                ? `${phase.death_overs_dot_ball_pct.toFixed(
                    1
                  )}% ${t("postGame.common.dotBallsWord")}`
                : undefined
            }
          />
        </SectionBlock>

        {/* Match-by-Match Bowling Summary (Tournament) */}
        {matchSummaries.length > 0 && (
          <SectionBlock
            title={t("postTournament.bowling.matchSummarySectionTitle")}
          >
            {matchSummaries.map((ms) => {
              const dot = ms.dot_ball_pct;
              const dotDisplay =
                dot != null ? `${dot.toFixed(1)}%` : "—";

              const matchBarVariant =
                dot == null
                  ? "secondary"
                  : dot >= 60
                  ? "success"
                  : dot >= 50
                  ? "warning"
                  : "danger";

              const oversVal =
                ms.overs != null ? Number(ms.overs) : 0;
              const oversStr = oversVal.toFixed(1);

              const dotsVal = ms.dot_balls ?? 0;
              const runsVal =
                ms.runs_conceded != null
                  ? ms.runs_conceded
                  : ms.runs ?? 0;
              const wktsVal = ms.wickets ?? 0;

              return (
                <Card key={ms.match_id} className="mb-2">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <div>
                        <div className="small text-muted">
                          {t("home.vs")}
                        </div>
                        <div className="fw-semibold">
                          {ms.opponent}
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="small text-muted">
                          {t("postGame.bowling.figuresSectionTitle")}
                        </div>
                        <div className="fw-semibold">
                          {oversStr}-{dotsVal}-{runsVal}-{wktsVal}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="small text-muted">
                          {t("postTournament.bowling.dotBallPctLabel")}
                        </span>
                        <span className="fw-semibold">
                          {dotDisplay}
                        </span>
                      </div>
                      <ProgressBar
                        now={dot != null ? dot : 0}
                        variant={matchBarVariant}
                      />
                    </div>
                  </Card.Body>
                </Card>
              );
            })}
          </SectionBlock>
        )}
      </>
    );
  };

  /** -------- Fielding tab renderer (Tournament) -------- */
  const renderFieldingSummary = () => {
    const fielding = playerSummary?.fielding;
    if (!fielding || !fielding.has_data) {
      return (
        <div className="text-muted">
          {t("postTournament.player.noFieldingData")}
        </div>
      );
    }

    return (
      <>
        <SectionBlock title={t("postTournament.fielding.sectionTitleInvolvement")}>
          <MetricRow
            label={t("postTournament.fielding.ballsFieldedLabel")}
            value={fielding.balls_fielded ?? 0}
          />
          <MetricRow
            label={t("postTournament.fielding.cleanPickupsLabel")}
            value={fielding.clean_pickups ?? 0}
          />
          <MetricRow
            label={t("postTournament.fielding.fumblesLabel")}
            value={fielding.fumbles ?? 0}
          />
          <MetricRow
            label={t("postTournament.fielding.overthrowsConcededLabel")}
            value={fielding.overthrows_conceded ?? 0}
          />
        </SectionBlock>

        <SectionBlock title={t("postTournament.fielding.sectionTitleCatching")}>
          <MetricRow
            label={t("postTournament.fielding.catchesTakenLabel")}
            value={fielding.catches_taken ?? 0}
          />
          <MetricRow
            label={t("postTournament.fielding.dropsLabel")}
            value={fielding.missed_catches ?? 0}
          />
          <MetricRow
            label={t("postTournament.fielding.runOutsDirectLabel")}
            value={fielding.run_outs_direct ?? 0}
          />
          <MetricRow
            label={t("postTournament.fielding.runOutsAssistLabel")}
            value={fielding.run_outs_assist ?? 0}
          />
        </SectionBlock>

        <SectionBlock title={t("postTournament.fielding.sectionTitleQuality")}>
          <MetricRow
            label={t("postTournament.fielding.cleanHandsPctLabel")}
            value={
              fielding.clean_hands_pct != null
                ? `${fielding.clean_hands_pct.toFixed(1)}%`
                : "—"
            }
          />
          <MetricRow
            label={t("postTournament.fielding.chanceConversionPctLabel")}
            value={
              fielding.conversion_rate != null
                ? `${fielding.conversion_rate.toFixed(1)}%`
                : "—"
            }
          />
        </SectionBlock>
      </>
    );
  };

  /** -------- Team Tournament Summary renderer -------- */
  const renderTeamSummary = () => {
    if (!teamSummary) {
      return (
        <div className="text-muted">
          {t("postTournament.teamSummary.selectPrompt")}
        </div>
      );
    }

    const { overview, batting, bowling, fielding, leaders } = teamSummary;

    const clamp100 = (v) => Math.max(0, Math.min(100, v || 0));

    // Targets for radar-style scores
    const battingTargets = {
      runs_per_20: 130,      // target runs scored per 20 overs
      scoring_shot_pct: 55,
      boundary_pct: 18,
    };

    const bowlingTargets = {
      economy: 6.8,
      dot_pct: 55,
      runs_per_20_conceded: 120, // target runs conceded per 20 overs (lower is better)
    };

    const battingScores = {
      runs_per_20: clamp100(
        batting.runs_scored_per_20_overs
          ? (batting.runs_scored_per_20_overs / battingTargets.runs_per_20) *
              100
          : 0
      ),
      scoring_shot_pct: clamp100(
        batting.scoring_shot_pct
          ? (batting.scoring_shot_pct / battingTargets.scoring_shot_pct) *
              100
          : 0
      ),
      boundary_pct: clamp100(
        batting.boundary_pct
          ? (batting.boundary_pct / battingTargets.boundary_pct) * 100
          : 0
      ),
    };

    const bowlingScores = {
      economy: clamp100(
        bowling.economy
          ? (bowlingTargets.economy / bowling.economy) * 100
          : 0
      ),
      dot_pct: clamp100(
        bowling.dot_pct ? (bowling.dot_pct / bowlingTargets.dot_pct) * 100 : 0
      ),
      runs_per_20_conceded: clamp100(
        bowling.runs_conceded_per_20_overs
          ? (bowlingTargets.runs_per_20_conceded /
              bowling.runs_conceded_per_20_overs) *
              100
          : 0
      ),
    };

    const PHASE_LABELS = {
      PP: t("tabs.Powerplay"),
      MO: t("tabs.Middle Overs"),
      DO: t("tabs.Death Overs"),
    };

    const phaseKeys = ["PP", "MO", "DO"];

    const runsPer20 = batting.runs_scored_per_20_overs ?? null;
    const runsPer20Display =
      runsPer20 != null ? runsPer20.toFixed(1) : "—";
    const runsPer20Variant =
      runsPer20 == null
        ? "secondary"
        : runsPer20 >= battingTargets.runs_per_20
        ? "success"
        : runsPer20 >= battingTargets.runs_per_20 * 0.8
        ? "warning"
        : "danger";

    const runsPer20Conceded = bowling.runs_conceded_per_20_overs ?? null;
    const runsPer20ConcededDisplay =
      runsPer20Conceded != null ? runsPer20Conceded.toFixed(1) : "—";
    const runsPer20ConcededVariant =
      runsPer20Conceded == null
        ? "secondary"
        : runsPer20Conceded <= bowlingTargets.runs_per_20_conceded
        ? "success"
        : runsPer20Conceded <= bowlingTargets.runs_per_20_conceded * 1.15
        ? "warning"
        : "danger";

    return (
      <>
        {/* Overview */}
        <SectionBlock title={t("postTournament.teamSummary.overviewSectionTitle")}>
          <Row className="text-center mb-3">
            <Col xs={3}>
              <div className="h4 mb-0">
                {overview.matches_played ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.teamSummary.overviewMatchesLabel")}
              </small>
            </Col>
            <Col xs={3}>
              <div className="h4 mb-0 text-success">
                {overview.wins ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.teamSummary.overviewWinsLabel")}
              </small>
            </Col>
            <Col xs={3}>
              <div className="h4 mb-0 text-danger">
                {overview.losses ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.teamSummary.overviewLossesLabel")}
              </small>
            </Col>
            <Col xs={3}>
              <div className="h4 mb-0">
                {overview.no_result ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.teamSummary.overviewNoResultLabel")}
              </small>
            </Col>
          </Row>
          <Row className="text-center">
            <Col xs={4}>
              <div className="fw-semibold">
                {overview.win_pct != null
                  ? overview.win_pct.toFixed(1)
                  : "—"}
                %
              </div>
              <small className="text-muted">
                {t("postTournament.teamSummary.overviewWinPctLabel")}
              </small>
            </Col>
            <Col xs={4}>
              <div className="fw-semibold">
                {overview.run_rate_for != null
                  ? overview.run_rate_for.toFixed(2)
                  : "—"}
              </div>
              <small className="text-muted">
                {t("postTournament.teamSummary.overviewRunRateForLabel")}
              </small>
            </Col>
            <Col xs={4}>
              <div className="fw-semibold">
                {overview.net_run_rate != null
                  ? overview.net_run_rate.toFixed(2)
                  : "—"}
              </div>
              <small className="text-muted">
                {t("postTournament.teamSummary.overviewNetRunRateLabel")}
              </small>
            </Col>
          </Row>
        </SectionBlock>

        {/* Team Batting */}
        <SectionBlock title={t("postTournament.batting.sectionTitle")}>
          {/* Runs per 20 overs */}
          <div className="mb-3">
            <div className="d-flex justify-content-between mb-1">
              <span className="small text-muted text-uppercase">
                {t("postTournament.batting.runsPer20Label")}
              </span>
              <span className="fw-semibold">{runsPer20Display}</span>
            </div>
            <ProgressBar
              now={battingScores.runs_per_20}
              variant={runsPer20Variant}
            />
          </div>

          {/* Scoring shot % */}
          <div className="mb-3">
            <div className="d-flex justify-content-between mb-1">
              <span className="small text-muted text-uppercase">
                {t("postTournament.batting.scoringShotPctLabel")}
              </span>
              <span className="fw-semibold">
                {batting.scoring_shot_pct != null
                  ? `${batting.scoring_shot_pct.toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <ProgressBar
              now={battingScores.scoring_shot_pct}
              variant={
                batting.scoring_shot_pct >= 60
                  ? "success"
                  : batting.scoring_shot_pct >= 50
                  ? "warning"
                  : "danger"
              }
            />
          </div>

          {/* Boundary % */}
          <div className="mb-3">
            <div className="d-flex justify-content-between mb-1">
              <span className="small text-muted text-uppercase">
                {t("postTournament.batting.boundaryPctLabel")}
              </span>
              <span className="fw-semibold">
                {batting.boundary_pct != null
                  ? `${batting.boundary_pct.toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <ProgressBar
              now={battingScores.boundary_pct}
              variant={
                batting.boundary_pct >= battingTargets.boundary_pct
                  ? "success"
                  : batting.boundary_pct >=
                    battingTargets.boundary_pct * 0.7
                  ? "warning"
                  : "danger"
              }
            />
          </div>

          {/* Phase breakdown */}
          <div className="table-responsive">
            <table className="table table-sm table-striped mb-0">
              <thead>
                <tr>
                  <th>{t("postTournament.batting.tableHeaderPhase")}</th>
                  <th>{t("postTournament.batting.tableHeaderRuns")}</th>
                  <th>{t("postTournament.batting.tableHeaderSsPctShort")}</th>
                  <th>{t("postTournament.batting.tableHeaderOvers")}</th>
                  <th>{t("postTournament.batting.tableHeaderRunRateShort")}</th>
                  <th>{t("postTournament.batting.tableHeaderWickets")}</th>
                </tr>
              </thead>
              <tbody>
                {phaseKeys.map((p) => {
                  const ph = batting.phase?.[p] || {};
                  return (
                    <tr key={p}>
                      <td>{PHASE_LABELS[p] || p}</td>
                      <td>{ph.runs ?? "—"}</td>
                      <td>
                        {ph.scoring_shot_pct != null
                          ? ph.scoring_shot_pct.toFixed(1)
                          : "—"}
                      </td>
                      <td>
                        {ph.overs != null ? ph.overs.toFixed(1) : "—"}
                      </td>
                      <td>
                        {ph.run_rate != null
                          ? ph.run_rate.toFixed(2)
                          : "—"}
                      </td>
                      <td>{ph.wickets ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionBlock>

        {/* Team Bowling */}
        <SectionBlock title={t("postTournament.bowling.sectionTitle")}>
          {/* Runs conceded per 20 overs */}
          <div className="mb-3">
            <div className="d-flex justify-content-between mb-1">
              <span className="small text-muted text-uppercase">
                {t("postTournament.bowling.runsPer20ConcededLabel")}
              </span>
              <span className="fw-semibold">
                {runsPer20ConcededDisplay}
              </span>
            </div>
            <ProgressBar
              now={bowlingScores.runs_per_20_conceded}
              variant={runsPer20ConcededVariant}
            />
          </div>

          {/* Economy */}
          <div className="mb-3">
            <div className="d-flex justify-content-between mb-1">
              <span className="small text-muted text-uppercase">
                {t("postTournament.bowling.economyRateLabel")}
              </span>
              <span className="fw-semibold">
                {bowling.economy != null
                  ? bowling.economy.toFixed(2)
                  : "—"}
              </span>
            </div>
            <ProgressBar
              now={bowlingScores.economy}
              variant={
                bowling.economy <= bowlingTargets.economy
                  ? "success"
                  : bowling.economy <= bowlingTargets.economy * 1.15
                  ? "warning"
                  : "danger"
              }
            />
          </div>

          {/* Dot ball % */}
          <div className="mb-3">
            <div className="d-flex justify-content-between mb-1">
              <span className="small text-muted text-uppercase">
                {t("postTournament.bowling.dotBallPctTeamLabel")}
              </span>
              <span className="fw-semibold">
                {bowling.dot_pct != null
                  ? `${bowling.dot_pct.toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <ProgressBar
              now={bowlingScores.dot_pct}
              variant={
                bowling.dot_pct >= 60
                  ? "success"
                  : bowling.dot_pct >= 50
                  ? "warning"
                  : "danger"
              }
            />
          </div>

          {/* Phase breakdown */}
          <div className="table-responsive">
            <table className="table table-sm table-striped mb-0">
              <thead>
                <tr>
                  <th>{t("postTournament.bowling.tableHeaderPhase")}</th>
                  <th>{t("postTournament.bowling.tableHeaderRunsConceded")}</th>
                  <th>{t("postTournament.bowling.tableHeaderDotPctShort")}</th>
                  <th>{t("postTournament.bowling.tableHeaderOvers")}</th>
                  <th>{t("postTournament.bowling.tableHeaderEconomyShort")}</th>
                  <th>{t("postTournament.bowling.tableHeaderWicketsShort")}</th>
                </tr>
              </thead>
              <tbody>
                {phaseKeys.map((p) => {
                  const ph = bowling.phase?.[p] || {};
                  return (
                    <tr key={p}>
                      <td>{PHASE_LABELS[p] || p}</td>
                      <td>{ph.runs_conceded ?? "—"}</td>
                      <td>
                        {ph.dot_pct != null ? ph.dot_pct.toFixed(1) : "—"}
                      </td>
                      <td>
                        {ph.overs != null ? ph.overs.toFixed(1) : "—"}
                      </td>
                      <td>
                        {ph.economy != null
                          ? ph.economy.toFixed(2)
                          : "—"}
                      </td>
                      <td>{ph.wickets ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionBlock>

        {/* Fielding */}
        <SectionBlock title={t("postTournament.fielding.sectionTitleTeam")}>
          {/* Top row: dismissals */}
          <Row className="text-center mb-3">
            <Col xs={3}>
              <div className="h5 mb-0">
                {fielding.catches ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.fielding.catchesLabel")}
              </small>
            </Col>
            <Col xs={3}>
              <div className="h5 mb-0">
                {fielding.stumpings ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.fielding.stumpingsLabel")}
              </small>
            </Col>
            <Col xs={3}>
              <div className="h5 mb-0">
                {fielding.run_outs ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.fielding.runOutsLabel")}
              </small>
            </Col>
            <Col xs={3}>
              <div className="h5 mb-0 text-warning">
                {fielding.drop_catches ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.fielding.dropsShortLabel")}
              </small>
            </Col>
          </Row>

          {/* Second row: chances / ground fielding */}
          <Row className="text-center mb-3">
            <Col xs={3}>
              <div className="h6 mb-0 text-warning">
                {fielding.missed_run_outs ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.fielding.missedRunOutsLabel")}
              </small>
            </Col>
            <Col xs={3}>
              <div className="h6 mb-0">
                {fielding.clean_pickups ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.fielding.cleanPickupsLabel")}
              </small>
            </Col>
            <Col xs={3}>
              <div className="h6 mb-0 text-warning">
                {fielding.fumbles ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.fielding.fumblesLabel")}
              </small>
            </Col>
            <Col xs={3}>
              <div className="h6 mb-0 text-warning">
                {fielding.overthrows ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.fielding.overthrowsLabel")}
              </small>
            </Col>
          </Row>

          {/* Discipline */}
          <Row className="text-center">
            <Col xs={6}>
              <div className="h6 mb-0 text-warning">
                {fielding.discipline?.wides ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.fielding.widesLabel")}
              </small>
            </Col>
            <Col xs={6}>
              <div className="h6 mb-0 text-warning">
                {fielding.discipline?.no_balls ?? 0}
              </div>
              <small className="text-muted">
                {t("postTournament.fielding.noBallsLabel")}
              </small>
            </Col>
          </Row>
        </SectionBlock>

        <SectionBlock title={t("postTournament.leaders.sectionTitle")}>
          <Row>
            {/* Batting */}
            <Col md={4} className="mb-3">
              <div className="fw-semibold mb-2">
                {t("postTournament.leaders.battingHeading")}
              </div>
              <ul className="list-group list-group-flush">
                {(leaders.batting || []).map((p) => (
                  <li
                    key={p.player_id}
                    className={
                      "list-group-item " +
                      (isDarkMode ? "bg-dark text-light" : "")
                    }
                  >
                    <div className="fw-semibold">{p.player_name}</div>
                    <small
                      className={isDarkMode ? "text-light" : "text-muted"}
                    >
                      {p.runs}{" "}
                      {t("postTournament.leaders.battingRunsSuffix")}
                      {p.strike_rate != null
                        ? ` • ${t(
                            "postTournament.leaders.battingSrShort"
                          )} ${p.strike_rate.toFixed(1)}`
                        : ""}
                    </small>
                  </li>
                ))}
                {(!leaders.batting || !leaders.batting.length) && (
                  <li
                    className={
                      "list-group-item small text-muted " +
                      (isDarkMode ? "bg-dark text-light" : "")
                    }
                  >
                    {t("postTournament.leaders.noBattingLeaders")}
                  </li>
                )}
              </ul>
            </Col>

            {/* Bowling */}
            <Col md={4} className="mb-3">
              <div className="fw-semibold mb-2">
                {t("postTournament.leaders.bowlingHeading")}
              </div>
              <ul className="list-group list-group-flush">
                {(leaders.bowling || []).map((p) => (
                  <li
                    key={p.player_id}
                    className={
                      "list-group-item " +
                      (isDarkMode ? "bg-dark text-light" : "")
                    }
                  >
                    <div className="fw-semibold">{p.player_name}</div>
                    <small
                      className={isDarkMode ? "text-light" : "text-muted"}
                    >
                      {p.wickets}{" "}
                      {t("postTournament.leaders.bowlingWicketsSuffix")}
                      {p.economy != null
                        ? ` • ${t(
                            "postTournament.leaders.bowlingEconShort"
                          )} ${p.economy.toFixed(2)}`
                        : ""}
                    </small>
                  </li>
                ))}
                {(!leaders.bowling || !leaders.bowling.length) && (
                  <li
                    className={
                      "list-group-item small text-muted " +
                      (isDarkMode ? "bg-dark text-light" : "")
                    }
                  >
                    {t("postTournament.leaders.noBowlingLeaders")}
                  </li>
                )}
              </ul>
            </Col>

            {/* Fielding */}
            <Col md={4} className="mb-3">
              <div className="fw-semibold mb-2">
                {t("postTournament.leaders.fieldingHeading")}
              </div>
              <ul className="list-group list-group-flush">
                {(leaders.fielding || []).map((p) => (
                  <li
                    key={p.player_id}
                    className={
                      "list-group-item " +
                      (isDarkMode ? "bg-dark text-light" : "")
                    }
                  >
                    <div className="fw-semibold">{p.player_name}</div>
                    <small
                      className={isDarkMode ? "text-light" : "text-muted"}
                    >
                      {p.catches ?? 0}{" "}
                      {t("postTournament.leaders.fieldingCatchesShort")} •{" "}
                      {p.run_outs ?? 0}{" "}
                      {t("postTournament.leaders.fieldingRunOutsShort")} •{" "}
                      {p.stumpings ?? 0}{" "}
                      {t("postTournament.leaders.fieldingStumpingsShort")}
                    </small>
                  </li>
                ))}
                {(!leaders.fielding || !leaders.fielding.length) && (
                  <li
                    className={
                      "list-group-item small text-muted " +
                      (isDarkMode ? "bg-dark text-light" : "")
                    }
                  >
                    {t("postTournament.leaders.noFieldingLeaders")}
                  </li>
                )}
              </ul>
            </Col>
          </Row>
        </SectionBlock>
      </>
    );
  };

  /** -------- Page layout -------- */
  return (
    <div className={isDarkMode ? "text-white" : "text-dark"}>
      <div className="container-fluid py-4">
        <BackButton isDarkMode={isDarkMode} />

        {/* Filters */}
        <Card className="mb-4 shadow-sm" style={cardStyle}>
          <Card.Body>
            <Row className="g-3 align-items-end">
              <Col md={3}>
                <Form.Label className="fw-bold">
                  {t("postTournament.filters.categoryLabel")}
                </Form.Label>
                <Form.Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={loadingTournaments}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`categories.${c}`) !== `categories.${c}`
                        ? t(`categories.${c}`)
                        : c}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={3}>
                <Form.Label className="fw-bold">
                  {t("postTournament.filters.tournamentLabel")}
                </Form.Label>
                <Form.Select
                  value={selectedTournamentId}
                  onChange={(e) => setSelectedTournamentId(e.target.value)}
                  disabled={loadingTournaments || !tournaments.length}
                >
                  {!tournaments.length && (
                    <option value="">
                      {t("postTournament.filters.noTournaments")}
                    </option>
                  )}
                  {tournaments.map((tour) => (
                    <option key={tour.id} value={tour.id}>
                      {tour.name}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={3}>
                <Form.Label className="fw-bold">
                  {t("postTournament.filters.teamLabel")}
                </Form.Label>
                <Form.Select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  disabled={loadingTeams || !teams.length}
                >
                  {!teams.length && (
                    <option value="">
                      {t("postTournament.filters.noTeams")}
                    </option>
                  )}
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col md={3}>
                <Form.Label className="fw-bold">
                  {t("postTournament.filters.playerLabel")}
                </Form.Label>
                <Form.Select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  disabled={loadingPlayers || !players.length}
                >
                  {!players.length && (
                    <option value="">
                      {t("postTournament.filters.noPlayers")}
                    </option>
                  )}
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            </Row>

            {(loadingTournaments || loadingTeams || loadingPlayers) && (
              <div className="mt-3">
                <Spinner animation="border" size="sm" />{" "}
                <span className="small">{t("common.loading")}</span>
              </div>
            )}

            {error && (
              <Alert className="mt-3" variant="danger">
                {error}
              </Alert>
            )}
          </Card.Body>
        </Card>

        {/* Cards grid, to mirror PostGame style */}
        <Row className="g-4">
          {/* Player Tournament Summary Card */}
          <Col md={4}>
            <Card className="h-100 shadow" style={cardStyle}>
              <Card.Body>
                <Card.Title className="fw-bold">
                  {t("postTournament.cards.playerSummaryTitle")}
                </Card.Title>
                <Card.Text className="mb-3">
                  {t("postTournament.cards.playerSummaryDescription")}
                </Card.Text>
                <Button
                  disabled={
                    !selectedPlayerId ||
                    loadingTournaments ||
                    loadingTeams ||
                    loadingPlayers ||
                    playerSummaryLoading ||
                    !!playerSummaryError
                  }
                  onClick={() => setShowPlayerModal(true)}
                >
                  {playerSummaryLoading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      {t("common.loading")}
                    </>
                  ) : (
                    t("open")
                  )}
                </Button>
                {playerSummaryError && (
                  <Alert variant="danger" className="mt-3 mb-0 py-2">
                    {playerSummaryError}
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Team Tournament Summary Card */}
          <Col md={4}>
            <Card className="h-100 shadow" style={cardStyle}>
              <Card.Body>
                <Card.Title className="fw-bold">
                  {t("postTournament.cards.teamSummaryTitle")}
                </Card.Title>
                <Card.Text className="mb-3">
                  {t("postTournament.cards.teamSummaryDescription")}
                </Card.Text>
                <Button
                  disabled={
                    !selectedTeamId ||
                    loadingTournaments ||
                    loadingTeams ||
                    teamSummaryLoading
                  }
                  onClick={() => {
                    fetchTeamSummary();
                    setShowTeamModal(true);
                  }}
                >
                  {teamSummaryLoading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      {t("common.loading")}
                    </>
                  ) : (
                    t("open")
                  )}
                </Button>
                {teamSummaryError && (
                  <Alert variant="danger" className="mt-3 mb-0 py-2">
                    {teamSummaryError}
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Player Summary Modal */}
      <Modal
        show={showPlayerModal}
        onHide={() => setShowPlayerModal(false)}
        size="lg"
        centered
        contentClassName={isDarkMode ? "bg-dark text-white" : ""}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {t("postTournament.player.modalTitle")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {playerSummaryError && (
            <Alert variant="danger" className="mb-2">
              {playerSummaryError}
            </Alert>
          )}

          {playerSummaryLoading && (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          )}

          {!playerSummaryLoading && playerSummary && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <div className="small text-muted">
                    {t("postTournament.player.labels.player")}
                  </div>
                  <div className="fw-bold">{playerSummary.player_name}</div>
                </div>
                <div className="text-end">
                  <div className="small text-muted">
                    {t("postTournament.player.labels.team")}
                  </div>
                  <div className="fw-bold">{playerSummary.team_name}</div>
                </div>
              </div>

              <Tabs
                id="tournament-player-summary-tabs"
                activeKey={playerModalTab}
                onSelect={(key) => setPlayerModalTab(key || "Batting")}
                className="mb-2"
                justify
              >
                <Tab
                  eventKey="Batting"
                  title={
                    t("tabs.Batting") !== "tabs.Batting"
                      ? t("tabs.Batting")
                      : "Batting"
                  }
                >
                  {renderBattingSummary()}
                </Tab>
                <Tab
                  eventKey="Bowling"
                  title={
                    t("tabs.Bowling") !== "tabs.Bowling"
                      ? t("tabs.Bowling")
                      : "Bowling"
                  }
                >
                  {renderBowlingSummary()}
                </Tab>
                <Tab
                  eventKey="Fielding"
                  title={
                    t("tabs.Fielding") !== "tabs.Fielding"
                      ? t("tabs.Fielding")
                      : "Fielding"
                  }
                >
                  {renderFieldingSummary()}
                </Tab>
              </Tabs>
            </>
          )}

          {!playerSummaryLoading && !playerSummary && !playerSummaryError && (
            <div className="text-muted">
              {t("postTournament.player.selectPrompt")}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowPlayerModal(false)}
          >
            {t("common.close")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Team Summary Modal */}
      <Modal
        show={showTeamModal}
        onHide={() => setShowTeamModal(false)}
        size="lg"
        centered
        contentClassName={isDarkMode ? "bg-dark text-white" : ""}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {t("postTournament.teamSummary.modalTitle")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {teamSummaryError && (
            <Alert variant="danger" className="mb-2">
              {teamSummaryError}
            </Alert>
          )}

          {teamSummaryLoading && (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          )}

          {!teamSummaryLoading && !teamSummary && !teamSummaryError && (
            <div className="text-muted">
              {t("postTournament.teamSummary.selectPromptModal")}
            </div>
          )}

          {!teamSummaryLoading && teamSummary && renderTeamSummary()}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowTeamModal(false)}>
            {t("common.close")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
