import React, { useContext, useMemo, useRef, useState } from "react";
import { Row, Col, Card, Button, Modal, Form, Spinner } from "react-bootstrap";
import DarkModeContext from "../DarkModeContext";
import BackButton from "../components/BackButton";
import { useTheme } from "../theme/ThemeContext";
import { useLanguage } from "../language/LanguageContext";

export default function Training() {
  const { isDarkMode } = useContext(DarkModeContext);
  

  // Theme & translation hooks
  const theme = useTheme();
  const { t } = useLanguage();

  // Themed card style for the training tool card
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

  const [showField, setShowField] = useState(false);

  return (
    <div className={isDarkMode ? "text-white" : "text-dark"}>
      <div className="container-fluid py-4">
        <BackButton isDarkMode={isDarkMode} />

        <Row className="g-4">
          <Col md={4}>
            <Card className="h-100 shadow" style={cardStyle}>
              <Card.Body>
                <Card.Title className="fw-bold">
                  {t("interactiveField") !== "interactiveField"
                    ? t("interactiveField")
                    : "Interactive Field"}
                </Card.Title>
                <Card.Text className="mb-3">
                  {t("training.interactiveFieldDescription") !==
                  "training.interactiveFieldDescription"
                    ? t("training.interactiveFieldDescription")
                    : "Drag & drop players to set a field. Men/Women, PP/Middle/Death, soft rule checks, and PDF export."}
                </Card.Text>
                <Button onClick={() => setShowField(true)}>
                  {t("open") !== "open" ? t("open") : "Open"}
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Fullscreen self-contained Interactive Field (no routing) */}
      <InteractiveFieldModal
        show={showField}
        onHide={() => setShowField(false)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

/* -------------------------------------------------------------
   Interactive Field — Fullscreen Modal (self-contained)
------------------------------------------------------------- */

function InteractiveFieldModal({ show, onHide, isDarkMode }) {
  const { t } = useLanguage();

  // Canvas geometry
  const CANVAS_SIZE = 720;
  const CENTER = CANVAS_SIZE / 2;
  const BOUNDARY_R = 320;
  const INNER_RING_R = 190;

  // UI state
  const [gender, setGender] = useState("Women");     // "Men" | "Women"
  const [phase, setPhase] = useState("Powerplay");   // "Powerplay" | "Middle" | "Death"
  const [hand, setHand] = useState("RHB");           // "RHB" | "LHB"
  const [bowlerName, setBowlerName] = useState("");

  // Fielders (WK/Bowler pre-placed + 9 fielder chips)
  const START_WK = { id: "wk", label: "WK", x: 0, y: -60, placed: true, role: "WK" };
  const START_B = { id: "bowler", label: "Bowler", x: 0, y: 100, placed: true, role: "Bowler" };

  const DEFAULT_FIELDERS = Array.from({ length: 9 }).map((_, i) => ({
    id: `f${i + 1}`,
    label: `F${i + 1}`,
    x: 0,
    y: 0,
    placed: false,
    role: "Fielder",
  }));

  const [fielders, setFielders] = useState([START_WK, START_B, ...DEFAULT_FIELDERS]);
  const [dragId, setDragId] = useState(null);

  const stageRef = useRef(null);
  const exportRef = useRef(null);
  const [saving, setSaving] = useState(false);

  // Helpers
  const clampToCircle = (x, y, r) => {
    const d = Math.hypot(x, y);
    if (d <= r) return { x, y };
    const s = r / d;
    return { x: x * s, y: y * s };
  };
  const isOutsideInner = (x, y) => Math.hypot(x, y) > INNER_RING_R + 0.0001;
  const isOnOffSide = (x, hand_) => (hand_ === "RHB" ? x < 0 : x > 0);
  const isLegSide = (x, hand_) => !isOnOffSide(x, hand_);
  const isBehindSquare = (y) => y < 0;

  // Drag
  const onPointerDown = (e, id) => {
    setDragId(id);
    e.target.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragId || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left - CENTER;
    const py = e.clientY - rect.top - CENTER;
    const { x, y } = clampToCircle(px, py, BOUNDARY_R);
    setFielders((prev) =>
      prev.map((f) => (f.id === dragId ? { ...f, x, y, placed: true } : f))
    );
  };
  const onPointerUp = () => setDragId(null);

  // Computed counts (excludes WK & Bowler)
  const placedFielders = useMemo(
    () => fielders.filter((f) => f.placed),
    [fielders]
  );
  const countingFielders = useMemo(
    () => placedFielders.filter((f) => f.role !== "Bowler" && f.role !== "WK"),
    [placedFielders]
  );
  const outsideInnerCount = useMemo(
    () =>
      countingFielders.reduce(
        (acc, f) => acc + (isOutsideInner(f.x, f.y) ? 1 : 0),
        0
      ),
    [countingFielders]
  );
  const offSideCount = useMemo(
    () =>
      countingFielders.reduce(
        (acc, f) => acc + (isOnOffSide(f.x, hand) ? 1 : 0),
        0
      ),
    [countingFielders, hand]
  );
  const legBehindSquareCount = useMemo(
    () =>
      countingFielders.reduce(
        (acc, f) =>
          acc + (isLegSide(f.x, hand) && isBehindSquare(f.y) ? 1 : 0),
        0
      ),
    [countingFielders, hand]
  );

  // Limits (soft)
  const outsideMax = phase === "Powerplay" ? 2 : gender === "Men" ? 5 : 4;

  const outsidePrefix =
    t("training.rules.outsideInnerPrefix") !==
    "training.rules.outsideInnerPrefix"
      ? t("training.rules.outsideInnerPrefix")
      : "Outside inner ring";
  const offSidePrefix =
    t("training.rules.offSideMinPrefix") !==
    "training.rules.offSideMinPrefix"
      ? t("training.rules.offSideMinPrefix")
      : "Min 4 on off side";
  const legBehindPrefix =
    t("training.rules.legBehindPrefix") !==
    "training.rules.legBehindPrefix"
      ? t("training.rules.legBehindPrefix")
      : "Max 2 behind square (leg)";

  const warnings = useMemo(
    () => [
      {
        id: "outside",
        ok: outsideInnerCount <= outsideMax,
        label: `${outsidePrefix}: ${outsideInnerCount}/${outsideMax}`,
      },
      {
        id: "off-min",
        ok: offSideCount >= 4,
        label: `${offSidePrefix}: ${offSideCount}/4`,
      },
      {
        id: "leg-behind",
        ok: legBehindSquareCount <= 2,
        label: `${legBehindPrefix}: ${legBehindSquareCount}/2`,
      },
    ],
    [
      outsideInnerCount,
      outsideMax,
      offSideCount,
      legBehindSquareCount,
      outsidePrefix,
      offSidePrefix,
      legBehindPrefix,
    ]
  );

  // Save to PDF (lazy import to avoid crashes)
  const savePDF = async () => {
    if (!exportRef.current) return;
    setSaving(true);
    try {
      const [h2cMod, jsPDFMod] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const html2canvas = h2cMod.default || h2cMod;
      const JsPDF = jsPDFMod.jsPDF || jsPDFMod.default;

      const node = exportRef.current;
      const prevBg = node.style.background;
      node.style.background = isDarkMode ? "#111" : "#fff";

      const canvas = await html2canvas(node, { scale: 2, useCORS: true });
      const img = canvas.toDataURL("image/png");

      const pdf = new JsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const margin = 36;
      const headerY1 = 40;
      const headerY2 = 60;
      const headerY3 = 78;

      const availableW = pageW - margin * 2;
      const availableH = pageH - margin - headerY3 - 12;

      const scaleW = availableW / canvas.width;
      const scaleH = availableH / canvas.height;
      const scale = Math.min(scaleW, scaleH);

      const imgW = canvas.width * scale;
      const imgH = canvas.height * scale;
      const imgX = margin + (availableW - imgW) / 2;
      const imgY = headerY3 + 12;

      const interactiveFieldTitle =
        t("interactiveField") !== "interactiveField"
          ? t("interactiveField")
          : "Interactive Field";

      const genderLabel =
        gender === "Women"
          ? t("categories.Women") !== "categories.Women"
            ? t("categories.Women")
            : "Women"
          : t("categories.Men") !== "categories.Men"
          ? t("categories.Men")
          : "Men";

      const phaseLabelMap = {
        Powerplay:
          t("tabs.Powerplay") !== "tabs.Powerplay"
            ? t("tabs.Powerplay")
            : "Powerplay",
        Middle:
          t("tabs.Middle Overs") !== "tabs.Middle Overs"
            ? t("tabs.Middle Overs")
            : "Middle",
        Death:
          t("tabs.Death Overs") !== "tabs.Death Overs"
            ? t("tabs.Death Overs")
            : "Death",
      };
      const phaseLabel = phaseLabelMap[phase] || phase;

      pdf.setFontSize(14);
      pdf.text(
        `${interactiveFieldTitle} – ${genderLabel} – ${phaseLabel}`,
        margin,
        headerY1
      );

      const bowlerLabel =
        t("training.bowlerLabel") !== "training.bowlerLabel"
          ? t("training.bowlerLabel")
          : "Bowler";

      pdf.text(
        `${bowlerLabel}: ${bowlerName || "(unspecified)"}`,
        margin,
        headerY2
      );
      pdf.setFontSize(11);

      pdf.addImage(img, "PNG", imgX, imgY, imgW, imgH);

      pdf.save(
        `Field_${bowlerName || "bowler"}_${gender}_${phase}.pdf`
      );
      node.style.background = prevBg;
    } catch (e) {
      console.error(e);
      alert("Could not generate PDF (html2canvas/jspdf missing or failed).");
    } finally {
      setSaving(false);
    }
  };

  const cardClass = isDarkMode
    ? "bg-secondary text-white border-0"
    : "bg-white text-dark border";

  const selectedVariant = isDarkMode ? "light" : "dark";
  const unselectedVariant = isDarkMode ? "outline-light" : "outline-dark";

  const offX = hand === "RHB" ? CENTER - 120 : CENTER + 120;
  const legX = hand === "RHB" ? CENTER + 120 : CENTER - 120;

  const bowlerLabel =
    t("training.bowlerLabel") !== "training.bowlerLabel"
      ? t("training.bowlerLabel")
      : "Bowler";

  const bowlerPlaceholder =
    t("training.bowlerNamePlaceholder") !==
    "training.bowlerNamePlaceholder"
      ? t("training.bowlerNamePlaceholder")
      : "Bowler name";

  const dragFieldersTitle =
    t("training.dragFieldersTitle") !== "training.dragFieldersTitle"
      ? t("training.dragFieldersTitle")
      : "Drag fielders onto the ground";

  const softRuleChecksTitle =
    t("training.softRuleChecksTitle") !== "training.softRuleChecksTitle"
      ? t("training.softRuleChecksTitle")
      : "Soft Rule Checks";

  const handHint =
    t("training.handHint") !== "training.handHint"
      ? t("training.handHint")
      : "Affects off/leg side";

  const dragToPlaceHint =
    t("training.dragToPlaceHint") !== "training.dragToPlaceHint"
      ? t("training.dragToPlaceHint")
      : "Drag to place";

  const phaseOptions = [
    {
      value: "Powerplay",
      labelKey: "tabs.Powerplay",
      fallback: "Powerplay",
    },
    {
      value: "Middle",
      labelKey: "tabs.Middle Overs",
      fallback: "Middle",
    },
    {
      value: "Death",
      labelKey: "tabs.Death Overs",
      fallback: "Death",
    },
  ];

  return (
    <Modal
      show={show}
      onHide={onHide}
      fullscreen
      centered
      contentClassName={isDarkMode ? "bg-dark text-white" : ""}
    >
      <Modal.Header closeButton>
        <Modal.Title>
          {t("interactiveField") !== "interactiveField"
            ? t("interactiveField")
            : "Interactive Field"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="pb-0">
        {/* Controls */}
        <div className={`p-3 rounded mb-3 ${cardClass}`}>
          <div className="d-flex flex-wrap align-items-center gap-2">
            {/* Gender */}
            <div className="btn-group" role="group" aria-label="Gender">
              {["Women", "Men"].map((g) => {
                const labelKey = `categories.${g}`;
                const label =
                  t(labelKey) !== labelKey ? t(labelKey) : g;
                return (
                  <Button
                    key={g}
                    variant={
                      gender === g ? selectedVariant : unselectedVariant
                    }
                    onClick={() => setGender(g)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>

            {/* Phase */}
            <div className="btn-group ms-2" role="group" aria-label="Phase">
              {phaseOptions.map((p) => {
                const label =
                  t(p.labelKey) !== p.labelKey
                    ? t(p.labelKey)
                    : p.fallback;
                return (
                  <Button
                    key={p.value}
                    variant={
                      phase === p.value
                        ? selectedVariant
                        : unselectedVariant
                    }
                    onClick={() => setPhase(p.value)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>

            {/* Batter hand */}
            <div className="btn-group ms-2" role="group" aria-label="Hand">
              {["RHB", "LHB"].map((h) => (
                <Button
                  key={h}
                  variant={
                    hand === h ? selectedVariant : unselectedVariant
                  }
                  onClick={() => setHand(h)}
                  title={handHint}
                >
                  {h}
                </Button>
              ))}
            </div>

            {/* Bowler */}
            <Form.Control
              className={`ms-2 ${
                isDarkMode ? "bg-dark text-white border-light" : ""
              }`}
              style={{ maxWidth: 240 }}
              placeholder={bowlerPlaceholder}
              value={bowlerName}
              onChange={(e) => setBowlerName(e.target.value)}
            />

            {/* Actions */}
            <Button
              variant={selectedVariant}
              className="ms-2"
              onClick={savePDF}
              disabled={saving}
            >
              {saving ? (
                <Spinner size="sm" animation="border" />
              ) : t("training.savePdfButton") !==
                "training.savePdfButton" ? (
                t("training.savePdfButton")
              ) : (
                "Save PDF"
              )}
            </Button>
          </div>
        </div>

        {/* Board + Side panel */}
        <div className="row g-3">
          {/* Board */}
          <div className="col-lg-8">
            <div ref={exportRef} className={`rounded p-3 ${cardClass}`}>
              <div
                className="text-center fw-bold mb-2"
                style={{ fontSize: 16 }}
              >
                {bowlerLabel}: {bowlerName || "—"}
              </div>

              <div
                ref={stageRef}
                className="position-relative mx-auto"
                style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {/* Ground */}
                <svg width={CANVAS_SIZE} height={CANVAS_SIZE} className="d-block">
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={BOUNDARY_R + 18}
                    fill={isDarkMode ? "#0e1a12" : "#dff3e3"}
                    stroke="#6c757d"
                  />
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={BOUNDARY_R}
                    fill="none"
                    stroke={isDarkMode ? "#f8f9fa" : "#212529"}
                    strokeWidth="2"
                  />
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={INNER_RING_R}
                    fill="none"
                    stroke={isDarkMode ? "#ced4da" : "#495057"}
                    strokeDasharray="6 6"
                  />
                  <rect
                    x={CENTER - 10}
                    y={CENTER - 35}
                    width="20"
                    height="70"
                    fill={isDarkMode ? "#e9ecef" : "#f8f9fa"}
                    stroke="#6c757d"
                  />

                  {/* Watermarks: OFF SIDE / LEG SIDE */}
                  <text
                    x={offX}
                    y={CENTER}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      opacity: 0.1,
                      fill: isDarkMode ? "#ffffff" : "#000000",
                      pointerEvents: "none",
                    }}
                    transform={`rotate(-90 ${offX} ${CENTER})`}
                  >
                    OFF SIDE
                  </text>

                  <text
                    x={legX}
                    y={CENTER}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      opacity: 0.08,
                      fill: isDarkMode ? "#ffffff" : "#000000",
                      pointerEvents: "none",
                    }}
                    transform={`rotate(90 ${legX} ${CENTER})`}
                  >
                    LEG SIDE
                  </text>
                </svg>

                {/* Chips */}
                {fielders.map((f) => {
                  const left = CENTER + f.x - 16;
                  const top = CENTER + f.y - 16;
                  const placed = f.placed;
                  const chipClass =
                    f.role === "WK"
                      ? "bg-warning text-dark border-warning"
                      : f.role === "Bowler"
                      ? "bg-info text-dark border-info"
                      : placed
                      ? isDarkMode
                        ? "bg-dark text-white border-light"
                        : "bg-white text-dark border-dark"
                      : isDarkMode
                      ? "bg-secondary text-white border-0 opacity-75"
                      : "bg-light text-dark border opacity-75";

                  return (
                    <div
                      key={f.id}
                      className="position-absolute user-select-none"
                      style={{ left, top }}
                    >
                      <button
                        onPointerDown={(e) => onPointerDown(e, f.id)}
                        className="d-flex align-items-center justify-content-center rounded-circle border fw-bold"
                        style={{ width: 32, height: 32, fontSize: 11 }}
                        title={f.role || "Fielder"}
                      >
                        <span
                          className={`badge ${chipClass}`}
                          style={{
                            width: 32,
                            height: 32,
                            lineHeight: "20px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "50%",
                          }}
                        >
                          {f.label}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="col-lg-4">
            <div className={`p-3 rounded mb-3 ${cardClass}`}>
              <h6 className="mb-3">{dragFieldersTitle}</h6>
              <div
                className="d-grid"
                style={{
                  gridTemplateColumns: "repeat(3, minmax(0,1fr))",
                  gap: 8,
                }}
              >
                {fielders
                  .filter((f) => f.role === "Fielder")
                  .map((f) => (
                    <Button
                      key={f.id}
                      onPointerDown={(e) => onPointerDown(e, f.id)}
                      variant={
                        f.placed
                          ? isDarkMode
                            ? "outline-light"
                            : "outline-dark"
                          : isDarkMode
                          ? "secondary"
                          : "light"
                      }
                      size="sm"
                      className="fw-semibold"
                      title={dragToPlaceHint}
                    >
                      {f.label}
                    </Button>
                  ))}
              </div>
            </div>

            <div className={`p-3 rounded ${cardClass}`}>
              <h6 className="mb-3">{softRuleChecksTitle}</h6>
              <ul className="list-unstyled mb-0">
                {warnings.map((w) => (
                  <li
                    key={w.id}
                    className="d-flex align-items-start mb-2"
                  >
                    <span
                      className={`badge me-2 ${
                        w.ok ? "bg-success" : "bg-danger"
                      }`}
                      style={{ width: 22 }}
                    >
                      {w.ok ? "✓" : "!"}
                    </span>
                    <span>{w.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          {t("close") !== "close" ? t("close") : "Close"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
