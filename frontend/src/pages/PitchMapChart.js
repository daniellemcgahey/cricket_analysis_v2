import React, { useRef, useEffect, useState, useMemo } from "react";
import simpleheat from "simpleheat";
import api from "../api";

/** ================== Config / Constants ================== */

const PITCH_Y_MULTIPLIER = 1.0;

const BOWLER_DISMISSALS = [
  "Bowled",
  "Caught",
  "LBW",
  "Stumped",
  "Hit Wicket",
  "bowled",
  "caught",
  "lbw",
  "stumped",
  "hit wicket",
];

const createZones = () => [
  {
    label: "Full Toss",
    start: -1,
    end: 0.4,
    color: "#f97373", // soft red
    balls: 0,
    runs: 0,
    wickets: 0,
  },
  {
    label: "Yorker",
    start: 0.4,
    end: 1.8,
    color: "#facc6b", // warm yellow
    balls: 0,
    runs: 0,
    wickets: 0,
  },
  {
    label: "Full",
    start: 1.8,
    end: 3.5,
    color: "#4ade80", // green
    balls: 0,
    runs: 0,
    wickets: 0,
  },
  {
    label: "Good",
    start: 3.5,
    end: 6.0,
    color: "#38bdf8", // blue
    balls: 0,
    runs: 0,
    wickets: 0,
  },
  {
    label: "Short",
    start: 6.0,
    end: 10.0,
    color: "#a78bfa", // purple
    balls: 0,
    runs: 0,
    wickets: 0,
  },
];

/**
 * Perspective projection: squeeze X width as we go up the pitch
 */
const projectPoint = (
  x,
  y,
  canvasWidth,
  canvasHeight,
  topW,
  bottomW,
  paddingTop
) => {
  const t = (y - paddingTop) / (canvasHeight - paddingTop);
  const width = topW + (bottomW - topW) * t;
  const centerX = canvasWidth / 2;
  const projectedX = centerX + (x - centerX) * (width / bottomW);
  return [projectedX, y];
};

/** ================== Component ================== */

