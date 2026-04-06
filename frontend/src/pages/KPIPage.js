// src/pages/KPIPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  Collapse,
} from "react-bootstrap";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import useUITheme from "../theme/useUITheme";
import { useLanguage } from "../language/LanguageContext";
import BackButton from "../components/BackButton";
import api from "../api";

const OPERATOR_OPTIONS = [">=", ">", "==", "<=", "<", "!="];

const KPIPage = () => {
  const { user, isAdmin } = useAuth();
  const theme = useTheme();
  const ui = useUITheme();
  const { t } = useLanguage();

  // ---- Derive identity from logged-in user (no selectors) ----
  const countryId = user?.countryId ?? null;
  const teamCategory = user?.teamCategory || "Women";
  const countryName =
    theme.teamName ||
    t("common.yourTeam") ||
    "Your team";

  const [items, setItems] = useState([]); // full KPI list
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openBucket, setOpenBucket] = useState("Batting"); // only one open at a time

  // ---- Card styles (glass look) ----
  const glassCardStyle = useMemo(
    () => ({
      borderRadius: "1rem",
      background:
        "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(15,23,42,0.78))",
      border: `1px solid ${ui.border.subtle}`,
      boxShadow: "0 18px 40px rgba(0,0,0,0.6)",
      color: ui.text.primary,
      backdropFilter: "blur(18px)",
    }),
    [ui]
  );

  const headerTextStyle = {
    fontSize: "1.1rem",
    fontWeight: 650,
    marginBottom: 2,
  };

  const subTextStyle = {
    fontSize: "0.8rem",
    opacity: 0.75,
  };

  // ---- Load KPI config once user + countryId are known ----
  useEffect(() => {
    if (!user || countryId == null || !teamCategory) return;

    const fetchConfig = async () => {
      try {
        setLoadingConfig(true);
        setError("");
        setSuccess("");

        // IMPORTANT: follow same breadcrumb pattern as Fixtures/Home
        const res = await api.get("/kpi-config", {
          params: {
            country_id: countryId,
            team_category: teamCategory,
          },
        });

        setItems(res.data?.items || []);
      } catch (err) {
        console.error("Failed to load KPI configuration", err);
        setError("Failed to load KPI configuration.");
        setItems([]);
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchConfig();
  }, [user, countryId, teamCategory]);

  // ---- Group KPIs by bucket, then by phase ----
  const grouped = useMemo(() => {
    const byBucket = {
      Batting: [],
      Bowling: [],
      Fielding: [],
      Match: [],
    };

    for (const item of items) {
      const bucketName = item.bucket || "Match";
      const bucket = byBucket[bucketName] ? bucketName : "Match";
      byBucket[bucket].push(item);
    }

    const groupByPhase = (list) => {
      const out = {};
      for (const it of list) {
        const phaseKey = it.phase || "Match";
        if (!out[phaseKey]) out[phaseKey] = [];
        out[phaseKey].push(it);
      }
      // Sort KPIs alphabetically within each phase
      Object.keys(out).forEach((ph) => {
        out[ph].sort((a, b) => a.label.localeCompare(b.label));
      });
      return out;
    };

    return {
      Batting: groupByPhase(byBucket.Batting),
      Bowling: groupByPhase(byBucket.Bowling),
      Fielding: groupByPhase(byBucket.Fielding),
      Match: groupByPhase(byBucket.Match),
    };
  }, [items]);

  // ---- Handlers ----
  const handleToggleActive = (key, value) => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, active: value } : it))
    );
  };

  const handleChangeOperator = (key, value) => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, operator: value } : it))
    );
  };

  const handleChangeTarget = (key, value) => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, target_value: value } : it))
    );
  };

  const handleSave = async () => {
    if (!items.length || countryId == null || !teamCategory) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // Attach country_id and team_category to match backend expectations
      const payload = {
        country_id: countryId,
        team_category: teamCategory,
        items: items.map((it) => ({
          key: it.key,
          operator: it.operator,
          target_value: it.target_value ?? "",
          active: !!it.active,
          bucket: it.bucket,
          phase: it.phase,
        })),
      };

      const res = await api.put("/kpi-config", payload);
      setItems(res.data?.items || items); // keep server as source of truth if it returns items
      setSuccess("KPI configuration saved.");
    } catch (err) {
      console.error("Failed to save KPI configuration", err);
      setError("Failed to save KPI configuration.");
    } finally {
      setSaving(false);
    }
  };

  const busy = loadingConfig || saving;

  const renderPhase = (phaseName, list) => {
    return (
      <div key={phaseName} className="mb-3">
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 4,
            color: ui.text.muted,
          }}
        >
          {phaseName}
        </div>

        {list.map((kpi) => (
          <div
            key={kpi.key}
            style={{
              marginTop: 6,
              padding: "8px 10px",
              borderRadius: 10,
              background:
                "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.85))",
              border: `1px solid ${ui.border.subtle}`,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                  {kpi.label}
                  {kpi.unit && (
                    <span style={{ opacity: 0.7, marginLeft: 4 }}>
                      ({kpi.unit})
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "0.73rem",
                    opacity: 0.75,
                  }}
                >
                  Key: <code>{kpi.key}</code>
                </div>
                {kpi.description && (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      opacity: 0.7,
                      marginTop: 2,
                    }}
                  >
                    {kpi.description}
                  </div>
                )}
              </div>
              <Form.Check
                type="switch"
                id={`${kpi.bucket}-${kpi.key}`}
                label={kpi.active ? "Active" : "Inactive"}
                checked={!!kpi.active}
                onChange={(e) =>
                  handleToggleActive(kpi.key, e.target.checked)
                }
                style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 4,
              }}
            >
              <Form.Select
                size="sm"
                style={{ maxWidth: 120 }}
                value={kpi.operator || "=="} // default
                onChange={(e) =>
                  handleChangeOperator(kpi.key, e.target.value)
                }
              >
                {OPERATOR_OPTIONS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </Form.Select>
              <Form.Control
                size="sm"
                type="text"
                placeholder="Target"
                value={kpi.target_value ?? ""}
                onChange={(e) =>
                  handleChangeTarget(kpi.key, e.target.value)
                }
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderBucketCard = (bucketName, phasesObj, subtitle) => {
    const isOpen = openBucket === bucketName;
    const phaseNames = Object.keys(phasesObj);
    const kpiCount = phaseNames.reduce(
      (acc, ph) => acc + (phasesObj[ph]?.length || 0),
      0
    );

    return (
      <Card key={bucketName} className="mb-3" style={glassCardStyle}>
        <Card.Header
          onClick={() =>
            setOpenBucket((prev) => (prev === bucketName ? null : bucketName))
          }
          style={{
            cursor: "pointer",
            background: "transparent",
            borderBottom: `1px solid ${
              isOpen ? theme.accentColor : ui.border.subtle
            }`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 10,
            paddingBottom: 10,
          }}
        >
          <div>
            <div style={headerTextStyle}>{bucketName} KPIs</div>
            <div style={subTextStyle}>
              {subtitle} ·{" "}
              <span style={{ fontWeight: 500 }}>{kpiCount} metrics</span>
            </div>
          </div>
          <div
            style={{
              fontSize: "1.2rem",
              opacity: 0.8,
              transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease-out",
            }}
          >
            ▸
          </div>
        </Card.Header>
        <Collapse in={isOpen}>
          <div>
            <Card.Body>
              {kpiCount === 0 && (
                <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>
                  No KPIs defined in this bucket yet.
                </div>
              )}
              {phaseNames.map((ph) => renderPhase(ph, phasesObj[ph]))}
            </Card.Body>
          </div>
        </Collapse>
      </Card>
    );
  };

  // ---- Guards ----
  if (!user) {
    return (
      <div className="container-fluid py-3">
        <BackButton />
        <Alert variant="warning" className="mt-3">
          You need to be logged in to configure KPIs.
        </Alert>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container-fluid py-3">
        <BackButton />
        <Alert variant="warning" className="mt-3">
          Only admins can configure KPIs for this team.
        </Alert>
      </div>
    );
  }

  return (
    <div className="container-fluid py-3">
      <BackButton />

      {/* Hero banner */}
      <Card
        className="mb-3 position-relative"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor}44, ${theme.accentColor}66)`,
          border: `1px solid ${ui.border.subtle}`,
          color: ui.text.primary,
          borderRadius: "1.25rem",
          overflow: "hidden",
        }}
      >
        {/* Accent stripe */}
        <div
          style={{
            position: "absolute",
            width: 4,
            left: 0,
            top: 0,
            bottom: 0,
            background: theme.accentColor,
          }}
        />
        <Card.Body>
          <Row className="align-items-center">
            <Col md={8}>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span
                  style={{
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.09em",
                    fontWeight: 600,
                    opacity: 0.85,
                  }}
                >
                  KPI CONFIGURATION
                </span>
              </div>
              <h2
                style={{
                  marginBottom: 4,
                  fontWeight: 700,
                  fontSize: "1.5rem",
                }}
              >
                Define your match KPIs
              </h2>
              <div style={{ fontSize: "0.9rem", opacity: 0.85 }}>
                Choose which metrics you care about for{" "}
                <strong>{countryName}</strong> –{" "}
                <strong>{teamCategory}</strong>, then set the targets that
                define a “pass” for each phase of the game.
              </div>

              <div
                className="mt-2"
                style={{ fontSize: "0.8rem", opacity: 0.8 }}
              >
                These settings are used automatically on the Post Game summary
                and match reports. Only KPIs marked{" "}
                <strong>Active</strong> will appear there.
              </div>
            </Col>
            <Col
              md={4}
              className="mt-3 mt-md-0 d-flex flex-column align-items-md-end align-items-start gap-2"
            >
              <div className="d-flex align-items-center gap-2">
                {theme.flagUrl && (
                  <img
                    src={theme.flagUrl}
                    alt="Team flag"
                    style={{
                      width: 56,
                      height: 36,
                      borderRadius: 6,
                      objectFit: "cover",
                      boxShadow: "0 0 10px rgba(0,0,0,0.6)",
                    }}
                  />
                )}
                <div style={{ fontSize: "0.85rem" }}>
                  <div style={{ fontWeight: 600 }}>
                    {countryName} — {teamCategory}
                  </div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                    KPIs apply to all matches for this team.
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                onClick={handleSave}
                disabled={busy || items.length === 0}
                style={{
                  marginTop: 8,
                  borderRadius: 999,
                  paddingInline: 20,
                  fontWeight: 600,
                  background: theme.accentColor,
                  borderColor: theme.accentColor,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.45)",
                }}
              >
                {saving ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Saving…
                  </>
                ) : (
                  "Save KPI targets"
                )}
              </Button>
            </Col>
          </Row>

          {error && (
            <Alert
              variant="danger"
              onClose={() => setError("")}
              dismissible
              className="mt-3 mb-0 py-2"
              style={{ fontSize: "0.85rem" }}
            >
              {error}
            </Alert>
          )}
          {success && (
            <Alert
              variant="success"
              onClose={() => setSuccess("")}
              dismissible
              className="mt-3 mb-0 py-2"
              style={{ fontSize: "0.85rem" }}
            >
              {success}
            </Alert>
          )}
          {loadingConfig && !error && (
            <div className="d-flex align-items-center gap-2 mt-2">
              <Spinner size="sm" animation="border" />
              <span style={{ fontSize: "0.85rem" }}>
                Loading KPI definitions…
              </span>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* KPI buckets */}
      {items.length === 0 && !loadingConfig && !error && (
        <Alert
          variant="secondary"
          className="mt-2"
          style={{ fontSize: "0.85rem" }}
        >
          No KPIs are defined yet. Once they’re seeded in the database, you’ll
          be able to configure them here. The first time you hit{" "}
          <strong>Save KPI targets</strong>, your configuration will be saved
          for {countryName} – {teamCategory}.
        </Alert>
      )}

      {items.length > 0 && (
        <Row>
          <Col lg={6}>
            {renderBucketCard(
              "Batting",
              grouped.Batting,
              "Powerplay, middle and death batting goals"
            )}
            {renderBucketCard(
              "Fielding",
              grouped.Fielding,
              "Catches, clean hands, run-outs and discipline"
            )}
          </Col>
          <Col lg={6}>
            {renderBucketCard(
              "Bowling",
              grouped.Bowling,
              "Powerplay, middle and death bowling targets"
            )}
            {renderBucketCard(
              "Match",
              grouped.Match,
              "Whole-match outcomes and team objectives"
            )}
          </Col>
        </Row>
      )}
    </div>
  );
};

export default KPIPage;
