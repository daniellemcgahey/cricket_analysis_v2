// src/pages/MatchAnalysisPage.jsx
import React, { useEffect, useState } from "react";
import { Tabs, Tab, Row, Col, Card, Form, Spinner, Alert } from "react-bootstrap";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import useUITheme from "../theme/useUITheme";
import { useLanguage } from "../language/LanguageContext";
import BackButton from "../components/BackButton";
import api from "../api";

import MatchScorecardPage from "./MatchScorecardPage";
import MatchPressurePage from "./MatchPressurePage";
import PartnershipStatsPage from "./PartnershipStatPage";
import MatchReportPage from "./MatchReportPage";
import DetailedMatchTab from "./DetailedMatchTab";

const MatchAnalysisPage = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const ui = useUITheme();
  const { t } = useLanguage();

  const teamCategory = user?.teamCategory || "Women";
  const teamName = theme.teamName; // e.g. "Brasil Men"

  const [allMatches, setAllMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [selectedMatch, setSelectedMatch] = useState(null);

  const [loadingMatches, setLoadingMatches] = useState(false);
  const [error, setError] = useState("");

  // Fetch matches for this teamCategory, then filter to "our" team
  useEffect(() => {
    if (!teamCategory || !teamName) return;

    const fetchMatches = async () => {
      try {
        setLoadingMatches(true);
        setError("");
        setSelectedTournament("");
        setSelectedMatchId("");
        setSelectedMatch(null);

        const res = await api.get("/matches", {
          params: { teamCategory },
        });

        const data = res.data || [];

        // Only keep matches where our team is team_a or team_b
        const teamMatches = data.filter(
          (m) => m.team_a === teamName || m.team_b === teamName
        );

        setAllMatches(teamMatches);

        // Derive tournaments from these matches
        const uniqTournaments = Array.from(
          new Set(teamMatches.map((m) => m.tournament).filter(Boolean))
        ).sort();

        setTournaments(uniqTournaments);

        // If there is only one tournament, pre-select it
        if (uniqTournaments.length === 1) {
          setSelectedTournament(uniqTournaments[0]);
        }
      } catch (err) {
        console.error("Error loading matches for match analysis", err);
        setError(err.message || "Error loading matches");
      } finally {
        setLoadingMatches(false);
      }
    };

    fetchMatches();
  }, [teamCategory, teamName]);

  // Matches filtered by tournament selection
  const filteredMatches = selectedTournament
    ? allMatches.filter((m) => m.tournament === selectedTournament)
    : allMatches;

  // When selectedMatchId changes, update selectedMatch object
  useEffect(() => {
    if (!selectedMatchId) {
      setSelectedMatch(null);
      return;
    }
    const matchObj = allMatches.find(
      (m) => String(m.match_id) === String(selectedMatchId)
    );
    setSelectedMatch(matchObj || null);
  }, [selectedMatchId, allMatches]);

  const renderSelectorCard = () => (
    <Card
      className="mb-3 position-relative"
      style={{
        background: `linear-gradient(135deg, ${theme.primaryColor}33, ${theme.accentColor}33)`,
        border: `1px solid ${ui.border.subtle}`,
        color: ui.text.primary,
        borderRadius: "1rem",
      }}
    >
      {/* Accent stripe on the left, just like Coaches Hub */}
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
              {t("matchAnalysis.title") || "Match analysis"}
            </Card.Title>
            <small style={{ color: ui.text.secondary }}>
              {t("matchAnalysis.subtitle") ||
                "Choose a tournament and match involving your team, then use the tabs below to explore the game."}
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
                {/* Country flag like HomeDashboard */}
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

        {loadingMatches && (
          <div className="d-flex align-items-center gap-2 mb-2">
            <Spinner size="sm" animation="border" />
            <span style={{ fontSize: "0.85rem" }}>
              {t("matchAnalysis.loadingMatches") || "Loading matches…"}
            </span>
          </div>
        )}

        {!loadingMatches && allMatches.length === 0 && !error && (
          <Alert
            variant="info"
            className="py-2 mb-0"
            style={{ fontSize: "0.85rem" }}
          >
            {t("matchAnalysis.noMatches") ||
              "No matches found for this team yet. Once matches are recorded, you’ll be able to analyse them here."}
          </Alert>
        )}

        {allMatches.length > 0 && (
          <Row className="g-3 align-items-end mt-1">
            {/* Tournament select */}
            <Col md={5}>
              <Form.Group controlId="matchAnalysisTournament">
                <Form.Label className="mb-1" style={{ fontSize: "0.85rem" }}>
                  {t("matchAnalysis.tournamentLabel") || "Tournament"}
                </Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedTournament}
                  onChange={(e) => {
                    setSelectedTournament(e.target.value);
                    setSelectedMatchId("");
                  }}
                >
                  <option value="">
                    {t("matchAnalysis.tournamentPlaceholder") ||
                      "All tournaments"}
                  </option>
                  {tournaments.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            {/* Match select */}
            <Col md={7}>
              <Form.Group controlId="matchAnalysisMatch">
                <Form.Label className="mb-1" style={{ fontSize: "0.85rem" }}>
                  {t("matchAnalysis.matchLabel") || "Match"}
                </Form.Label>
                <Form.Select
                  size="sm"
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  disabled={filteredMatches.length === 0}
                >
                  <option value="">
                    {t("matchAnalysis.matchPlaceholder") || "Select a match"}
                  </option>
                  {filteredMatches.map((m) => (
                    <option key={m.match_id} value={m.match_id}>
                      {`${m.match_date} — ${m.team_a} vs ${m.team_b} (${m.tournament})`}
                    </option>
                  ))}
                </Form.Select>
                {filteredMatches.length === 0 && (
                  <small className="text-muted">
                    {t("matchAnalysis.noMatchesForTournament") ||
                      "No matches for this tournament yet."}
                  </small>
                )}
              </Form.Group>
            </Col>
          </Row>
        )}

        {selectedMatch && (
          <div
            className="mt-3 p-2 rounded"
            style={{
              fontSize: "0.8rem",
              backgroundColor: "rgba(15,23,42,0.55)",
              border: "1px solid rgba(148,163,184,0.5)",
            }}
          >
            <strong>
              {t("matchAnalysis.selectedMatchLabel") || "Selected match"}:
            </strong>{" "}
            {selectedMatch.match_date} — {selectedMatch.team_a} vs{" "}
            {selectedMatch.team_b} ({selectedMatch.tournament})
          </div>
        )}
      </Card.Body>
    </Card>
  );

  return (
    <div className="container-fluid py-3">
      <BackButton />

      {renderSelectorCard()}

      <Card>
        <Card.Body>
          {/* Top-level tabs – they all share selectedMatch */}
          <Tabs defaultActiveKey="scorecard" className="mb-0" justify>
            <Tab
              eventKey="scorecard"
              title={t("matchAnalysis.tabs.scorecard") || "Scorecard"}
            >
              <div className="pt-3">
                <MatchScorecardPage
                  selectedMatch={selectedMatch}
                  teamCategory={teamCategory}
                />
              </div>
            </Tab>

            <Tab
              eventKey="report"
              title={t("matchAnalysis.tabs.matchReport") || "Match report"}
            >
              <div className="pt-3">
                <MatchReportPage
                  selectedMatch={selectedMatch}
                  teamCategory={teamCategory}
                />
              </div>
            </Tab>

            <Tab
              eventKey="detailed"
              title={t("matchAnalysis.tabs.detailedMatch") || "Detailed match"}
            >
              <div className="pt-3">
                <DetailedMatchTab
                  selectedMatch={selectedMatch}
                  teamCategory={teamCategory}
                />
              </div>
            </Tab>

            <Tab
              eventKey="partnerships"
              title={t("matchAnalysis.tabs.partnerships") || "Partnerships"}
            >
              <div className="pt-3">
                <PartnershipStatsPage
                  selectedMatch={selectedMatch}
                  teamCategory={teamCategory}
                />
              </div>
            </Tab>

            <Tab
              eventKey="pressure"
              title={t("matchAnalysis.tabs.pressure") || "Pressure analysis"}
            >
              <div className="pt-3">
                <MatchPressurePage
                  selectedMatch={selectedMatch}
                  teamCategory={teamCategory}
                />
              </div>
            </Tab>
          </Tabs>

        </Card.Body>
      </Card>
    </div>
  );
};

export default MatchAnalysisPage;