const PitchMapChart = ({
  data,
  viewMode,
  selectedBallId = null,
  innerRef = null,
  setProjectedBalls = () => {},
  compact = false,
  hideLegend = false,
  disableUpload = false,
}) => {
  const fallbackCanvasRef = useRef();
  const canvasRef = innerRef ? innerRef : fallbackCanvasRef;

  const [activeTypes, setActiveTypes] = useState([
    "0s",
    "1s",
    "2s",
    "3s",
    "4s",
    "5s",
    "6s",
    "Wides",
    "No Balls",
    "Wicket",
  ]);

  const filteredData = useMemo(() => {
    if (!Array.isArray(data)) return [];

    return data.filter((ball) => {
      const isWide = (ball.wides || 0) > 0;
      const isNoBall = (ball.no_balls || 0) > 0;
      const isWicket =
        ball.dismissal_type !== null &&
        ball.dismissal_type !== undefined &&
        String(ball.dismissal_type).trim() !== "";

      const runKey = `${ball.runs}s`;

      // 👉 If this ball is an extra or wicket, decide visibility *only*
      // from those toggles (don’t let it fall back to run filters).
      if (isWide || isNoBall || isWicket) {
        let show = false;

        if (isWide && activeTypes.includes("Wides")) show = true;
        if (isNoBall && activeTypes.includes("No Balls")) show = true;
        if (isWicket && activeTypes.includes("Wicket")) show = true;

        return show;
      }

      // 👉 Normal ball (no extras, no wicket) – use run filters only
      return activeTypes.includes(runKey);
    });
  }, [data, activeTypes]);


  /** ---------- Drawing helpers ---------- */

const drawZoneLabels = (ctx, width, height, zones) => {
  const visibleLength = 10.0;
  const paddingTop = height * 0.2;
  const topW = width * 0.7;
  const bottomW = width * 1.02;
  const centerX = width / 2;

  const metersToY = (m) =>
    paddingTop + (m / visibleLength) * (height - paddingTop);

  zones.forEach((zone) => {
    const y1 = metersToY(zone.start);
    const y2 = metersToY(zone.end);
    const t = (y1 - paddingTop) / (height - paddingTop);
    const w = topW + (bottomW - topW) * t;

    // 👇 raw X just to the LEFT of the pitch strip
    const rawLabelX = centerX - w / 2 - 12;

    // clamp so it never goes off-canvas
    const labelX = Math.max(10, rawLabelX);
    const labelY = (y1 + y2) / 2;

    ctx.save();
    ctx.font = "500 9px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

    const textLines = [
      zone.label,
      `${zone.runs} (${zone.balls})`,
      `${zone.wickets} wicket${zone.wickets === 1 ? "" : "s"}`,
    ];

    const maxWidth = Math.max(
      ...textLines.map((line) => ctx.measureText(line).width)
    );
    const paddingX = 6;
    const paddingY = 2;
    const lineHeight = 10;
    const pillHeight = 3 * lineHeight + paddingY * 2;

    // Background pill (dark in both modes)
    ctx.fillStyle = "rgba(15,23,42,0.92)";
    ctx.beginPath();
    ctx.roundRect(
      labelX - paddingX,
      labelY - pillHeight / 2,
      maxWidth + paddingX * 2,
      pillHeight,
      8
    );
    ctx.fill();

    ctx.fillStyle = "#e5e7eb";
    ctx.textBaseline = "middle";
    ctx.fillText(textLines[0], labelX, labelY - lineHeight);
    ctx.fillText(textLines[1], labelX, labelY);
    ctx.fillText(textLines[2], labelX, labelY + lineHeight);

    ctx.restore();
  });
};


  const drawPitch = (ctx, width, height, zones) => {
    const visibleLength = 11.0;
    const paddingTop = height * 0.22;
    const topW = width * 0.6;
    const bottomW = width * 1.02;
    const centerX = width / 2;

    const metersToY = (m) =>
      paddingTop + (m / visibleLength) * (height - paddingTop);

    /** ---- Background outfield ---- */
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, "#020617");
    bgGradient.addColorStop(1, "#0f172a");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    /** ---- Pitch block ---- */
    const pitchTopY = paddingTop;
    const pitchBottomY = height;

    const tTop = (pitchTopY - paddingTop) / (height - paddingTop);
    const tBottom = (pitchBottomY - paddingTop) / (height - paddingTop);
    const pitchTopWidth = topW + (bottomW - topW) * tTop;
    const pitchBottomWidth = topW + (bottomW - topW) * tBottom;
    const pitchLeftTop = centerX - pitchTopWidth / 2;
    const pitchRightTop = centerX + pitchTopWidth / 2;
    const pitchLeftBottom = centerX - pitchBottomWidth / 2;
    const pitchRightBottom = centerX + pitchBottomWidth / 2;

    ctx.beginPath();
    ctx.moveTo(pitchLeftTop, pitchTopY);
    ctx.lineTo(pitchRightTop, pitchTopY);
    ctx.lineTo(pitchRightBottom, pitchBottomY);
    ctx.lineTo(pitchLeftBottom, pitchBottomY);
    ctx.closePath();

    const pitchGradient = ctx.createLinearGradient(
      0,
      pitchTopY,
      0,
      pitchBottomY
    );
    pitchGradient.addColorStop(0, "#f5e3c1");
    pitchGradient.addColorStop(1, "#d2b48c");
    ctx.fillStyle = pitchGradient;
    ctx.fill();

    /** ---- Highlight "corridor" centre line ---- */
    const drawProjectedRectangle = (
      startM,
      endM,
      widthRatio = 0.4,
      color = "#2563eb",
      alpha = 0.18
    ) => {
      const y1 = metersToY(startM);
      const y2 = metersToY(endM);

      const t1 = (y1 - paddingTop) / (height - paddingTop);
      const t2 = (y2 - paddingTop) / (height - paddingTop);

      const w1 = topW + (bottomW - topW) * t1;
      const w2 = topW + (bottomW - topW) * t2;

      const rectW1 = w1 * widthRatio;
      const rectW2 = w2 * widthRatio;

      const left1 = centerX - rectW1 / 2;
      const right1 = centerX + rectW1 / 2;
      const left2 = centerX - rectW2 / 2;
      const right2 = centerX + rectW2 / 2;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(left1, y1);
      ctx.lineTo(right1, y1);
      ctx.lineTo(right2, y2);
      ctx.lineTo(left2, y2);
      ctx.closePath();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    };

    drawProjectedRectangle(0, 11, 0.18, "#0ea5e9", 0.12);

    /** ---- Zone strips ---- */
    const drawProjectedQuad = (yStart, yEnd, color) => {
      const tStart = (yStart - paddingTop) / (height - paddingTop);
      const tEnd = (yEnd - paddingTop) / (height - paddingTop);

      const wStart = topW + (bottomW - topW) * tStart;
      const wEnd = topW + (bottomW - topW) * tEnd;

      const left1 = centerX - wStart / 2;
      const right1 = centerX + wStart / 2;
      const left2 = centerX - wEnd / 2;
      const right2 = centerX + wEnd / 2;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(left1, yStart);
      ctx.lineTo(right1, yStart);
      ctx.lineTo(right2, yEnd);
      ctx.lineTo(left2, yEnd);
      ctx.closePath();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    };

    zones.forEach((zone) => {
      const y1 = metersToY(zone.start);
      const y2 = metersToY(zone.end);
      drawProjectedQuad(y1, y2, zone.color);
    });

    /** ---- Creases & markers ---- */
    const drawMeterMarkers = () => {
      ctx.save();
      ctx.strokeStyle = "rgba(15,23,42,0.7)";
      ctx.fillStyle = "rgba(148,163,184,0.9)";
      ctx.font = "11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.lineWidth = 1;

      for (let m = 0; m <= 10; m += 2) {
        const y = metersToY(m);
        const t = (y - paddingTop) / (height - paddingTop);
        const w = topW + (bottomW - topW) * t;

        const xTick = centerX + w / 2;
        const xLabel = xTick + 6;

        ctx.beginPath();
        ctx.moveTo(xTick, y);
        ctx.lineTo(xTick + 6, y);
        ctx.stroke();

        ctx.fillText(`${m}m`, xLabel, y + 3);
      }
      ctx.restore();
    };

    const drawCreases = () => {
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;

      const bowlingY = metersToY(0);
      const poppingY = metersToY(1.22);

      const projectXOffset = (offset, y) => {
        const t = (y - paddingTop) / (height - paddingTop);
        const w = topW + (bottomW - topW) * t;
        return offset * (w / 2);
      };

      // Bowling crease
      const bowlingLeft = centerX + projectXOffset(-1, bowlingY);
      const bowlingRight = centerX + projectXOffset(1, bowlingY);
      ctx.beginPath();
      ctx.moveTo(bowlingLeft, bowlingY);
      ctx.lineTo(bowlingRight, bowlingY);
      ctx.stroke();

      // Popping crease
      const poppingLeft = centerX + projectXOffset(-1, poppingY);
      const poppingRight = centerX + projectXOffset(1, poppingY);
      ctx.beginPath();
      ctx.moveTo(poppingLeft, poppingY);
      ctx.lineTo(poppingRight, poppingY);
      ctx.stroke();

      // Return creases
      const returnOffset = 1;
      [-1, 1].forEach((dir) => {
        const xStart = centerX + projectXOffset(dir * returnOffset, poppingY);
        const yStart = poppingY;
        const yEnd = poppingY - 50;
        const xEnd = centerX + projectXOffset(dir * returnOffset, yEnd);

        ctx.beginPath();
        ctx.moveTo(xStart, yStart);
        ctx.lineTo(xEnd, yEnd);
        ctx.stroke();
      });

      // Wider guidelines (rough wide guidelines)
      const wideOffset = 0.72;
      [-1, 1].forEach((dir) => {
        const xStart = centerX + projectXOffset(dir * wideOffset, bowlingY);
        const yStart = bowlingY;
        const yEnd = bowlingY + 15;
        const xEnd = centerX + projectXOffset(dir * wideOffset, yEnd);

        ctx.beginPath();
        ctx.moveTo(xStart, yStart);
        ctx.lineTo(xEnd, yEnd);
        ctx.stroke();
      });

      ctx.restore();

      // Stumps
      const creaseY = metersToY(0);
      const stumpSpacing = topW / 18;
      ctx.save();
      ctx.lineWidth = 5;
      for (let i = -1; i <= 1; i++) {
        const x = centerX + i * stumpSpacing;
        const y1 = creaseY;
        const y2 = creaseY - 60;

        ctx.beginPath();
        ctx.strokeStyle = "#ffffffff";
        ctx.fillStyle = "#0ea5e9";
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();
      }
      ctx.restore();
    };

    drawCreases();
    drawMeterMarkers();
  };

  const drawBalls = (ctx, canvasWidth, canvasHeight, balls, zones) => {
    const visibleLength = 11.0;
    const paddingTop = canvasHeight * 0.22;
    const topW = canvasWidth * 0.6;
    const bottomW = canvasWidth * 1.02;
    const centerX = canvasWidth / 2;

    const metersToY = (m) =>
      paddingTop + (m / visibleLength) * (canvasHeight - paddingTop);

    const newProjectedBalls = [];

    balls.forEach((ball) => {
      const { pitch_x, pitch_y, runs, wides, no_balls, dismissal_type } = ball;

      const adjustedY = pitch_y * PITCH_Y_MULTIPLIER;
      const extraRuns = (wides || 0) + (no_balls || 0);

      zones.forEach((zone) => {
        if (
          adjustedY * visibleLength >= zone.start &&
          adjustedY * visibleLength < zone.end
        ) {
          zone.balls += 1;
          zone.runs += runs + extraRuns;
          if (BOWLER_DISMISSALS.includes(dismissal_type)) {
            zone.wickets += 1;
          }
        }
      });

      const isWide = wides > 0;
      const isNoBall = no_balls > 0;

      let color = "#020617";

      if (ball.ball_id === selectedBallId) {
        color = "#d946ef"; // selected
      } else if (BOWLER_DISMISSALS.includes(dismissal_type)) {
        color = "#fef08a"; // wicket
      } else if (isWide) {
        color = "#facc15"; // wides
      } else if (isNoBall) {
        color = "#fb923c"; // no balls
      } else if (runs === 0) {
        color = "#f97373"; // dot ball
      } else if (runs === 1) {
        color = "#22c55e"; // 1 – green
      } else if (runs === 2) {
        color = "#0ea5e9"; // 2 – cyan
      } else if (runs === 3) {
        color = "#f97316"; // 3 – orange
      } else if (runs == 4) {
        color = "#e70ccdff"; // 4+ – blue
      } else if (runs >= 5) {
        color = "#ef4444"; // 4+ – blue
      }

      const metersToCanvasY = metersToY(adjustedY * visibleLength);
      const flatX = centerX + (pitch_x - 0.5) * bottomW;
      const [x, y] = projectPoint(
        flatX,
        metersToCanvasY,
        canvasWidth,
        canvasHeight,
        topW,
        bottomW,
        paddingTop
      );

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, ball.ball_id === selectedBallId ? 7 : 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(15,23,42,0.9)";
      ctx.stroke();
      ctx.restore();

      newProjectedBalls.push({ x, y });
    });

    setProjectedBalls(newProjectedBalls);
  };

  const updateZoneStats = (balls, zones) => {
    const visibleLength = 11.0;

    balls.forEach((ball) => {
      const { pitch_y, runs, wides, no_balls, dismissal_type } = ball;
      const adjustedY = pitch_y * PITCH_Y_MULTIPLIER;
      const extraRuns = (wides || 0) + (no_balls || 0);

      zones.forEach((zone) => {
        if (
          adjustedY * visibleLength >= zone.start &&
          adjustedY * visibleLength < zone.end
        ) {
          zone.balls += 1;
          zone.runs += runs + extraRuns;

          if (BOWLER_DISMISSALS.includes(dismissal_type)) {
            zone.wickets += 1;
          }
        }
      });
    });
  };

  const drawHeatMap = (ctx, canvasWidth, canvasHeight, balls) => {
    const visibleLength = 11.0;
    const paddingTop = canvasHeight * 0.22;
    const topW = canvasWidth * 0.6;
    const bottomW = canvasWidth * 1.02;
    const centerX = canvasWidth / 2;

    const metersToY = (m) =>
      paddingTop + (m / visibleLength) * (canvasHeight - paddingTop);

    const heatCanvas = document.createElement("canvas");
    heatCanvas.width = canvasWidth;
    heatCanvas.height = canvasHeight;
    const heatCtx = heatCanvas.getContext("2d");

    const heat = simpleheat(heatCanvas);

    const heatPoints = balls.map((ball) => {
      const adjustedY = ball.pitch_y * PITCH_Y_MULTIPLIER;
      const flatX = centerX + (ball.pitch_x - 0.5) * bottomW;
      const flatY = metersToY(adjustedY * visibleLength);
      const [x, y] = projectPoint(
        flatX,
        flatY,
        canvasWidth,
        canvasHeight,
        topW,
        bottomW,
        paddingTop
      );
      return [x, y, 1];
    });

    heat.data(heatPoints);
    heat.radius(24, 28);
    heat.max(10);
    heat.draw(0.35);

    ctx.drawImage(heatCanvas, 0, 0);
  };

  /** ---------- Effect: draw / resize ---------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const resizeAndDraw = () => {
      const zones = createZones();

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.offsetWidth || (compact ? 320 : 600);
      const height = canvas.offsetHeight || (compact ? 320 : 600);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, width, height);

      drawPitch(ctx, width, height, zones);

      if (filteredData.length) {
        if (viewMode === "Heat") {
          setProjectedBalls([]);
          updateZoneStats(filteredData, zones);
          drawHeatMap(ctx, width, height, filteredData);
        } else {
          drawBalls(ctx, width, height, filteredData, zones);
        }
      } else {
        setProjectedBalls([]);
      }

      drawZoneLabels(ctx, width, height, zones);

      if (!disableUpload) {
        try {
          const imageData = canvas.toDataURL("image/png");
          api
            .post("/api/upload-pitch-map", {
              image: imageData,
              type: "pitch_map",
            })
            .then((res) => {
              console.log("✅ Pitch map image uploaded automatically:", res.data);
            })
            .catch((err) => {
              console.error("❌ Error uploading pitch map image:", err);
            });
        } catch (e) {
          console.error("❌ Error generating pitch map image:", e);
        }
      }
    };

    resizeAndDraw();
    window.addEventListener("resize", resizeAndDraw);
    return () => window.removeEventListener("resize", resizeAndDraw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, viewMode, selectedBallId, compact]);

  if (!Array.isArray(data)) return null;

  const size = compact ? 320 : 600;

    return (
    <div>
      {/* Canvas wrapper */}
      <div
        style={{
          maxWidth: `${size}px`,
          width: "100%",
          height: `${size}px`,
          margin: "0 auto",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "18px",
            background: "transparent",
            boxShadow: "0 14px 32px rgba(0,0,0,0.45)",
          }}
        />
      </div>

      {/* Run / extras legend (optional) */}
      {!hideLegend && (
        <div
          style={{
            marginTop: "10px",
            textAlign: "center",
            fontSize: "13px",
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          {[
            { label: "0s",  color: "#f97373" },
            { label: "1s",  color: "#22c55e" },
            { label: "2s",  color: "#0ea5e9" },
            { label: "3s",  color: "#f97316" },
            { label: "4s",  color: "#e013c5ff" },
            { label: "5s",  color: "#a855f7" },
            { label: "6s",  color: "#ef4444" },
            { label: "Wides",    color: "#facc15" },
            { label: "No Balls", color: "#fb923c" },
            { label: "Wicket",   color: "#fef08a" },
          ].map(({ label, color }) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                setActiveTypes((prev) =>
                  prev.includes(label)
                    ? prev.filter((t) => t !== label)
                    : [...prev, label]
                )
              }
              style={{
                cursor: "pointer",
                opacity: activeTypes.includes(label) ? 1 : 0.4,
                padding: "3px 9px",
                borderRadius: "999px",
                border:
                  "1px solid var(--color-border-subtle, rgba(148,163,184,0.6))",
                background:
                  activeTypes.includes(label)
                    ? color
                    : "rgba(15,23,42,0.9)",
                color: activeTypes.includes(label) ? "#020617" : "#e5e7eb",
                fontWeight: 600,
                lineHeight: 1.1,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

};

export default PitchMapChart;
