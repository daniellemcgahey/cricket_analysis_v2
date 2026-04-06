// src/pages/PreGame.js
import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
} from "react";
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  Modal,
  Accordion,
  Table,
} from "react-bootstrap";

import DarkModeContext from "../DarkModeContext";
import { useTheme } from "../theme/ThemeContext";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../language/LanguageContext";
import api from "../api";

/* ---------------- Helpers to infer team + category ---------------- */

const inferCategoryFromName = (name = "") => {
  const lower = name.toLowerCase();

  if (lower.includes("u19") && lower.includes("women")) return "U19 Women";
  if (lower.includes("u19") && lower.includes("men")) return "U19 Men";
  if (lower.includes("u19")) {
    return lower.includes("women") ? "U19 Women" : "U19 Men";
  }

  if (lower.includes("women")) return "Women";
  if (lower.includes("men")) return "Men";

  // safest default
  return "Training";
};

const inferOurTeamFromTheme = (teamName = "") => {
  if (!teamName) return "";

  // strip generic words like U19 / Men / Women / U17 / U15 etc
  const parts = teamName
    .split(" ")
    .filter(
      (p) =>
        !/^u\d+$/i.test(p) &&
        !/women/i.test(p) &&
        !/men/i.test(p)
    );

  const cleaned = parts.join(" ").trim();
  return cleaned || teamName;
};

