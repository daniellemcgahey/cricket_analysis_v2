// src/pages/TournamentAnalysisPage.jsx
import React, { useEffect, useState } from "react";
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  Table,
  Accordion,
  Collapse,
} from "react-bootstrap";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import useUITheme from "../theme/useUITheme";
import { useLanguage } from "../language/LanguageContext";
import api from "../api";

/**
 * TournamentAnalysisPage
 *
 * This page allows coaches to select a tournament and explore high‑level stats
 * and leaderboards for that competition. It follows the same design language
 * as the Match Analysis page: a hero card with selectors at the top, an
 * overview section with match results and points table, and expandable
 * sections for batting, bowling, fielding and MVP leaderboards. A toggle
 * lets you switch between statistics for just your team or for the entire
 * tournament.
 */
const TournamentAnalysisPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const theme = useTheme();
  const ui = useUITheme();

  // Team information from logged in user and theme
  const teamCategory = user?.teamCategory || "Women";
  const teamName = theme.teamName; // e.g. "Brasil Women"

  // List of tournaments for this team category
  const [tournaments, setTournaments] = useState([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);

  // Selected tournament
  const [selectedTournament, setSelectedTournament] = useState("");

  // Overview data (match results + standings)
  const [matchesData, setMatchesData] = useState([]);
  const [standingsData, setStandingsData] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [errorOverview, setErrorOverview] = useState("");

  // Leaderboards state
  const categories = ["batting", "bowling", "fielding", "mvp"];
  const [showLeaderboard, setShowLeaderboard] = useState({
    batting: false,
    bowling: false,
    fielding: false,
    mvp: false,
  });
  const [leaderboards, setLeaderboards] = useState({
    batting: null,
    bowling: null,
    fielding: null,
    mvp: null,
  });
  const [loadingLeaderboards, setLoadingLeaderboards] = useState({
    batting: false,
    bowling: false,
    fielding: false,
    mvp: false,
  });
  const [errorLeaderboards, setErrorLeaderboards] = useState({
    batting: "",
    bowling: "",
    fielding: "",
    mvp: "",
  });

  // Whether to restrict leaderboards to only our team or entire tournament
  const [ourOnly, setOurOnly] = useState(false);

  /** Fetch list of tournaments for the given team category. */
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        setLoadingTournaments(true);
        const res = await api.get("/tournaments", {
          params: { team_category: teamCategory },
        });
        const list = res.data || [];
        setTournaments(list);
        // If there is only one tournament, preselect it
        if (list.length === 1) {
          setSelectedTournament(list[0]);
        }
      } catch (err) {
        console.error("Error loading tournaments", err);
        setTournaments([]);
      } finally {
        setLoadingTournaments(false);
      }
    };
    fetchTournaments();
  }, [teamCategory]);

  /** Fetch match results and standings when the selected tournament changes. */
  useEffect(() => {
    const fetchOverview = async () => {
      setMatchesData([]);
      setStandingsData([]);
      setErrorOverview("");
      if (!selectedTournament) return;

      try {
        setLoadingOverview(true);
        // Fetch all matches for this team category
        const matchesRes = await api.get("/matches", {
          params: { teamCategory },
        });
        const allMatches = matchesRes.data || [];
        // Filter to matches belonging to this tournament
        const matches = allMatches.filter(
          (m) => m.tournament === selectedTournament
        );
        setMatchesData(matches);
        // Fetch standings / points table
        const standingsRes = await api.post("/tournament-standings", {
          team_category: teamCategory,
          tournament: selectedTournament,
        });
        const standings = standingsRes.data || [];
        setStandingsData(standings);
      } catch (err) {
        console.error("Error loading tournament overview", err);
        setErrorOverview(
          err?.response?.data?.detail ||
            err.message ||
            "Error loading tournament data"
        );
      } finally {
        setLoadingOverview(false);
      }
    };
    fetchOverview();
  }, [selectedTournament, teamCategory]);

  /** Toggles the display of a leaderboard and fetches it if not loaded yet. */
  const handleToggleLeaderboard = async (cat) => {
    // If category is not part of our list, ignore
    if (!categories.includes(cat)) return;
    const currentlyShown = showLeaderboard[cat];
    // If toggling on and we don't have data, fetch it
    if (!currentlyShown && !leaderboards[cat]) {
      try {
        setLoadingLeaderboards((prev) => ({ ...prev, [cat]: true }));
        setErrorLeaderboards((prev) => ({ ...prev, [cat]: "" }));
        // Prepare payload: limit to our team if ourOnly is true
        const payload = {
          team_category: teamCategory,
          tournament: selectedTournament,
        };
        if (ourOnly && teamName) {
          payload.countries = [teamName];
        }
        const res = await api.post(`/tournament-leaders/${cat}`, payload);
        setLeaderboards((prev) => ({ ...prev, [cat]: res.data || {} }));
      } catch (err) {
        console.error(`Error loading ${cat} leaderboards`, err);
        setErrorLeaderboards((prev) => ({
          ...prev,
          [cat]:
            err?.response?.data?.detail ||
            err.message ||
            `Error loading ${cat} leaderboards`,
        }));
      } finally {
        setLoadingLeaderboards((prev) => ({ ...prev, [cat]: false }));
      }
    }
    // Toggle display state
    setShowLeaderboard((prev) => ({ ...prev, [cat]: !currentlyShown }));
  };

  /** Render a generic leaderboard accordion given the data object. */
  const renderLeaderboards = (data, catKey) => {
    if (!data) return null;
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return (
        <Alert
          variant="info"
          style={{ fontSize: "0.85rem" }}
        >
          {t("tournament.noLeaderboardData") || "No leaderboard data available."}
        </Alert>
      );
    }
    return (
      <Accordion defaultActiveKey="0" alwaysOpen>
        {keys.map((categoryTitle, idx) => {
          const list = data[categoryTitle] || [];
          return (
            <Accordion.Item eventKey={String(idx)} key={`${catKey}-${categoryTitle}`}>
              <Accordion.Header>
                <strong>{t(`tournament.leaderboards.${catKey}.${categoryTitle}`) || categoryTitle}</strong>
              </Accordion.Header>
              <Accordion.Body
                style={{
                  backgroundColor:
                    theme?.surface ||
                    "var(--color-surface)",
                }}
              >
                {list && list.length > 0 ? (
                  <Table
                    striped
                    bordered
                    hover
                    size="sm"
                    style={{
                      fontSize: "0.85rem",
                    }}
                  >
                    <thead>
                      <tr>
                        <th>#</th>
                        {/* Determine columns from first object */}
                        {Object.keys(list[0]).map((field) => (
                          <th key={field} className="text-capitalize">
                            {field.replace(/_/g, " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((entry, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          {Object.keys(list[0]).map((field) => (
                            <td key={field}>{entry[field]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <Alert
                    variant="secondary"
                    style={{ fontSize: "0.85rem" }}
                  >
                    {t("tournament.noDataForCategory") ||
                      "No data available for this category."}
                  </Alert>
                )}
              </Accordion.Body>
            </Accordion.Item>
          );
        })}
      </Accordion>
    );
  };

  /** Render the overview section: match results, points table and qualifiers. */
  const renderOverview = () => {
    if (!selectedTournament) {
      return (
        <Alert
          variant="secondary"
          className="my-3"
          style={{ fontSize: "0.85rem" }}
        >
          {t("tournament.selectTournamentHint") ||
            "Select a tournament above to see results, standings and leaderboards."}
        </Alert>
      );
    }
    if (loadingOverview) {
      return (
        <div className="d-flex justify-content-center align-items-center my-3">
          <Spinner animation="border" />
        </div>
      );
    }
    if (errorOverview) {
      return (
        <Alert
          variant="danger"
          className="my-3"
          style={{ fontSize: "0.85rem" }}
        >
          {errorOverview}
        </Alert>
      );
    }
    return (
      <Row className="g-3 mt-2">
        {/* Match results */}
        <Col md={4}>
          <Card
            style={{
              backgroundColor:
                theme?.surfaceElevated ||
                "var(--color-surface-elevated)",
              border: `1px solid rgba(255,255,255,0.08)`,
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              color: theme?.textPrimary || "var(--color-text-primary)",
              borderRadius: 12,
              minHeight: "200px",
            }}
          >
            <Card.Body>
              <Card.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
                {t("tournament.matchResultsTitle") || "Match results"}
              </Card.Title>
              <div style={{ fontSize: "0.85rem", maxHeight: "220px", overflowY: "auto" }}>
                {matchesData && matchesData.length > 0 ? (
                  matchesData.map((m, idx) => (
                    <div key={idx} className="mb-2">
                      <strong>
                        {m.team_a} {t("tournament.vs") || "vs"} {m.team_b}
                      </strong>
                      <br />
                      {m.result
                        ? m.result
                        : // Fallback if no result; show date or match id
                          m.date
                        ? new Date(m.date).toLocaleDateString()
                        : `${t("tournament.matchId") || "Match"} #${m.match_id}`}
                    </div>
                  ))
                ) : (
                  <span>
                    {t("tournament.noMatches") ||
                      "No matches found for this tournament."}
                  </span>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
        {/* Points table */}
        <Col md={4}>
          <Card
            style={{
              backgroundColor:
                theme?.surfaceElevated ||
                "var(--color-surface-elevated)",
              border: `1px solid rgba(255,255,255,0.08)`,
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              color: theme?.textPrimary || "var(--color-text-primary)",
              borderRadius: 12,
              minHeight: "200px",
            }}
          >
            <Card.Body>
              <Card.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
                {t("tournament.pointsTableTitle") || "Points table"}
              </Card.Title>
              <div style={{ fontSize: "0.8rem", maxHeight: "220px", overflowX: "auto" }}>
                {standingsData && standingsData.length > 0 ? (
                  <Table
                    size="sm"
                    striped
                    bordered
                    hover
                    style={{ fontSize: "0.75rem" }}
                  >
                    <thead>
                      <tr>
                        <th>{t("tournament.pointsTable.team") || "Team"}</th>
                        <th>{t("tournament.pointsTable.played") || "P"}</th>
                        <th>{t("tournament.pointsTable.wins") || "W"}</th>
                        <th>{t("tournament.pointsTable.losses") || "L"}</th>
                        <th>{t("tournament.pointsTable.noResults") || "NR"}</th>
                        <th>{t("tournament.pointsTable.points") || "Pts"}</th>
                        <th>{t("tournament.pointsTable.nrr") || "NRR"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standingsData.map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.team}</td>
                          <td>{row.played}</td>
                          <td>{row.wins}</td>
                          <td>{row.losses}</td>
                          <td>{row.no_results}</td>
                          <td>{row.points}</td>
                          <td>{row.nrr?.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <span>
                    {t("tournament.noStandings") ||
                      "No standings available for this tournament."}
                  </span>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
        {/* Qualifiers */}
        <Col md={4}>
          <Card
            style={{
              backgroundColor:
                theme?.surfaceElevated ||
                "var(--color-surface-elevated)",
              border: `1px solid rgba(255,255,255,0.08)`,
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              color: theme?.textPrimary || "var(--color-text-primary)",
              borderRadius: 12,
              minHeight: "200px",
            }}
          >
            <Card.Body>
              <Card.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
                {t("tournament.qualifiersTitle") ||
                  "Qualifiers"}
              </Card.Title>
              <div style={{ fontSize: "0.85rem" }}>
                {standingsData && standingsData.length > 0 ? (
                  <ul className="mb-0 ps-3">
                    {standingsData
                      .slice(0, Math.min(4, standingsData.length))
                      .map((row, idx) => (
                        <li key={idx}>{row.team}</li>
                      ))}
                  </ul>
                ) : (
                  <span>
                    {t("tournament.noQualifiers") ||
                      "No qualifiers information."}
                  </span>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    );
  };

  // Build style for hero selector card
  const selectorCardStyle = {
    background: `linear-gradient(135deg, ${theme.primaryColor}33, ${theme.accentColor}33)`,
    border: `1px solid ${ui.border.subtle}`,
    color: ui.text.primary,
    borderRadius: "1rem",
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div className="container-fluid py-3">
      {/* Hero / Selector Card */}
      <Card className="mb-3" style={selectorCardStyle}>
        {/* Accent stripe on the left */}
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
                {t("tournament.title") || "Tournament analysis"}
              </Card.Title>
              <small style={{ color: ui.text.secondary }}>
                {t("tournament.subtitle") ||
                  "Choose a tournament to view results, standings and leaderboards."}
              </small>
            </div>
            {/* Team flag and name like match analysis */}
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
          {loadingTournaments && (
            <div className="d-flex align-items-center gap-2 mb-2">
              <Spinner size="sm" animation="border" />
              <span style={{ fontSize: "0.85rem" }}>
                {t("tournament.loadingTournaments") || "Loading tournaments…"}
              </span>
            </div>
          )}
          {/* Tournament selector */}
          {tournaments && tournaments.length > 0 ? (
            <Row className="g-3 align-items-end mt-1">
              <Col xs={12} md={6} lg={4}>
                <Form.Group controlId="tournamentSelect">
                  <Form.Label
                    className="mb-1"
                    style={{ fontSize: "0.85rem" }}
                  >
                    {t("tournament.selectLabel") || "Tournament"}
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={selectedTournament}
                    onChange={(e) => setSelectedTournament(e.target.value)}
                  >
                    <option value="">
                      {t("tournament.selectPlaceholder") ||
                        "Select tournament"}
                    </option>
                    {tournaments.map((tournament, idx) => (
                      <option value={tournament} key={idx}>
                        {tournament}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              {/* Switch to show only our players or entire tournament */}
              <Col xs={12} md={6} lg={4}>
                <Form.Group controlId="ourOnlySwitch">
                  <Form.Label
                    className="mb-1"
                    style={{ fontSize: "0.85rem" }}
                  >
                    {t("tournament.ourOnlyLabel") ||
                      "Show only our players"}
                  </Form.Label>
                  <Form.Check
                    type="switch"
                    id="ourOnlySwitchControl"
                    label={
                      ourOnly
                        ? t("tournament.ourOnlyOn") || "Our players"
                        : t("tournament.ourOnlyOff") || "All players"
                    }
                    checked={ourOnly}
                    onChange={() => {
                      setOurOnly(!ourOnly);
                      // Clear loaded leaderboards so they reload with new filter
                      setLeaderboards({
                        batting: null,
                        bowling: null,
                        fielding: null,
                        mvp: null,
                      });
                    }}
                  />
                </Form.Group>
              </Col>
            </Row>
          ) : !loadingTournaments ? (
            <Alert
              variant="info"
              className="py-2 mt-2"
              style={{ fontSize: "0.85rem" }}
            >
              {t("tournament.noTournaments") ||
                "No tournaments available for this team yet."}
            </Alert>
          ) : null}
        </Card.Body>
      </Card>

      {/* Overview Section */}
      {renderOverview()}

      {/* Leaderboards Section */}
      {selectedTournament && (
        <div className="mt-4">
          {/* Batting */}
          <Card
            className="mb-3"
            style={{
              backgroundColor:
                theme?.surfaceElevated ||
                "var(--color-surface-elevated)",
              border: `1px solid rgba(255,255,255,0.08)` ,
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              color: theme?.textPrimary || "var(--color-text-primary)",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            <Card.Header
              onClick={() => handleToggleLeaderboard("batting")}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 600,
              }}
            >
              <span>{t("tournament.leaderboards.battingTitle") || "Batting leaderboards"}</span>
              <span>{showLeaderboard.batting ? "−" : "+"}</span>
            </Card.Header>
            <Collapse in={showLeaderboard.batting}>
              <Card.Body>
                {loadingLeaderboards.batting ? (
                  <div className="text-center py-3">
                    <Spinner animation="border" />
                  </div>
                ) : errorLeaderboards.batting ? (
                  <Alert variant="danger" style={{ fontSize: "0.85rem" }}>
                    {errorLeaderboards.batting}
                  </Alert>
                ) : (
                  renderLeaderboards(leaderboards.batting, "batting")
                )}
              </Card.Body>
            </Collapse>
          </Card>
          {/* Bowling */}
          <Card
            className="mb-3"
            style={{
              backgroundColor:
                theme?.surfaceElevated ||
                "var(--color-surface-elevated)",
              border: `1px solid rgba(255,255,255,0.08)` ,
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              color: theme?.textPrimary || "var(--color-text-primary)",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            <Card.Header
              onClick={() => handleToggleLeaderboard("bowling")}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 600,
              }}
            >
              <span>{t("tournament.leaderboards.bowlingTitle") || "Bowling leaderboards"}</span>
              <span>{showLeaderboard.bowling ? "−" : "+"}</span>
            </Card.Header>
            <Collapse in={showLeaderboard.bowling}>
              <Card.Body>
                {loadingLeaderboards.bowling ? (
                  <div className="text-center py-3">
                    <Spinner animation="border" />
                  </div>
                ) : errorLeaderboards.bowling ? (
                  <Alert variant="danger" style={{ fontSize: "0.85rem" }}>
                    {errorLeaderboards.bowling}
                  </Alert>
                ) : (
                  renderLeaderboards(leaderboards.bowling, "bowling")
                )}
              </Card.Body>
            </Collapse>
          </Card>
          {/* Fielding */}
          <Card
            className="mb-3"
            style={{
              backgroundColor:
                theme?.surfaceElevated ||
                "var(--color-surface-elevated)",
              border: `1px solid rgba(255,255,255,0.08)` ,
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              color: theme?.textPrimary || "var(--color-text-primary)",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            <Card.Header
              onClick={() => handleToggleLeaderboard("fielding")}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 600,
              }}
            >
              <span>{t("tournament.leaderboards.fieldingTitle") || "Fielding leaderboards"}</span>
              <span>{showLeaderboard.fielding ? "−" : "+"}</span>
            </Card.Header>
            <Collapse in={showLeaderboard.fielding}>
              <Card.Body>
                {loadingLeaderboards.fielding ? (
                  <div className="text-center py-3">
                    <Spinner animation="border" />
                  </div>
                ) : errorLeaderboards.fielding ? (
                  <Alert variant="danger" style={{ fontSize: "0.85rem" }}>
                    {errorLeaderboards.fielding}
                  </Alert>
                ) : (
                  renderLeaderboards(leaderboards.fielding, "fielding")
                )}
              </Card.Body>
            </Collapse>
          </Card>
          {/* MVP */}
          <Card
            className="mb-3"
            style={{
              backgroundColor:
                theme?.surfaceElevated ||
                "var(--color-surface-elevated)",
              border: `1px solid rgba(255,255,255,0.08)` ,
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              color: theme?.textPrimary || "var(--color-text-primary)",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            <Card.Header
              onClick={() => handleToggleLeaderboard("mvp")}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 600,
              }}
            >
              <span>{t("tournament.leaderboards.mvpTitle") || "MVP leaderboards"}</span>
              <span>{showLeaderboard.mvp ? "−" : "+"}</span>
            </Card.Header>
            <Collapse in={showLeaderboard.mvp}>
              <Card.Body>
                {loadingLeaderboards.mvp ? (
                  <div className="text-center py-3">
                    <Spinner animation="border" />
                  </div>
                ) : errorLeaderboards.mvp ? (
                  <Alert variant="danger" style={{ fontSize: "0.85rem" }}>
                    {errorLeaderboards.mvp}
                  </Alert>
                ) : (
                  renderLeaderboards(leaderboards.mvp, "mvp")
                )}
              </Card.Body>
            </Collapse>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TournamentAnalysisPage;