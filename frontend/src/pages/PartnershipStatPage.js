/**
 * Partnership Stats Page
 *
 * Displays partnerships for the selected match. Partnerships are grouped by
 * innings and can be expanded to reveal additional summary information and a
 * wagon wheel chart. Data is fetched from the /match-partnerships and
 * /partnership-details endpoints. If no match is selected, a hint is shown.
 */
import React, { useEffect, useState } from "react";
import { Row, Col, Card, ButtonGroup, Button, Spinner, Alert, Table } from "react-bootstrap";
import { useLanguage } from "../language/LanguageContext";
import { useTheme } from "../theme/ThemeContext";
import api from "../api";
import WagonWheelChart from "./WagonWheelChart";

const PartnershipStatsPage = ({ selectedMatch, teamCategory }) => {
  const { t } = useLanguage();
  const theme = useTheme();

  // Partnership data fetched from the backend
  const [partnershipsData, setPartnershipsData] = useState([]);
  // Unique innings order and selected index
  const [inningsOrder, setInningsOrder] = useState([]);
  const [selectedInningsIndex, setSelectedInningsIndex] = useState(0);
  // Loading state
  const [loading, setLoading] = useState(false);
  // Expanded partnership details
  const [expandedPartnershipId, setExpandedPartnershipId] = useState(null);
  const [partnershipDetails, setPartnershipDetails] = useState({});
  const [error, setError] = useState("");

  /**
   * When the selected match changes, fetch the partnership data for that match.
   */
  useEffect(() => {
    setPartnershipsData([]);
    setInningsOrder([]);
    setSelectedInningsIndex(0);
    setExpandedPartnershipId(null);
    setPartnershipDetails({});
    setError("");

    if (!selectedMatch) return;

    const fetchPartnerships = async () => {
      try {
        setLoading(true);
        const res = await api.post("/match-partnerships", {
          team_category: teamCategory,
          tournament: selectedMatch.tournament,
          match_id: selectedMatch.match_id,
        });
        const data = res.data?.partnerships || [];
        setPartnershipsData(data);
        // Determine unique innings ids
        const uniq = [...new Set(data.map((p) => p.innings_id))];
        setInningsOrder(uniq);
        setSelectedInningsIndex(0);
      } catch (err) {
        console.error("Error fetching partnership data", err);
        setError(
          err?.response?.data?.detail || err.message || "Error fetching partnerships"
        );
        setPartnershipsData([]);
        setInningsOrder([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPartnerships();
  }, [selectedMatch, teamCategory]);

  /**
   * Get the batting team name for a given innings id. Used for tab labels.
   */
  const getBattingTeamForInnings = (inningsId) => {
    const first = partnershipsData.find((p) => p.innings_id === inningsId);
    return first ? first.batting_team : `${t("partnerships.inningsLabel") || "Innings"} ${inningsId}`;
  };

  /**
   * Partition partnerships by innings id.
   */
  const partnershipsByInnings = partnershipsData.reduce((acc, p) => {
    if (!acc[p.innings_id]) acc[p.innings_id] = [];
    acc[p.innings_id].push(p);
    return acc;
  }, {});
  const currentInningsId = inningsOrder[selectedInningsIndex];
  const partnershipsForInnings = partnershipsByInnings[currentInningsId] || [];

  /**
   * Toggle partnership expansion. When expanding, fetch details if not already loaded.
   */
  const handlePartnershipClick = (p) => {
    const id = p.partnership_id;
    if (expandedPartnershipId === id) {
      setExpandedPartnershipId(null);
      return;
    }
    setExpandedPartnershipId(id);
    if (!partnershipDetails[id]) {
      api
        .get(`/partnership-details/${id}`)
        .then((res) => {
          setPartnershipDetails((prev) => ({ ...prev, [id]: res.data || {} }));
        })
        .catch((err) => {
          console.error("Error fetching partnership details", err);
        });
    }
  };

  // Style for the card container
  const cardStyle = {
    backgroundColor: theme?.surfaceElevated || "var(--color-surface-elevated)",
    border: `1px solid rgba(255,255,255,0.08)`,
    boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
    color: "var(--color-text-primary)",
    borderRadius: 12,
  };

  // If no match is selected, show hint
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
          {t("matchAnalysis.tabs.partnerships") || "Partnerships"}
        </Card.Title>
        <small style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
          {t("partnerships.description") ||
            "Analyse batting partnerships by wicket, runs and balls. Click a partnership to see a wagon wheel and summary."}
        </small>

        {error && (
          <Alert variant="danger" style={{ fontSize: "0.85rem" }} className="mt-3">
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="d-flex justify-content-center align-items-center" style={{ height: "200px" }}>
            <Spinner animation="border" />
          </div>
        ) : (
          <div className="mt-3">
            {/* Innings tabs */}
            {inningsOrder.length > 0 && (
              <div className="text-center mb-3">
                <ButtonGroup>
                  {inningsOrder.map((id, idx) => (
                    <Button
                      key={id}
                      variant={selectedInningsIndex === idx ? "success" : "outline-secondary"}
                      size="sm"
                      onClick={() => setSelectedInningsIndex(idx)}
                    >
                      {`${t("partnerships.inningsShort") || "Inns"} ${idx + 1} — ${getBattingTeamForInnings(id)}`}
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
            )}

            {/* Partnerships list */}
            {partnershipsForInnings.length > 0 ? (
              partnershipsForInnings.map((p) => {
                const isExpanded = expandedPartnershipId === p.partnership_id;
                const details = partnershipDetails[p.partnership_id];
                // Calculate bar widths (relative scale up to 100%)
                const total = p.partnership_runs || 1;
                const b1Width = (p.batter1_runs / total) * 100;
                const b2Width = (p.batter2_runs / total) * 100;
                const extras = total - (p.batter1_runs + p.batter2_runs);
                const extrasWidth = (extras / total) * 100;
                return (
                  <Card
                    key={p.partnership_id}
                    className="mb-2"
                    style={{
                      backgroundColor: theme?.surface || "rgba(0,0,0,0.15)",
                      border: `1px solid rgba(255,255,255,0.08)`,
                      cursor: "pointer",
                    }}
                    onClick={() => handlePartnershipClick(p)}
                  >
                    <Card.Body className="py-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{t("partnerships.wicketLabel") || "Wicket"} {p.start_wicket}</strong>
                        </div>
                        <div className="text-end">
                          <strong>{t("partnerships.partnershipLabel") || "Partnership:"}</strong> {p.partnership_runs} {t("partnerships.runs") || "runs"}, {p.partnership_legal_balls} {t("partnerships.balls") || "balls"}
                        </div>
                      </div>
                      <div className="d-flex justify-content-between">
                        <div>
                          <strong>{p.batter1_name}</strong>: {p.batter1_runs} ({p.batter1_legal_balls})
                        </div>
                        <div>
                          <strong>{p.batter2_name}</strong>: {p.batter2_runs} ({p.batter2_legal_balls})
                        </div>
                      </div>
                      {/* Contribution bar */}
                      <div className="my-2" style={{ height: "10px", width: "100%", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ display: "flex", height: "100%" }}>
                          {b1Width > 0 && <div style={{ width: `${b1Width}%`, backgroundColor: theme?.accentColor || "orange" }} />}
                          {b2Width > 0 && <div style={{ width: `${b2Width}%`, backgroundColor: theme?.primaryColor || "blue" }} />}
                          {extrasWidth > 0 && <div style={{ width: `${extrasWidth}%`, backgroundColor: "grey" }} />}
                        </div>
                      </div>
                      {/* Expanded details */}
                      {isExpanded && details && (
                        <Row className="mt-3">
                          <Col md={5} sm={12} className="mb-2">
                            <Table bordered size="sm" responsive>
                              <tbody>
                                {details.summary &&
                                  Object.entries(details.summary).map(([key, val]) => (
                                    <tr key={key}>
                                      <td className="text-capitalize" style={{ width: "50%" }}>
                                        {key.replace(/_/g, " ")}
                                      </td>
                                      <td style={{ width: "50%" }}>{val}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </Table>
                          </Col>
                          <Col md={7} sm={12} className="mb-2">
                            <WagonWheelChart data={details.wagon_wheel || []} perspective="Lines" />
                          </Col>
                        </Row>
                      )}
                    </Card.Body>
                  </Card>
                );
              })
            ) : (
              <Alert variant="info" className="mt-3" style={{ fontSize: "0.85rem" }}>
                {t("partnerships.noData") || "No partnership data available for this innings."}
              </Alert>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default PartnershipStatsPage;