export default function PreGame() {
  const { isDarkMode } = useContext(DarkModeContext);
  const theme = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();

  const subtleText = isDarkMode ? "#9ca3af" : "#4b5563"; // slate-400 / 600
  const cardBg = `linear-gradient(135deg, ${theme.primaryColor}33, ${theme.accentColor}33)`; // slate-900ish / white
  const cardBorder = isDarkMode
    ? "rgba(148,163,184,0.45)"
    : "rgba(15,23,42,0.08)";

  // -------- Derive category + ourTeam from user + theme (LOCKED) --------
  const derivedCategory = useMemo(
    () =>
      user?.team_category ||
      user?.teamCategory ||
      inferCategoryFromName(theme.teamName || ""),
    [user, theme.teamName]
  );

  const derivedOurTeam = useMemo(
    () =>
      user?.country_name ||
      user?.country ||
      inferOurTeamFromTheme(theme.teamName || ""),
    [user, theme.teamName]
  );

  const [category, setCategory] = useState(derivedCategory);
  const [ourTeam, setOurTeam] = useState(derivedOurTeam);

  useEffect(() => setCategory(derivedCategory), [derivedCategory]);
  useEffect(() => setOurTeam(derivedOurTeam), [derivedOurTeam]);

  // -------- Core selectors --------
  const [countries, setCountries] = useState([]); // string[]
  const [opponent, setOpponent] = useState("");

  // Data for squads
  const [opponentPlayers, setOpponentPlayers] = useState([]); // [{id,name,...}]
  const [brasilBowlers, setBrasilBowlers] = useState([]);     // [{id,name,bowling_arm,bowling_style}]

  // Loading & errors
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingSquads, setLoadingSquads] = useState(false);
  const [error, setError] = useState("");

  // -------- Game Plan Modal --------
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedBatters, setSelectedBatters] = useState([]);             // ids
  const [selectedBrasilBowlers, setSelectedBrasilBowlers] = useState([]); // ids
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // -------- Venue Modal --------
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [venueOptions, setVenueOptions] = useState({ grounds: [], times: [] });
  const [selectedGround, setSelectedGround] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [venueLoading, setVenueLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [venueError, setVenueError] = useState("");
  const [venueInsights, setVenueInsights] = useState(null);

  // -------- Key Opposition Players Modal --------
  const [showKeyOppModal, setShowKeyOppModal] = useState(false);
  const [keyOppLoading, setKeyOppLoading] = useState(false);
  const [keyOppError, setKeyOppError] = useState("");
  const [keyOppData, setKeyOppData] = useState({ batters: [], bowlers: [] });

  // -------- Opposition S/W Modal --------
  const [showOppSW, setShowOppSW] = useState(false);
  const [swLoading, setSwLoading] = useState(false);
  const [swData, setSwData] = useState(null);
  const [swErr, setSwErr] = useState("");

  // -------- Batting Targets Modal --------
  const [showTargetsModal, setShowTargetsModal] = useState(false);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetsError, setTargetsError] = useState("");
  const [targetsData, setTargetsData] = useState(null);

  const [targetsVenueOptions, setTargetsVenueOptions] = useState({
    grounds: [],
    times: [],
  });
  const [targetsGround, setTargetsGround] = useState("");
  const [targetsTime, setTargetsTime] = useState("");
  const [targetsVenueLoading, setTargetsVenueLoading] = useState(false);

  // Optional knobs for targets
  const [includeRain, setIncludeRain] = useState(false);
  const [recencyDays, setRecencyDays] = useState(720);

  // Reserved for later (Do & Don’ts)
  const [showDoDont, setShowDoDont] = useState(false);
  const [ddLoading, setDdLoading] = useState(false);
  const [ddErr, setDdErr] = useState("");
  const [ddData, setDdData] = useState(null);

  const disabledCore = !ourTeam || !opponent || ourTeam === opponent;

  const allOpponentIds = useMemo(
    () => opponentPlayers.map((p) => p.id),
    [opponentPlayers]
  );
  const allBrasilBowlerIds = useMemo(
    () => brasilBowlers.map((b) => b.id),
    [brasilBowlers]
  );

  /* ================= LOAD COUNTRIES (locked category) ================= */

  useEffect(() => {
    if (!category) return;
    let mounted = true;
    setError("");
    setLoadingCountries(true);

    api
      .get("/countries", { params: { teamCategory: category } })
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.data)
          ? Array.from(new Set(res.data))
          : [];
        setCountries(list);

        // ourTeam is locked; opponent defaults to a *different* team
        const defOpp =
          list.find((n) => n !== ourTeam) ||
          list[0] ||
          "";
        setOpponent(defOpp);
      })
      .catch(() => setError(t("pregame.errors.couldNotLoadCountries")))
      .finally(() => setLoadingCountries(false));

    return () => {
      mounted = false;
    };
  }, [category, ourTeam, t]);

  /* ================= LOAD OPPONENT PLAYERS ================= */

  useEffect(() => {
    setOpponentPlayers([]);
    if (!opponent || !category) return;

    setError("");
    setLoadingSquads(true);

    api
      .get("/team-players", {
        params: { country_name: opponent, team_category: category },
      })
      .then((res) =>
        setOpponentPlayers(Array.isArray(res.data) ? res.data : [])
      )
      .catch(() => setError(t("pregame.errors.couldNotLoadOpponentPlayers")))
      .finally(() => setLoadingSquads(false));
  }, [opponent, category, t]);

  /* ================= LOAD OUR BOWLERS (LOCKED TEAM) ================= */

  useEffect(() => {
    setBrasilBowlers([]);
    if (!ourTeam || !category) return;

    setError("");
    setLoadingSquads(true);

    api
      .get("/team-players", {
        params: { country_name: ourTeam, team_category: category },
      })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setBrasilBowlers(list.filter((p) => p.bowling_style));
      })
      .catch(() => setError(t("pregame.errors.couldNotLoadOurBowlers")))
      .finally(() => setLoadingSquads(false));
  }, [ourTeam, category, t]);

  /* ================= GAME PLAN ================= */

  const openPlanModal = () => {
    if (disabledCore) {
      alert(t("pregame.alerts.chooseValidOpposition"));
      return;
    }
    setSelectedBatters(allOpponentIds.slice(0, 6)); // default top 6
    setSelectedBrasilBowlers(allBrasilBowlerIds);   // default all bowlers
    setShowPlanModal(true);
  };
  const closePlanModal = () => setShowPlanModal(false);

  const generateGamePlanPDF = async () => {
    if (selectedBatters.length === 0) {
      alert(t("pregame.alerts.selectAtLeastOneOppositionBatter"));
      return;
    }
    if (selectedBrasilBowlers.length === 0) {
      alert(t("pregame.alerts.selectAtLeastOneOurBowler"));
      return;
    }
    try {
      setGeneratingPDF(true);
      const payload = {
        opponent_country: opponent,
        player_ids: selectedBatters,
        bowler_ids: selectedBrasilBowlers,
        team_category: category,
      };
      const res = await api.post("/generate-game-plan-pdf", payload, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 5000);
      setShowPlanModal(false);
    } catch (e) {
      console.error(e);
      alert(t("pregame.errors.couldNotGenerateGamePlanPdf"));
    } finally {
      setGeneratingPDF(false);
    }
  };

  /* ================= VENUE & TOSS INSIGHTS ================= */

  const openVenueModal = async () => {
    setShowVenueModal(true);
    setVenueError("");
    setVenueInsights(null);
    setVenueLoading(true);
    try {
      const res = await api.get("/venue-options");
      const opts = res.data || { grounds: [], times: [] };
      setVenueOptions(opts);
      setSelectedGround(opts.grounds[0] || "");
      setSelectedTime(opts.times[0] || "");
    } catch (e) {
      console.error(e);
      setVenueError(t("pregame.errors.failedToLoadVenues"));
    } finally {
      setVenueLoading(false);
    }
  };
  const closeVenueModal = () => setShowVenueModal(false);

  const fetchVenueInsights = async () => {
    if (!selectedGround) {
      alert(t("pregame.alerts.selectGround"));
      return;
    }
    setInsightsLoading(true);
    setVenueError("");
    setVenueInsights(null);
    try {
      const params = {
        ground: selectedGround,
        team_category: category || undefined,
      };
      if (selectedTime) params.time_of_day = selectedTime;

      const res = await api.get("/venue-insights", { params });
      setVenueInsights(res.data);
    } catch (e) {
      console.error(e);
      setVenueError(t("pregame.errors.failedToLoadInsights"));
    } finally {
      setInsightsLoading(false);
    }
  };

  /* ================= KEY OPPOSITION PLAYERS ================= */

  const fetchKeyOppositionPlayers = async () => {
    setKeyOppError("");
    setKeyOppLoading(true);
    try {
      const res = await api.post("/opposition-key-players", {
        team_category: category,
        opponent_country: opponent,
      });
      setKeyOppData(res.data || { batters: [], bowlers: [] });
    } catch (e) {
      console.error(e);
      setKeyOppError(t("pregame.errors.failedToLoadKeyOppositionPlayers"));
    } finally {
      setKeyOppLoading(false);
    }
  };

  /* ================= OPPOSITION STRENGTHS & WEAKNESSES ================= */

  const loadOppSW = async () => {
    setSwErr("");
    setSwLoading(true);
    try {
      const res = await api.post("/opposition-strengths", {
        team_category: category,
        opponent_country: opponent,
      });
      setSwData(res.data);
    } catch (e) {
      console.error(e);
      setSwErr(t("pregame.errors.failedToLoadStrengthsWeaknesses"));
    } finally {
      setSwLoading(false);
    }
  };

  /* ================= BATTING TARGETS ================= */

  const openTargetsModal = async () => {
    if (disabledCore) {
      alert(t("pregame.alerts.chooseValidOpposition"));
      return;
    }
    setShowTargetsModal(true);
    setTargetsError("");
    setTargetsData(null);
    setTargetsVenueLoading(true);
    try {
      const res = await api.get("/venue-options");
      const opts = res.data || { grounds: [], times: [] };
      setTargetsVenueOptions(opts);
      setTargetsGround(opts.grounds[0] || "");
      setTargetsTime("");
    } catch (e) {
      console.error(e);
      setTargetsError(t("pregame.errors.failedToLoadVenues"));
    } finally {
      setTargetsVenueLoading(false);
    }
  };

  const closeTargetsModal = () => setShowTargetsModal(false);

  const fetchBattingTargets = async () => {
    if (!targetsGround) {
      alert(t("pregame.alerts.selectGround"));
      return;
    }
    setTargetsLoading(true);
    setTargetsError("");
    setTargetsData(null);
    try {
      const res = await api.get("/batting-targets-advanced", {
        params: {
          team_category: category,
          our_team: ourTeam,
          opponent_country: opponent,
          ground: targetsGround,
          time_of_day: targetsTime || undefined,
          recency_days: recencyDays,
          include_rain: includeRain,
        },
      });
      setTargetsData(res.data);
    } catch (e) {
      console.error(e);
      setTargetsError(t("pregame.errors.couldNotComputeBattingTargets"));
    } finally {
      setTargetsLoading(false);
    }
  };

  /* ================= Modal header/body styles ================= */

  const modalHeaderStyle = {
    background: isDarkMode
      ? `linear-gradient(135deg, ${theme.primaryColor}33, ${theme.accentColor}33)`
      : `linear-gradient(135deg, ${theme.primaryColor}0D, ${theme.accentColor}0D)`,
    borderBottom: isDarkMode
      ? "1px solid rgba(148,163,184,0.25)"
      : "1px solid rgba(148,163,184,0.2)",
  };

  const modalBodyStyle = {
    backgroundColor: isDarkMode ? "#020617" : "#ffffff",
  };

  const modalFooterStyle = {
    backgroundColor: isDarkMode ? "#020617" : "#ffffff",
    borderTop: isDarkMode
      ? "1px solid rgba(148,163,184,0.25)"
      : "1px solid rgba(148,163,184,0.2)",
  };

  /* ================= RENDER (SECTION, NOT FULL PAGE) ================= */

  return (
    <div style={{ marginTop: 32 }}>
      {/* SECTION HEADER */}
      <div className="mb-3">
        <h4 className="fw-bold mb-1">
          {t("pregame.title")}
        </h4>
      </div>

      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}

      {/* CORE MATCH CONTEXT CARD (ONLY OPPOSITION IS EDITABLE) */}
      <Card
        className="mb-4 shadow-sm"
        style={{
          borderRadius: 14,
          border: `1px solid ${cardBorder}`,
          background: cardBg,
        }}
      >
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={6}>
              <Form.Label className="fw-bold">
                {t("pregame.fields.opposition")}
              </Form.Label>
              <Form.Select
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                disabled={loadingCountries || !countries.length}
              >
                <option value="">{t("pregame.placeholders.selectOpposition")}</option>
                {countries
                  .filter((n) => !ourTeam || n !== ourTeam)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
              </Form.Select>
            </Col>

            <Col
              md={4}
              className="mt-3 mt-md-0"
              style={{ fontSize: 13, color: subtleText }}
            >
              {/* reserved for extra context/chips if needed */}
            </Col>

            <Col md={2} className="text-md-end">
              {(loadingCountries || loadingSquads) && (
                <Spinner animation="border" size="sm" />
              )}
            </Col>
          </Row>

          <div
            className="mt-3 small"
            style={{ color: subtleText, display: "flex", gap: 12, flexWrap: "wrap" }}
          >
            <span>
              <strong>{t("pregame.labels.matchup")} </strong>
              {ourTeam && opponent
                ? `${ourTeam} vs ${opponent}`
                : t("pregame.labels.selectOppositionToUnlockTools")}
            </span>
            {disabledCore && (
              <span>{t("pregame.labels.toolsUnlockOnceDifferentOpposition")}</span>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* TOOL GRID */}
      <Row className="g-4">
        {/* Game Plan */}
        <Col lg={4} md={6}>
          <Card
            className="h-100 shadow-sm"
            style={{
              borderRadius: 14,
              border: `1px solid ${cardBorder}`,
              background: cardBg,
            }}
          >
            <Card.Body>
              <Card.Title className="fw-bold mb-1">
                {t("pregame.cards.gamePlan.title")}
              </Card.Title>
              <Card.Text style={{ color: subtleText, fontSize: 14 }}>
                {t("pregame.cards.gamePlan.description")}
              </Card.Text>
              <Button
                disabled={disabledCore || loadingSquads}
                onClick={openPlanModal}
                size="sm"
              >
                {t("pregame.cards.gamePlan.button")}
              </Button>
            </Card.Body>
          </Card>
        </Col>

        {/* Key Opposition Players */}
        <Col lg={4} md={6}>
          <Card
            className="h-100 shadow-sm"
            style={{
              borderRadius: 14,
              border: `1px solid ${cardBorder}`,
              background: cardBg,
            }}
          >
            <Card.Body>
              <Card.Title className="fw-bold mb-1">
                {t("pregame.cards.keyOpposition.title")}
              </Card.Title>
              <Card.Text style={{ color: subtleText, fontSize: 14 }}>
                {t("pregame.cards.keyOpposition.description")}
              </Card.Text>
              <Button
                disabled={disabledCore || loadingSquads}
                onClick={() => setShowKeyOppModal(true)}
                size="sm"
              >
                {t("pregame.cards.keyOpposition.button")}
              </Button>
            </Card.Body>
          </Card>
        </Col>

        {/* Batting Targets */}
        <Col lg={4} md={6}>
          <Card
            className="h-100 shadow-sm"
            style={{
              borderRadius: 14,
              border: `1px solid ${cardBorder}`,
              background: cardBg,
            }}
          >
            <Card.Body>
              <Card.Title className="fw-bold mb-1">
                {t("pregame.cards.battingTargets.title")}
              </Card.Title>
              <Card.Text style={{ color: subtleText, fontSize: 14 }}>
                {t("pregame.cards.battingTargets.description")}
              </Card.Text>
              <Button disabled={disabledCore} onClick={openTargetsModal} size="sm">
                {t("pregame.cards.battingTargets.button")}
              </Button>
            </Card.Body>
          </Card>
        </Col>

        {/* Venue & Toss Insights */}
        <Col lg={4} md={6}>
          <Card
            className="h-100 shadow-sm"
            style={{
              borderRadius: 14,
              border: `1px solid ${cardBorder}`,
              background: cardBg,
            }}
          >
            <Card.Body>
              <Card.Title className="fw-bold mb-1">
                {t("pregame.cards.venueToss.title")}
              </Card.Title>
              <Card.Text style={{ color: subtleText, fontSize: 14 }}>
                {t("pregame.cards.venueToss.description")}
              </Card.Text>
              <Button disabled={disabledCore} onClick={openVenueModal} size="sm">
                {t("pregame.cards.venueToss.button")}
              </Button>
            </Card.Body>
          </Card>
        </Col>

        {/* Opposition S/W */}
        <Col lg={4} md={6}>
          <Card
            className="h-100 shadow-sm"
            style={{
              borderRadius: 14,
              border: `1px solid ${cardBorder}`,
              background: cardBg,
            }}
          >
            <Card.Body>
              <Card.Title className="fw-bold mb-1">
                {t("pregame.cards.strengthsWeaknesses.title")}
              </Card.Title>
              <Card.Text style={{ color: subtleText, fontSize: 14 }}>
                {t("pregame.cards.strengthsWeaknesses.description")}
              </Card.Text>
              <Button
                disabled={disabledCore}
                onClick={() => setShowOppSW(true)}
                size="sm"
              >
                {t("pregame.cards.strengthsWeaknesses.button")}
              </Button>
            </Card.Body>
          </Card>
        </Col>

        {/* Do & Don'ts – placeholder */}
        <Col lg={4} md={6}>
          <Card
            className="h-100 shadow-sm"
            style={{
              borderRadius: 14,
              border: `1px solid ${cardBorder}`,
              background: cardBg,
            }}
          >
            <Card.Body>
              <Card.Title className="fw-bold mb-1">
                {t("pregame.cards.doDonts.title")}
              </Card.Title>
              <Card.Text style={{ color: subtleText, fontSize: 14 }}>
                {t("pregame.cards.doDonts.description")}
              </Card.Text>
              <Button
                disabled
                size="sm"
                variant="outline-secondary"
                style={{ cursor: "not-allowed", opacity: 0.6 }}
              >
                {t("common.comingSoon")}
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ================= GAME PLAN MODAL ================= */}
      <Modal
        show={showPlanModal}
        onHide={closePlanModal}
        size="lg"
        centered
        contentClassName={isDarkMode ? "modal-shell-dark" : "modal-shell-light"}
      >
        <Modal.Header closeButton style={modalHeaderStyle}>
          <Modal.Title>
            {t("pregame.modals.gamePlan.title")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={modalBodyStyle}>
          <Row className="g-3">
            {/* Opposition batters */}
            <Col md={6}>
              <h6 className="fw-bold mb-2">
                {t("pregame.modals.gamePlan.oppositionBatters")}
              </h6>
              <div
                style={{
                  maxHeight: 320,
                  overflowY: "auto",
                  border: isDarkMode
                    ? "1px solid rgba(148,163,184,.4)"
                    : "1px solid rgba(0,0,0,.12)",
                  borderRadius: 6,
                  padding: 8,
                  backgroundColor: isDarkMode ? "#020617" : "#ffffff",
                }}
              >
                {opponentPlayers.length === 0 ? (
                  <div className="text-muted">
                    {loadingSquads
                      ? t("common.loading")
                      : t("pregame.modals.gamePlan.noPlayers")}
                  </div>
                ) : (
                  <>
                    <Form.Check
                      className="mb-2"
                      type="checkbox"
                      label={t("pregame.modals.gamePlan.selectTop6")}
                      checked={
                        selectedBatters.length ===
                        Math.min(6, opponentPlayers.length)
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBatters(
                            opponentPlayers.slice(0, 6).map((p) => p.id)
                          );
                        } else {
                          setSelectedBatters([]);
                        }
                      }}
                    />
                    <Form.Check
                      className="mb-2"
                      type="checkbox"
                      label={t("common.selectAll")}
                      checked={
                        selectedBatters.length === opponentPlayers.length &&
                        opponentPlayers.length > 0
                      }
                      onChange={(e) =>
                        setSelectedBatters(
                          e.target.checked
                            ? opponentPlayers.map((p) => p.id)
                            : []
                        )
                      }
                    />

                    <Accordion alwaysOpen>
                      <Accordion.Item eventKey="0">
                        <Accordion.Header>
                          {t("pregame.modals.gamePlan.battersAccordion")}
                        </Accordion.Header>
                        <Accordion.Body>
                          {opponentPlayers.map((p) => (
                            <Form.Check
                              key={p.id}
                              type="checkbox"
                              label={p.name}
                              checked={selectedBatters.includes(p.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBatters((prev) => [...prev, p.id]);
                                } else {
                                  setSelectedBatters((prev) =>
                                    prev.filter((id) => id !== p.id)
                                  );
                                }
                              }}
                            />
                          ))}
                        </Accordion.Body>
                      </Accordion.Item>
                    </Accordion>
                  </>
                )}
              </div>
            </Col>

            {/* Our bowlers */}
            <Col md={6}>
              <h6 className="fw-bold mb-2">
                {t("pregame.modals.gamePlan.ourBowlers")}
              </h6>
              <div
                style={{
                  maxHeight: 320,
                  overflowY: "auto",
                  border: isDarkMode
                    ? "1px solid rgba(148,163,184,.4)"
                    : "1px solid rgba(0,0,0,.12)",
                  borderRadius: 6,
                  padding: 8,
                  backgroundColor: isDarkMode ? "#020617" : "#ffffff",
                }}
              >
                {brasilBowlers.length === 0 ? (
                  <div className="text-muted">
                    {loadingSquads
                      ? t("common.loading")
                      : t("pregame.modals.gamePlan.noBowlers")}
                  </div>
                ) : (
                  <>
                    <Form.Check
                      className="mb-2"
                      type="checkbox"
                      label={t("common.selectAll")}
                      checked={
                        selectedBrasilBowlers.length ===
                          brasilBowlers.length && brasilBowlers.length > 0
                      }
                      onChange={(e) =>
                        setSelectedBrasilBowlers(
                          e.target.checked
                            ? brasilBowlers.map((b) => b.id)
                            : []
                        )
                      }
                    />

                    <Accordion alwaysOpen>
                      <Accordion.Item eventKey="0">
                        <Accordion.Header>
                          {t("pregame.modals.gamePlan.bowlersAccordion")}
                        </Accordion.Header>
                        <Accordion.Body>
                          {brasilBowlers.map((b) => (
                            <Form.Check
                              key={b.id}
                              type="checkbox"
                              label={`${b.name}${
                                b.bowling_style
                                  ? ` — ${b.bowling_style} (${b.bowling_arm})`
                                  : ""
                              }`}
                              checked={selectedBrasilBowlers.includes(b.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBrasilBowlers((prev) => [
                                    ...prev,
                                    b.id,
                                  ]);
                                } else {
                                  setSelectedBrasilBowlers((prev) =>
                                    prev.filter((id) => id !== b.id)
                                  );
                                }
                              }}
                            />
                          ))}
                        </Accordion.Body>
                      </Accordion.Item>
                    </Accordion>
                  </>
                )}
              </div>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer style={modalFooterStyle}>
          <Button variant="secondary" onClick={closePlanModal}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={generateGamePlanPDF}
            disabled={
              generatingPDF ||
              selectedBatters.length === 0 ||
              selectedBrasilBowlers.length === 0
            }
          >
            {generatingPDF ? (
              <Spinner animation="border" size="sm" />
            ) : (
              t("pregame.modals.gamePlan.generatePdfButton")
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* VENUE & TOSS INSIGHTS MODAL */}
      <Modal
        show={showVenueModal}
        onHide={closeVenueModal}
        centered
        contentClassName={isDarkMode ? "modal-shell-dark" : "modal-shell-light"}
      >
        <Modal.Header closeButton style={modalHeaderStyle}>
          <Modal.Title>
            {t("pregame.modals.venueToss.title")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={modalBodyStyle}>
          {venueError && (
            <Alert variant="danger" className="mb-2">
              {venueError}
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">
              {t("pregame.modals.venueToss.groundLabel")}
            </Form.Label>
            {venueLoading ? (
              <div>
                <Spinner animation="border" size="sm" />
              </div>
            ) : (
              <Form.Select
                value={selectedGround}
                onChange={(e) => setSelectedGround(e.target.value)}
              >
                {venueOptions.grounds.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Form.Select>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">
              {t("pregame.modals.venueToss.timeOfDayLabel")}
            </Form.Label>
            <Form.Select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
            >
              <option value="">
                {t("pregame.modals.venueToss.timeOfDayAny")}
              </option>
              {venueOptions.times.map((tOpt) => (
                <option key={tOpt} value={tOpt}>
                  {tOpt}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <div className="d-flex justify-content-end">
            <Button
              onClick={fetchVenueInsights}
              disabled={venueLoading || insightsLoading || !selectedGround}
            >
              {insightsLoading ? (
                <Spinner size="sm" animation="border" />
              ) : (
                t("pregame.modals.venueToss.showInsightsButton")
              )}
            </Button>
          </div>

          {venueInsights && (
            <Card
              className="mt-3"
              style={{
                backgroundColor: isDarkMode ? "#020617" : "#ffffff",
                borderColor: cardBorder,
              }}
            >
              <Card.Body>
                <h6 className="fw-bold mb-3">
                  {venueInsights.ground}
                  {venueInsights.time_of_day
                    ? `, ${venueInsights.time_of_day}`
                    : ""}
                </h6>
                <Table size="sm" bordered responsive>
                  <tbody>
                    <tr>
                      <td>
                        <strong>
                          {t("pregame.modals.venueToss.avgFirstInningsScore")}
                        </strong>
                      </td>
                      <td>{venueInsights.avg_first_innings ?? "—"}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>
                          {t("pregame.modals.venueToss.winRateBattingFirst")}
                        </strong>
                      </td>
                      <td>
                        {venueInsights.bat_first_win_rate_pct != null
                          ? `${venueInsights.bat_first_win_rate_pct}%`
                          : "—"}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>
                          {t("pregame.modals.venueToss.mostCommonTossDecision")}
                        </strong>
                      </td>
                      <td>{venueInsights.most_common_toss_decision || "—"}</td>
                    </tr>
                  </tbody>
                </Table>
                {venueInsights.toss_distribution && (
                  <div className="small text-muted">
                    {t("pregame.modals.venueToss.tossDistributionLabel")}&nbsp;
                    {Object.entries(venueInsights.toss_distribution)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" • ")}
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </Modal.Body>
        <Modal.Footer style={modalFooterStyle}>
          <Button variant="secondary" onClick={closeVenueModal}>
            {t("common.close")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* KEY OPPOSITION PLAYERS MODAL */}
      <Modal
        show={showKeyOppModal}
        onShow={fetchKeyOppositionPlayers}
        onHide={() => setShowKeyOppModal(false)}
        size="lg"
        centered
        contentClassName={isDarkMode ? "modal-shell-dark" : "modal-shell-light"}
      >
        <Modal.Header closeButton style={modalHeaderStyle}>
          <Modal.Title>
            {t("pregame.modals.keyOpposition.title")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={modalBodyStyle}>
          {keyOppError && (
            <Alert variant="danger" className="mb-2">
              {keyOppError}
            </Alert>
          )}

          {keyOppLoading ? (
            <div className="d-flex justify-content-center">
              <Spinner animation="border" />
            </div>
          ) : (
            <>
              <h6 className="fw-bold mb-2">
                {t("pregame.modals.keyOpposition.topBattersHeading")}
              </h6>
              <Table size="sm" bordered responsive className="mb-4">
                <thead>
                  <tr>
                    <th>{t("common.player")}</th>
                    <th>{t("common.runs")}</th>
                    <th>{t("common.balls")}</th>
                    <th>{t("common.sr")}</th>
                    <th>{t("common.avg")}</th>
                  </tr>
                </thead>
                <tbody>
                  {keyOppData.batters.map((b) => (
                    <tr key={b.player_id}>
                      <td>{b.player_name}</td>
                      <td>{b.runs}</td>
                      <td>{b.balls_faced}</td>
                      <td>{b.strike_rate ?? "—"}</td>
                      <td>{b.average ?? "—"}</td>
                    </tr>
                  ))}
                  {keyOppData.batters.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-muted text-center">
                        {t("pregame.modals.keyOpposition.noQualifiedBatters")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>

              <h6 className="fw-bold mb-2">
                {t("pregame.modals.keyOpposition.topBowlersHeading")}
              </h6>
              <Table size="sm" bordered responsive>
                <thead>
                  <tr>
                    <th>{t("common.player")}</th>
                    <th>{t("common.overs")}</th>
                    <th>{t("common.runs")}</th>
                    <th>{t("common.wicketsShort")}</th>
                    <th>{t("common.econ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {keyOppData.bowlers.map((bw) => (
                    <tr key={bw.player_id}>
                      <td>{bw.player_name}</td>
                      <td>{bw.overs}</td>
                      <td>{bw.runs_conceded}</td>
                      <td>{bw.wickets}</td>
                      <td>{bw.economy ?? "—"}</td>
                    </tr>
                  ))}
                  {keyOppData.bowlers.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-muted text-center">
                        {t("pregame.modals.keyOpposition.noQualifiedBowlers")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={modalFooterStyle}>
          <Button
            variant="secondary"
            onClick={() => setShowKeyOppModal(false)}
          >
            {t("common.close")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* OPPOSITION STRENGTHS / WEAKNESSES MODAL */}
      <Modal
        show={showOppSW}
        onShow={loadOppSW}
        onHide={() => setShowOppSW(false)}
        size="lg"
        centered
        contentClassName={isDarkMode ? "modal-shell-dark" : "modal-shell-light"}
      >
        <Modal.Header closeButton style={modalHeaderStyle}>
          <Modal.Title>
            {t("pregame.modals.strengthsWeaknesses.title")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={modalBodyStyle}>
          {swErr && <Alert variant="danger">{swErr}</Alert>}
          {swLoading || !swData ? (
            <div className="text-center">
              <Spinner animation="border" />
            </div>
          ) : (
            <>
              <h6 className="fw-bold">
                {t("pregame.modals.strengthsWeaknesses.battingStrengths")}
              </h6>
              <ul>
                {swData.batting.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>

              <h6 className="fw-bold mt-3">
                {t("pregame.modals.strengthsWeaknesses.battingWeaknesses")}
              </h6>
              <ul>
                {swData.batting.weaknesses.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>

              <h6 className="fw-bold mt-4">
                {t("pregame.modals.strengthsWeaknesses.bowlingStrengths")}
              </h6>
              <ul>
                {swData.bowling.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>

              <h6 className="fw-bold mt-3">
                {t("pregame.modals.strengthsWeaknesses.bowlingWeaknesses")}
              </h6>
              <ul>
                {swData.bowling.weaknesses.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>

              <hr className="my-3" />

              <h6 className="fw-bold">
                {t("pregame.modals.strengthsWeaknesses.detailBattingByStyle")}
              </h6>
              <Table size="sm" bordered responsive>
                <thead>
                  <tr>
                    <th>{t("pregame.modals.common.type")}</th>
                    <th>{t("pregame.modals.common.balls")}</th>
                    <th>{t("common.sr")}</th>
                    <th>{t("pregame.modals.common.dotPct")}</th>
                    <th>{t("pregame.modals.common.boundaryPct")}</th>
                    <th>{t("pregame.modals.common.outsPerBall")}</th>
                  </tr>
                </thead>
                <tbody>
                  {swData.batting.by_style.map((r) => (
                    <tr key={r.style_norm}>
                      <td>{r.style_norm}</td>
                      <td>{r.balls}</td>
                      <td>{r.strike_rate}</td>
                      <td>{r.dot_pct}</td>
                      <td>{r.boundary_pct}</td>
                      <td>{r.outs_perc_ball}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <h6 className="fw-bold mt-3">
                {t("pregame.modals.strengthsWeaknesses.detailBattingByPhase")}
              </h6>
              <Table size="sm" bordered responsive>
                <thead>
                  <tr>
                    <th>{t("pregame.modals.common.phase")}</th>
                    <th>{t("pregame.modals.common.balls")}</th>
                    <th>{t("common.sr")}</th>
                    <th>{t("pregame.modals.common.dotPct")}</th>
                    <th>{t("pregame.modals.common.boundaryPct")}</th>
                  </tr>
                </thead>
                <tbody>
                  {swData.batting.by_phase.map((r) => (
                    <tr key={r.phase}>
                      <td>{r.phase}</td>
                      <td>{r.balls}</td>
                      <td>{r.strike_rate}</td>
                      <td>{r.dot_pct}</td>
                      <td>{r.boundary_pct}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <h6 className="fw-bold mt-3">
                {t("pregame.modals.strengthsWeaknesses.detailBowlingByPhase")}
              </h6>
              <Table size="sm" bordered responsive>
                <thead>
                  <tr>
                    <th>{t("pregame.modals.common.phase")}</th>
                    <th>{t("pregame.modals.common.overs")}</th>
                    <th>{t("common.econ")}</th>
                    <th>{t("pregame.modals.common.dotPct")}</th>
                    <th>{t("pregame.modals.common.wicketsPerBall")}</th>
                    <th>{t("pregame.modals.common.boundaryPct")}</th>
                  </tr>
                </thead>
                <tbody>
                  {swData.bowling.by_phase.map((r) => (
                    <tr key={r.phase}>
                      <td>{r.phase}</td>
                      <td>{r.overs}</td>
                      <td>{r.economy ?? "—"}</td>
                      <td>{r.dot_pct}</td>
                      <td>{r.wickets_perc_ball}</td>
                      <td>{r.boundary_pct}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <h6 className="fw-bold mt-3">
                {t("pregame.modals.strengthsWeaknesses.detailBowlingByType")}
              </h6>
              <Table size="sm" bordered responsive>
                <thead>
                  <tr>
                    <th>{t("pregame.modals.common.type")}</th>
                    <th>{t("pregame.modals.common.overs")}</th>
                    <th>{t("common.econ")}</th>
                    <th>{t("pregame.modals.common.dotPct")}</th>
                    <th>{t("pregame.modals.common.wicketsPerBall")}</th>
                    <th>{t("pregame.modals.common.boundaryPct")}</th>
                  </tr>
                </thead>
                <tbody>
                  {swData.bowling.by_style.map((r) => (
                    <tr key={r.style_norm}>
                      <td>{r.style_norm}</td>
                      <td>{r.overs}</td>
                      <td>{r.economy ?? "—"}</td>
                      <td>{r.dot_pct}</td>
                      <td>{r.wickets_perc_ball}</td>
                      <td>{r.boundary_pct}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={modalFooterStyle}>
          <Button variant="secondary" onClick={() => setShowOppSW(false)}>
            {t("common.close")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* BATTING TARGETS MODAL */}
      <Modal
        show={showTargetsModal}
        onHide={closeTargetsModal}
        centered
        contentClassName={isDarkMode ? "modal-shell-dark" : "modal-shell-light"}
      >
        <Modal.Header closeButton style={modalHeaderStyle}>
          <Modal.Title>
            {t("pregame.modals.battingTargets.title")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={modalBodyStyle}>
          {targetsError && (
            <Alert variant="danger" className="mb-2">
              {targetsError}
            </Alert>
          )}

          {/* Venue pickers */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">
              {t("pregame.modals.battingTargets.groundLabel")}
            </Form.Label>
            {targetsVenueLoading ? (
              <div>
                <Spinner animation="border" size="sm" />
              </div>
            ) : (
              <Form.Select
                value={targetsGround}
                onChange={(e) => setTargetsGround(e.target.value)}
              >
                {targetsVenueOptions.grounds.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Form.Select>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">
              {t("pregame.modals.battingTargets.timeOfDayLabel")}
            </Form.Label>
            <Form.Select
              value={targetsTime}
              onChange={(e) => setTargetsTime(e.target.value)}
            >
              <option value="">
                {t("pregame.modals.battingTargets.timeOfDayAny")}
              </option>
              {targetsVenueOptions.times.map((tOpt) => (
                <option key={tOpt} value={tOpt}>
                  {tOpt}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* Optional knobs */}
          <Row className="g-2">
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">
                  {t("pregame.modals.battingTargets.recencyWindowLabel")}
                </Form.Label>
                <Form.Control
                  type="number"
                  min={90}
                  step={30}
                  value={recencyDays}
                  onChange={(e) =>
                    setRecencyDays(Number(e.target.value) || 90)
                  }
                />
              </Form.Group>
            </Col>
            <Col md={6} className="d-flex align-items-end">
              <Form.Check
                type="switch"
                id="include-rain"
                label={t("pregame.modals.battingTargets.includeRainLabel")}
                checked={includeRain}
                onChange={(e) => setIncludeRain(e.target.checked)}
              />
            </Col>
          </Row>

          <div className="d-flex justify-content-end">
            <Button
              onClick={fetchBattingTargets}
              disabled={
                targetsVenueLoading || targetsLoading || !targetsGround
              }
            >
              {targetsLoading ? (
                <Spinner size="sm" animation="border" />
              ) : (
                t("pregame.modals.battingTargets.computeButton")
              )}
            </Button>
          </div>

          {/* Results */}
          {targetsData && (
            <Card
              className="mt-3"
              style={{
                backgroundColor: isDarkMode ? "#020617" : "#ffffff",
                borderColor: cardBorder,
              }}
            >
              <Card.Body>
                <h6 className="fw-bold mb-2">
                  {targetsData.venue.ground}
                  {targetsData.venue.time_of_day
                    ? `, ${targetsData.venue.time_of_day}`
                    : ""}
                </h6>

                <Table size="sm" bordered responsive className="mb-3">
                  <tbody>
                    <tr>
                      <td>
                        <strong>
                          {t("pregame.modals.battingTargets.venuePar")}
                        </strong>
                      </td>
                      <td>{targetsData.par.venue_par ?? "—"}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>
                          {t("pregame.modals.battingTargets.adjustedPar")}
                        </strong>
                      </td>
                      <td>{targetsData.par.adjusted_par}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>
                          {t("pregame.modals.battingTargets.targetTotal")}
                        </strong>
                      </td>
                      <td className="fw-bold">
                        {targetsData.par.target_total}
                      </td>
                    </tr>
                  </tbody>
                </Table>

                <h6 className="fw-bold">
                  {t("pregame.modals.battingTargets.phaseTargetsHeading")}
                </h6>
                <Table size="sm" bordered responsive>
                  <thead>
                    <tr>
                      <th>{t("pregame.modals.common.phase")}</th>
                      <th>{t("pregame.modals.common.overs")}</th>
                      <th>{t("pregame.modals.common.runs")}</th>
                      <th>{t("pregame.modals.battingTargets.rpo")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targetsData.phases.map((p) => (
                      <tr key={p.phase}>
                        <td>{p.phase}</td>
                        <td>{p.overs}</td>
                        <td>{p.runs}</td>
                        <td>{p.rpo}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                {!!(targetsData.notes && targetsData.notes.length) && (
                  <div className="small text-muted mt-2">
                    {targetsData.notes.map((n, i) => (
                      <div key={i}>• {n}</div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </Modal.Body>
        <Modal.Footer style={modalFooterStyle}>
          <Button variant="secondary" onClick={closeTargetsModal}>
            {t("common.close")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
