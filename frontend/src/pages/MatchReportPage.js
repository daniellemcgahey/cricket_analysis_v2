/**
 * Match Report Page
 *
 * This component renders the match report generation UI. It uses the selected
 * match (passed as a prop) to determine which teams and players are available
 * for generating reports. Coaches can generate a PDF report for a single
 * player or for an entire team. The underlying API endpoints are called to
 * upload the current chart images before opening the generated report in a
 * new tab.
 */
import React, { useEffect, useState, useRef } from "react";
import { Row, Col, Card, Form, Button, Spinner, Alert } from "react-bootstrap";
import { useLanguage } from "../language/LanguageContext";
import { useTheme } from "../theme/ThemeContext";
import api from "../api";
import WagonWheelChart from "./WagonWheelChart";
import PitchMapChart from "./PitchMapChart";

const MatchReportPage = ({ selectedMatch, teamCategory }) => {
  const { t } = useLanguage();
  const theme = useTheme();

  // Selected team and player
  const [teamOptions, setTeamOptions] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);

  // Chart data
  const [wagonWheelData, setWagonWheelData] = useState([]);
  const [pitchMapData, setPitchMapData] = useState([]);

  // Loading states
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [error, setError] = useState("");

  // Canvas refs for uploading images
  const wagonWheelRef = useRef(null);
  const pitchMapRef = useRef(null);

  /**
   * When the selected match changes, reset all state and derive the two teams.
   * We use the team names/id from the match metadata to build team options.
   */
  useEffect(() => {
    setTeamOptions([]);
    setSelectedTeam(null);
    setPlayers([]);
    setSelectedPlayerId(null);
    setWagonWheelData([]);
    setPitchMapData([]);
    setError("");

    if (!selectedMatch) return;

    // Build team options from match metadata
    const options = [];
    if (selectedMatch.team_a && selectedMatch.team_a_id) {
      options.push({ id: selectedMatch.team_a_id, name: selectedMatch.team_a });
    }
    if (selectedMatch.team_b && selectedMatch.team_b_id) {
      options.push({ id: selectedMatch.team_b_id, name: selectedMatch.team_b });
    }
    setTeamOptions(options);
  }, [selectedMatch]);

  /**
   * When the selected team changes, fetch the list of players for that country.
   */
  useEffect(() => {
    if (!selectedTeam || !selectedTeam.name) {
      setPlayers([]);
      setSelectedPlayerId(null);
      return;
    }
    setLoadingPlayers(true);
    setError("");
    api
      .get("/team-players", { params: { country_name: selectedTeam.name } })
      .then((res) => {
        setPlayers(res.data || []);
        setSelectedPlayerId(null);
      })
      .catch((err) => {
        console.error("Error loading players", err);
        setError(
          err?.response?.data?.detail || err.message || "Error loading players"
        );
        setPlayers([]);
      })
      .finally(() => setLoadingPlayers(false));
  }, [selectedTeam]);

  /**
   * When both a match and player are selected, fetch wagon wheel and pitch map
   * data for that player. We transform the coordinates into the format
   * expected by WagonWheelChart and PitchMapChart components.
   */
  useEffect(() => {
    if (!selectedMatch || !selectedPlayerId) {
      setWagonWheelData([]);
      setPitchMapData([]);
      return;
    }

    // Fetch wagon wheel data
    api
      .get("/player-wagon-wheel-data", {
        params: { matchId: selectedMatch.match_id, playerId: selectedPlayerId },
      })
      .then((res) => {
        const remapped = (res.data || []).map((shot) => ({
          x: shot.shot_x,
          y: shot.shot_y,
          runs: shot.runs,
        }));
        setWagonWheelData(remapped);
      })
      .catch((err) => {
        console.error("Error fetching wagon wheel data", err);
        setWagonWheelData([]);
      });

    // Fetch pitch map data
    api
      .get("/player-pitch-map-data", {
        params: { matchId: selectedMatch.match_id, playerId: selectedPlayerId },
      })
      .then((res) => {
        const remapped = (res.data || []).map((ball) => ({
          pitch_x: ball.pitch_x,
          pitch_y: ball.pitch_y,
          runs: ball.runs || 0,
          wides: ball.wides || 0,
          no_balls: ball.no_balls || 0,
          dismissal_type: ball.dismissal_type || null,
        }));
        setPitchMapData(remapped);
      })
      .catch((err) => {
        console.error("Error fetching pitch map data", err);
        setPitchMapData([]);
      });
  }, [selectedMatch, selectedPlayerId]);

  /**
   * Uploads a base64 encoded image to the backend for inclusion in the report.
   */
  const uploadImage = async (endpoint, base64Image) => {
    try {
      await api.post(endpoint, { image: base64Image });
    } catch (error) {
      console.error(`Failed to upload image to ${endpoint}`, error);
    }
  };

  /**
   * Generate a PDF match report for the selected player. We first capture the
   * current wagon wheel and pitch map canvases (if present), upload them to
   * the server via the appropriate endpoints, wait briefly to allow the
   * server to persist them, and finally open the generated report in a new
   * tab. If no player or match is selected, nothing happens.
   */
  const generatePlayerReport = async () => {
    if (!selectedMatch || !selectedPlayerId) return;
    try {
      // Capture and upload wagon wheel
      if (wagonWheelRef.current) {
        const base64Wagon = wagonWheelRef.current.toDataURL("image/png");
        await uploadImage("/api/upload-wagon-wheel", base64Wagon);
      }

      // Capture and upload pitch map
      if (pitchMapRef.current) {
        const base64Pitch = pitchMapRef.current.toDataURL("image/png");
        await uploadImage("/api/upload-pitch-map", base64Pitch);
      }

      // Give the backend a moment to save the images (especially on slow networks)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Open the generated player report
      window.open(
        `${api.defaults.baseURL}/match-report/${selectedMatch.match_id}/player/${selectedPlayerId}`,
        "_blank"
      );
    } catch (error) {
      console.error("Error generating player report", error);
    }
  };

  /**
   * Generate a PDF match report for the selected team. This directly opens
   * the generated report in a new tab. Only works if a team and match are
   * selected.
   */
  const generateTeamReport = () => {
    if (!selectedMatch || !selectedTeam) return;
    const { match_id } = selectedMatch;
    const teamId = selectedTeam.id;
    window.open(
      `${api.defaults.baseURL}/team-match-report/${match_id}/${teamId}/pdf`,
      "_blank"
    );
  };

  // Styles for the container card
  const cardStyle = {
    backgroundColor: theme?.surfaceElevated || "var(--color-surface-elevated)",
    border: `1px solid rgba(255,255,255,0.08)`,
    boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
    color: "var(--color-text-primary)",
    borderRadius: 12,
  };

  // If no match is selected, show a hint instead of the UI
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
        <Row className="mb-3">
          <Col>
            <Card.Title style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {t("matchAnalysis.tabs.report") || "Match report"}
            </Card.Title>
            <small style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
              {t("matchReport.description") ||
                "Generate detailed PDF reports for players or entire teams using real match data."}
            </small>
          </Col>
        </Row>

        {error && (
          <Alert variant="danger" style={{ fontSize: "0.85rem" }}>
            {error}
          </Alert>
        )}

        {/* Team and player selectors */}
        <Row className="g-3 align-items-end mb-3">
          <Col md={4} sm={6} xs={12}>
            <Form.Group controlId="reportTeamSelect">
              <Form.Label style={{ fontSize: "0.85rem" }}>
                {t("matchReport.teamLabel") || "Team"}
              </Form.Label>
              <Form.Select
                size="sm"
                value={selectedTeam?.id || ""}
                onChange={(e) => {
                  const teamId = Number(e.target.value);
                  const team = teamOptions.find((t) => t.id === teamId) || null;
                  setSelectedTeam(team);
                }}
              >
                <option value="">
                  {t("matchReport.teamPlaceholder") || "Select a team"}
                </option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={4} sm={6} xs={12}>
            <Form.Group controlId="reportPlayerSelect">
              <Form.Label style={{ fontSize: "0.85rem" }}>
                {t("matchReport.playerLabel") || "Player"}
              </Form.Label>
              <Form.Select
                size="sm"
                value={selectedPlayerId || ""}
                onChange={(e) => setSelectedPlayerId(Number(e.target.value))}
                disabled={!selectedTeam || players.length === 0}
              >
                <option value="">
                  {loadingPlayers
                    ? t("matchReport.loadingPlayers") || "Loading players…"
                    : t("matchReport.playerPlaceholder") || "Select a player"}
                </option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={4} sm={12} xs={12} className="d-flex gap-2">
            <Button
              variant="primary"
              size="sm"
              className="flex-grow-1"
              onClick={generatePlayerReport}
              disabled={!selectedPlayerId}
            >
              {t("matchReport.playerReportButton") || "Player report"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-grow-1"
              onClick={generateTeamReport}
              disabled={!selectedTeam}
            >
              {t("matchReport.teamReportButton") || "Team report"}
            </Button>
          </Col>
        </Row>

        {/* Hidden charts for capturing images to upload */}
        {/* We render these with position off-screen so they don't clutter the UI but still generate canvases */}
        <div style={{ position: "absolute", left: -9999, top: -9999 }}>
          <div style={{ width: 400, height: 400 }}>
            <WagonWheelChart
              data={wagonWheelData}
              perspective="Lines"
              canvasRef={wagonWheelRef}
            />
          </div>
          <div style={{ width: 400, height: 400, marginTop: 16 }}>
            <PitchMapChart data={pitchMapData} canvasRef={pitchMapRef} />
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default MatchReportPage;