import React, { useEffect, useState } from "react";
import { Row, Col, Alert, Spinner, Card, Modal } from "react-bootstrap";
import { useLanguage } from "../language/LanguageContext";
import api from "../api";
import WagonWheelChart from "./WagonWheelChart";
import PitchMapChart from "./PitchMapChart";
import "./MatchScorecardPage.css";

const MatchScorecardPage = ({ selectedMatch, teamCategory }) => {
  const { t } = useLanguage();

  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [batterDetails, setBatterDetails] = useState({});
  const [bowlerDetails, setBowlerDetails] = useState({});

  const [activeBatterKey, setActiveBatterKey] = useState(null);
  const [batterModalOpen, setBatterModalOpen] = useState(false);
  const [batterModalLoading, setBatterModalLoading] = useState(false);
  const [batterModalMeta, setBatterModalMeta] = useState(null);

  const [activeBowlerKey, setActiveBowlerKey] = useState(null);
  const [bowlerModalOpen, setBowlerModalOpen] = useState(false);
  const [bowlerModalLoading, setBowlerModalLoading] = useState(false);
  const [bowlerModalMeta, setBowlerModalMeta] = useState(null);

  const cardStyle = {
    backgroundColor: "var(--color-surface-elevated)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
    color: "var(--color-text-primary)",
    borderRadius: 12,
  };

  useEffect(() => {
    if (!selectedMatch) {
      setScorecard(null);
      setError("");
      setBatterDetails({});
      setBowlerDetails({});
      setActiveBatterKey(null);
      setActiveBowlerKey(null);
      setBatterModalOpen(false);
      setBowlerModalOpen(false);
      return;
    }

    const fetchScorecard = async () => {
      try {
        setLoading(true);
        setError("");
        setScorecard(null);
        setBatterDetails({});
        setBowlerDetails({});
        setActiveBatterKey(null);
        setActiveBowlerKey(null);
        setBatterModalOpen(false);
        setBowlerModalOpen(false);

        const res = await api.post("/match-scorecard", {
          team_category: teamCategory,
          tournament: selectedMatch.tournament,
          match_id: selectedMatch.match_id,
        });

        setScorecard(res.data || null);
      } catch (err) {
        console.error("Error loading scorecard", err);
        setError(
          err?.response?.data?.detail ||
            err.message ||
            "Error loading scorecard"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchScorecard();
  }, [selectedMatch, teamCategory]);

  const hasSelectedMatch = !!selectedMatch;

  /** ---------- Dismissal formatting helper ---------- **/
  const formatDismissalColumns = (b) => {
    const dismissalRaw = (b.dismissal_type || "").toLowerCase();
    const fielderName = b.fielder_text || "";
    const bowlerName = b.bowler_text || "";

    const isNotOut = !dismissalRaw && !fielderName && !bowlerName;

    if (isNotOut) {
      return {
        fielder: t("matchScorecard.notOutLabel") || "not out",
        bowler: "",
        isNotOut: true,
      };
    }

    // Caught
    if (dismissalRaw.includes("caught") || dismissalRaw === "c") {
      return {
        fielder: fielderName ? `c. ${fielderName}` : "",
        bowler: bowlerName ? `b. ${bowlerName}` : "",
        isNotOut: false,
      };
    }

    // Stumped
    if (dismissalRaw.includes("stump")) {
      return {
        fielder: fielderName ? `st. ${fielderName}` : "",
        bowler: bowlerName ? `b. ${bowlerName}` : "",
        isNotOut: false,
      };
    }

    // Run out
    if (dismissalRaw.includes("run out") || dismissalRaw.includes("runout")) {
      return {
        fielder: fielderName
          ? `${t("matchScorecard.dismissRunOutPrefix") || "run out."} ${
              fielderName
            }`
          : t("matchScorecard.dismissRunOutLabel") || "run out",
        bowler: "",
        isNotOut: false,
      };
    }

    // LBW
    if (dismissalRaw.includes("lbw")) {
      return {
        fielder: "",
        bowler: bowlerName ? `lbw. ${bowlerName}` : "lbw.",
        isNotOut: false,
      };
    }

    // Bowled
    if (dismissalRaw.includes("bowled")) {
      return {
        fielder: "",
        bowler: bowlerName ? `b. ${bowlerName}` : "b.",
        isNotOut: false,
      };
    }

    // Fallback – keep what backend gives us
    return {
      fielder: fielderName,
      bowler: bowlerName,
      isNotOut: false,
    };
  };

  /** ---------- Batter click -> modal ---------- **/
  const handleBatterClick = (inningsIndex, inn, batter) => {
    if (!selectedMatch || !batter?.player_id) return;

    const key = `${selectedMatch.match_id}_${batter.player_id}`;

    setActiveBatterKey(key);
    setBatterModalMeta({
      name: batter.player,
      runs: batter.runs,
      balls: batter.balls,
    });
    setBatterModalOpen(true);

    if (batterDetails[key]) return;

    setBatterModalLoading(true);
    api
      .get("/scorecard-player-detail", {
        params: {
          matchId: selectedMatch.match_id,
          playerId: batter.player_id,
        },
      })
      .then((res) => {
        const detail = res.data || {};
        const transformedShots = (detail.shots || []).map((ball) => ({
          x: ball.shot_x,
          y: ball.shot_y,
          runs: ball.runs,
          dismissal_type: ball.dismissal_type,
        }));

        setBatterDetails((prev) => ({
          ...prev,
          [key]: { ...detail, shots: transformedShots },
        }));
      })
      .catch((err) => {
        console.error("Error fetching batter detail", err);
      })
      .finally(() => {
        setBatterModalLoading(false);
      });
  };

  /** ---------- Bowler click -> modal ---------- **/
  const handleBowlerClick = (inningsIndex, inn, bowler) => {
    if (!selectedMatch || !bowler?.player_id) return;

    const key = `${selectedMatch.match_id}_${bowler.player_id}`;

    setActiveBowlerKey(key);
    setBowlerModalMeta({
      name: bowler.bowler,
      overs: bowler.overs,
      dots: bowler.dots,
      runs: bowler.runs,
      wickets: bowler.wickets,
    });
    setBowlerModalOpen(true);

    if (bowlerDetails[key]) return;

    setBowlerModalLoading(true);
    api
      .get("/scorecard-bowler-detail", {
        params: {
          matchId: selectedMatch.match_id,
          playerId: bowler.player_id,
        },
      })
      .then((res) => {
        const detail = res.data || {};
        const transformedPitchMap = (detail.pitch_map || []).map((ball) => ({
          pitch_x: ball.pitch_x,
          pitch_y: ball.pitch_y,
          runs: ball.runs,
          wides: ball.wides,
          no_balls: ball.no_balls,
          dismissal_type: ball.dismissal_type,
        }));

        setBowlerDetails((prev) => ({
          ...prev,
          [key]: {
            ...detail,
            pitch_map: transformedPitchMap,
          },
        }));
      })
      .catch((err) => {
        console.error("Error fetching bowler detail", err);
      })
      .finally(() => {
        setBowlerModalLoading(false);
      });
  };

  /** ---------- Top-level states ---------- **/
  if (!hasSelectedMatch) {
    return (
      <Alert variant="info" style={{ fontSize: "0.9rem" }}>
        {t("matchScorecard.selectMatchHint") ||
          "Select a match above to view the full scorecard."}
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2">
        <Spinner animation="border" size="sm" />
        <span style={{ fontSize: "0.9rem" }}>
          {t("matchScorecard.loading") || "Loading scorecard…"}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" style={{ fontSize: "0.9rem" }}>
        {t("matchScorecard.error") ||
          "There was a problem loading this scorecard."}
        <br />
        <small>{error}</small>
      </Alert>
    );
  }

  if (!scorecard || !scorecard.innings || scorecard.innings.length === 0) {
    return (
      <Alert variant="secondary" style={{ fontSize: "0.9rem" }}>
        {t("matchScorecard.noData") ||
          "No scorecard data available for this match yet."}
      </Alert>
    );
  }

  const innings = scorecard.innings || [];

  /** ---------- Render one innings as sleek card + grid ---------- **/
  const renderInningsCard = (inningsIndex) => {
    const inn = innings[inningsIndex];
    if (!inn) {
      return (
        <Card className="h-100" style={cardStyle}>
          <Card.Body className="d-flex align-items-center justify-content-center">
            <Alert
              variant="secondary"
              className="mb-0 text-center w-100"
              style={{ fontSize: "0.8rem" }}
            >
              {t("matchScorecard.inningsNotAvailable") ||
                "This innings has not started yet."}
            </Alert>
          </Card.Body>
        </Card>
      );
    }

    const extras = inn.extras || {};
    const fow = inn.fall_of_wickets || [];
    const totalWickets = fow.length;
    const overs = inn.overs;

    return (
      <Card className="h-100" style={cardStyle}>
        <Card.Body>
          {/* Header line */}
          <div className="mb-3">
            <div className="scorecard-innings-banner">
              <div className="scorecard-innings-tag">
                {(t("matchScorecard.inningsLabel") || "Innings") +
                  " " +
                  (inningsIndex + 1)}
              </div>

              <div className="scorecard-innings-team">{inn.team || ""}</div>

              <div className="scorecard-innings-score">
                {inn.total} / {totalWickets}{" "}
                <span className="scorecard-innings-overs">
                  {t("matchScorecard.inOvers") || "in"} {overs}{" "}
                  {t("matchScorecard.oversSuffix") || "overs"}
                </span>
              </div>
            </div>
          </div>

          {/* Batting */}
          <div className="mb-3">
            <div className="scorecard-grid scorecard-grid--batting">
              {/* Header row */}
              <div className="scorecard-row scorecard-row--header">
                <div>{t("matchScorecard.colBatter") || "Batter"}</div>
                <div>{t("matchScorecard.colFielder") || "Fielder"}</div>
                <div>{t("matchScorecard.colBowler") || "Bowler"}</div>
                <div className="text-end">
                  {t("matchScorecard.colRuns") || "R"}
                </div>
                <div className="text-end">
                  {t("matchScorecard.colBalls") || "B"}
                </div>
                <div className="text-end">
                  {t("matchScorecard.colFours") || "4s"}
                </div>
                <div className="text-end">
                  {t("matchScorecard.colSixes") || "6s"}
                </div>
                <div className="text-end">
                  {t("matchScorecard.colSr") || "SR"}
                </div>
              </div>

              {/* Data rows */}
              {(inn.batting_card || []).map((b, rowIndex) => {
                const clickable = !!b.player_id;
                const { fielder, bowler, isNotOut } = formatDismissalColumns(b);

                return (
                  <div
                    key={rowIndex}
                    className={
                      "scorecard-row scorecard-row--data" +
                      (clickable ? " scorecard-row--clickable" : "")
                    }
                    onClick={() =>
                      clickable && handleBatterClick(inningsIndex, inn, b)
                    }
                  >
                    <div className="scorecard-cell-batter">
                      <span
                        style={{
                          color: "var(--color-text-primary)",
                          textDecoration: clickable
                            ? "underline dotted"
                            : "none",
                        }}
                      >
                        {b.player}
                        {b.is_captain ? " ©" : ""}
                        {b.is_keeper ? " †" : ""}
                      </span>
                    </div>
                    <div
                      className={
                        isNotOut
                          ? "fst-italic scorecard-cell-fielder"
                          : "scorecard-cell-fielder"
                      }
                    >
                      {fielder}
                    </div>
                    <div className="scorecard-cell-bowler">{bowler}</div>
                    <div className="text-end">{b.runs}</div>
                    <div className="text-end">{b.balls}</div>
                    <div className="text-end">{b.fours}</div>
                    <div className="text-end">{b.sixes}</div>
                    <div className="text-end">{b.strike_rate}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bowling */}
          <div className="mb-3">
            <div className="scorecard-grid scorecard-grid--bowling">
              <div className="scorecard-row scorecard-row--header">
                <div>{t("matchScorecard.colBowler") || "Bowler"}</div>
                <div className="text-end">
                  {t("matchScorecard.colOvers") || "O"}
                </div>
                <div className="text-end">
                  {t("matchScorecard.colDots") || "Dots"}
                </div>
                <div className="text-end">
                  {t("matchScorecard.colRuns") || "R"}
                </div>
                <div className="text-end">
                  {t("matchScorecard.colWickets") || "W"}
                </div>
                <div className="text-end">
                  {t("matchScorecard.colEcon") || "Econ"}
                </div>
                <div className="text-end">
                  {t("matchScorecard.colWides") || "WD"}
                </div>
                <div className="text-end">
                  {t("matchScorecard.colNoBalls") || "NB"}
                </div>
              </div>

              {(inn.bowling_card || []).map((b, rowIndex) => {
                const clickable = !!b.player_id;

                return (
                  <div
                    key={rowIndex}
                    className={
                      "scorecard-row scorecard-row--data" +
                      (clickable ? " scorecard-row--clickable" : "")
                    }
                    onClick={() =>
                      clickable && handleBowlerClick(inningsIndex, inn, b)
                    }
                  >
                    <div className="scorecard-cell-bowler-name">
                      <span
                        style={{
                          color: "var(--color-text-primary)",
                          textDecoration: clickable
                            ? "underline dotted"
                            : "none",
                        }}
                      >
                        {b.bowler}
                      </span>
                    </div>
                    <div className="text-end">{b.overs}</div>
                    <div className="text-end">{b.dots}</div>
                    <div className="text-end">{b.runs}</div>
                    <div className="text-end">{b.wickets}</div>
                    <div className="text-end">{b.economy}</div>
                    <div className="text-end">{b.wides}</div>
                    <div className="text-end">{b.no_balls}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Extras + FOW */}
          <div style={{ fontSize: "0.85rem" }}>
            <div className="mb-1">
              <strong>
                {t("matchScorecard.extrasLabel") || "Extras"}:
              </strong>{" "}
              {`W ${extras.wides ?? 0}, NB ${extras.no_balls ?? 0}, B ${
                extras.byes ?? 0
              }, LB ${extras.leg_byes ?? 0}, P ${extras.penalty ?? 0}`}
            </div>
            <div className="mb-1">
              <strong>
                {t("matchScorecard.fowLabel") || "Fall of wickets"}:
              </strong>{" "}
              {fow.length ? fow.join(", ") : "-"}
            </div>
          </div>
        </Card.Body>
      </Card>
    );
  };

  const activeBatterDetail =
    activeBatterKey && batterDetails[activeBatterKey]
      ? batterDetails[activeBatterKey]
      : null;

  const activeBowlerDetail =
    activeBowlerKey && bowlerDetails[activeBowlerKey]
      ? bowlerDetails[activeBowlerKey]
      : null;

  return (
    <>
      {/* Two innings – page scroll only, no internal scrollbars */}
      <Row className="g-3">
        <Col md={6}>{renderInningsCard(0)}</Col>
        <Col md={6}>{renderInningsCard(1)}</Col>
      </Row>

      {/* Full-width result band */}
      {scorecard.result && (
        <div className="match-result-band mt-4">{scorecard.result}</div>
      )}

      {/* Batter detail modal */}
      <Modal
        show={batterModalOpen}
        onHide={() => setBatterModalOpen(false)}
        size="lg"
        centered
        contentClassName="themed-modal-content"
      >
        <Modal.Header
          closeButton
          className="scorecard-modal-header-gradient"
        >
          <Modal.Title as="div" className="scorecard-modal-header-main">
            <div className="scorecard-modal-header-name">
              {batterModalMeta?.name}
            </div>

            {batterModalMeta?.runs != null &&
              batterModalMeta?.balls != null && (
                <div className="scorecard-modal-header-runs">
                  {batterModalMeta.runs}
                  <span className="scorecard-modal-header-balls">
                    ({batterModalMeta.balls})
                  </span>
                </div>
              )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="scorecard-modal-inner">
            {batterModalLoading && !activeBatterDetail && (
              <div className="d-flex align-items-center gap-2">
                <Spinner animation="border" size="sm" />
                <span style={{ fontSize: "0.9rem" }}>
                  {t("matchScorecard.loading") || "Loading scorecard…"}
                </span>
              </div>
            )}

            {!batterModalLoading && !activeBatterDetail && (
              <div style={{ fontSize: "0.85rem" }}>
                {t("matchScorecard.noData") ||
                  "No detail data available for this player."}
              </div>
            )}

            {activeBatterDetail && (
              <Row className="g-3">
                <Col md={5}>
                  <div className="themed-subheading">
                    {t("matchScorecard.playerDetailRunBreakdown") ||
                      "Run breakdown"}
                  </div>
                  <ul
                    className="mb-2"
                    style={{ paddingLeft: 18, fontSize: "0.9rem" }}
                  >
                    {Object.entries(
                      activeBatterDetail.run_breakdown || {}
                    ).map(([runs, count]) => (
                      <li key={runs}>
                        <strong>{runs}:</strong> {count}
                      </li>
                    ))}
                    {activeBatterDetail.scoring_pct != null && (
                      <li>
                        <strong>
                          {t("matchScorecard.playerDetailScoringPct") ||
                            "Scoring shot %"}
                          :
                        </strong>{" "}
                        {activeBatterDetail.scoring_pct}%
                      </li>
                    )}
                    {activeBatterDetail.avg_intent != null && (
                      <li>
                        <strong>
                          {t("matchScorecard.playerDetailIntent") ||
                            "Avg intent"}
                          :
                        </strong>{" "}
                        {activeBatterDetail.avg_intent}
                      </li>
                    )}
                  </ul>
                </Col>
                <Col md={7}>
                  <div className="themed-subheading">
                    {t("matchScorecard.playerDetailWagonWheel") ||
                      "Wagon wheel"}
                  </div>
                  <div className="scorecard-wagon-modal-wrapper">
                    <WagonWheelChart
                      data={activeBatterDetail.shots || []}
                      perspective="Lines"
                    />
                  </div>
                </Col>
              </Row>
            )}
          </div>
        </Modal.Body>
      </Modal>

      {/* Bowler detail modal */}
      <Modal
        show={bowlerModalOpen}
        onHide={() => setBowlerModalOpen(false)}
        size="lg"
        centered
        contentClassName="themed-modal-content"
      >
        <Modal.Header
          closeButton
          className="scorecard-modal-header-gradient"
        >
          <Modal.Title as="div" className="scorecard-modal-header-main">
            <div className="scorecard-modal-header-name">
              {bowlerModalMeta?.name}
            </div>

            {bowlerModalMeta && (
              <div className="scorecard-modal-header-bowler-stats">
                <span className="scorecard-modal-header-bowler-stat">
                  <span className="scorecard-modal-header-bowler-stat-label">
                    O
                  </span>
                  <span>{bowlerModalMeta.overs}</span>
                </span>
                <span className="scorecard-modal-header-bowler-stat">
                  <span className="scorecard-modal-header-bowler-stat-label">
                    Dots
                  </span>
                  <span>{bowlerModalMeta.dots}</span>
                </span>
                <span className="scorecard-modal-header-bowler-stat">
                  <span className="scorecard-modal-header-bowler-stat-label">
                    R
                  </span>
                  <span>{bowlerModalMeta.runs}</span>
                </span>
                <span className="scorecard-modal-header-bowler-stat">
                  <span className="scorecard-modal-header-bowler-stat-label">
                    W
                  </span>
                  <span>{bowlerModalMeta.wickets}</span>
                </span>
              </div>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="scorecard-modal-inner">
            {bowlerModalLoading && !activeBowlerDetail && (
              <div className="d-flex align-items-center gap-2">
                <Spinner animation="border" size="sm" />
                <span style={{ fontSize: "0.9rem" }}>
                  {t("matchScorecard.loading") || "Loading scorecard…"}
                </span>
              </div>
            )}

            {!bowlerModalLoading && !activeBowlerDetail && (
              <div style={{ fontSize: "0.85rem" }}>
                {t("matchScorecard.noData") ||
                  "No detail data available for this bowler."}
              </div>
            )}

            {activeBowlerDetail && (
              <Row className="g-3">
                <Col md={5}>
                  <div className="themed-subheading">
                    {t("matchScorecard.bowlerDetailSummary") ||
                      "Bowling summary"}
                  </div>
                  <ul
                    className="mb-2"
                    style={{ paddingLeft: 18, fontSize: "0.9rem" }}
                  >
                    <li>
                      <strong>
                        {t("matchScorecard.bowlerDetailRuns") ||
                          "Runs conceded"}
                        :
                      </strong>{" "}
                      {activeBowlerDetail.summary?.runs_conceded}
                    </li>
                    <li>
                      <strong>
                        {t("matchScorecard.bowlerDetailRealRuns") ||
                          "Real runs conceded"}
                        :
                      </strong>{" "}
                      {activeBowlerDetail.summary?.real_runs_conceded}
                    </li>
                    <li>
                      <strong>
                        {t("matchScorecard.bowlerDetailChances") ||
                          "Chances created"}
                        :
                      </strong>{" "}
                      {activeBowlerDetail.summary?.chances_made}
                    </li>
                    <li>
                      <strong>
                        {t("matchScorecard.bowlerDetailWickets") ||
                          "Wickets"}
                        :
                      </strong>{" "}
                      {activeBowlerDetail.summary?.wickets}
                    </li>
                    <li>
                      <strong>
                        {t("matchScorecard.bowlerDetailRealWickets") ||
                          "Real wickets"}
                        :
                      </strong>{" "}
                      {activeBowlerDetail.summary?.real_wickets}
                    </li>
                    <li>
                      <strong>
                        {t("matchScorecard.bowlerDetailRealEcon") ||
                          "Real economy"}
                        :
                      </strong>{" "}
                      {activeBowlerDetail.summary?.real_economy}
                    </li>
                    <li>
                      <strong>
                        {t("matchScorecard.bowlerDetailRealSr") ||
                          "Real strike rate"}
                        :
                      </strong>{" "}
                      {activeBowlerDetail.summary?.real_strike_rate}
                    </li>
                  </ul>
                </Col>
                <Col md={7}>
                  <div className="themed-subheading">
                    {t("matchScorecard.bowlerDetailPitchMap") || "Pitch map"}
                  </div>
                  <div className="scorecard-pitch-modal-wrapper">
                    <PitchMapChart
                      data={activeBowlerDetail.pitch_map || []}
                      compact
                    />
                  </div>
                </Col>
              </Row>
            )}
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default MatchScorecardPage;
