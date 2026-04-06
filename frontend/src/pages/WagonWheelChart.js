import React, { useEffect, useRef, useState, useMemo } from "react";
import api from "../api";

/** ================== Color helpers ================== */

const runToColor = (runs) => {
  switch (runs) {
    case 0:
      return "#64748b";      // dot – slate
    case 1:
      return "#22c55e";      // 1 – bright green
    case 2:
      return "#0ea5e9";      // 2 – cyan / light blue
    case 3:
      return "#f97316";      // 3 – orange
    case 4:
      return "#e013c5ff";    // 4 – your custom colour
    case 5:
      return "#a855f7";      // 5 – purple
    case 6:
      return "#ef4444";      // 6 – red
    default:
      return "#facc15";      // misc – yellow
  }
};

const WAGON_LEGEND = ["0", "1", "2", "3", "4", "5", "6", "Wicket"];

/** ================== Component ================== */

const WagonWheelChart = ({
  data,
  perspective,
  compact = false,
  hideLegend = false,
  disableUpload = false,
}) => {
  const canvasRef = useRef(null);
  const [activeTypes, setActiveTypes] = useState(WAGON_LEGEND);

  const filteredData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.filter((ball) => {
      const type = ball.dismissal_type ? "Wicket" : String(ball.runs ?? 0);
      return activeTypes.includes(type);
    });
  }, [data, activeTypes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const size = rect.width || (compact ? 320 : 500);

      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const width = size;
      const height = size;

      // Clear
      ctx.clearRect(0, 0, width, height);

      // 🔒 Always-dark background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, "#020617");
      bgGradient.addColorStop(1, "#0b1120");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const outerRadius = Math.min(cx, cy) * 0.96;
      const innerRadius = outerRadius * 0.55;

      /** ---- Outfield ---- */
      const fieldGradient = ctx.createRadialGradient(
        cx,
        cy,
        innerRadius * 0.4,
        cx,
        cy,
        outerRadius
      );
      fieldGradient.addColorStop(0, "#14532d");
      fieldGradient.addColorStop(1, "#052e16");
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, 0, 2 * Math.PI);
      ctx.fillStyle = fieldGradient;
      ctx.fill();

      // Inner circle
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, 0, 2 * Math.PI);
      ctx.fillStyle = "#16a34a";
      ctx.fill();

      // Boundary rope
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius - 10, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(248,250,252,0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(226,232,240,0.95)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      /** ---- Pitch ---- */
      const pitchWidth = outerRadius * 0.12;
      const pitchLength = outerRadius * 0.42;
      const pitchTop = cy - pitchLength / 2;

      ctx.fillStyle = "#f5e3c1";
      ctx.fillRect(cx - pitchWidth / 2, pitchTop, pitchWidth, pitchLength);

      // Popping creases
      ctx.strokeStyle = "rgba(241,245,249,0.98)";
      ctx.lineWidth = 2;
      const creaseLength = pitchWidth * 1.3;
      const poppingOffset = pitchLength * 0.22;

      ctx.beginPath();
      ctx.moveTo(cx - creaseLength / 2, pitchTop + poppingOffset);
      ctx.lineTo(cx + creaseLength / 2, pitchTop + poppingOffset);
      ctx.moveTo(
        cx - creaseLength / 2,
        pitchTop + pitchLength - poppingOffset
      );
      ctx.lineTo(
        cx + creaseLength / 2,
        pitchTop + pitchLength - poppingOffset
      );
      ctx.stroke();

      // Bowling creases (dashed)
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - pitchWidth / 2, pitchTop);
      ctx.lineTo(cx + pitchWidth / 2, pitchTop);
      ctx.moveTo(cx - pitchWidth / 2, pitchTop + pitchLength);
      ctx.lineTo(cx + pitchWidth / 2, pitchTop + pitchLength);
      ctx.stroke();
      ctx.setLineDash([]);

      // Return creases
      const returnOffset = pitchWidth / 2 - 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - returnOffset, pitchTop);
      ctx.lineTo(cx - returnOffset, pitchTop + poppingOffset);
      ctx.moveTo(cx + returnOffset, pitchTop);
      ctx.lineTo(cx + returnOffset, pitchTop + poppingOffset);
      ctx.moveTo(cx - returnOffset, pitchTop + pitchLength);
      ctx.lineTo(
        cx - returnOffset,
        pitchTop + pitchLength - poppingOffset
      );
      ctx.moveTo(cx + returnOffset, pitchTop + pitchLength);
      ctx.lineTo(
        cx + returnOffset,
        pitchTop + pitchLength - poppingOffset
      );
      ctx.stroke();

      const batOriginX = cx;
      const batOriginY = pitchTop + pitchLength * 0.35; // slightly in front of popping crease
      const boundaryRadius = outerRadius - 10;

      /** ---------- Lines perspective ---------- */
      if (perspective === "Lines") {
        // Base shots
        filteredData.forEach(({ x, y, runs, highlight }) => {
          if (highlight) return;
          const endX = cx + x * boundaryRadius;
          const endY = cy + y * boundaryRadius;

          ctx.beginPath();
          ctx.moveTo(batOriginX, batOriginY);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = runToColor(runs);
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.95;
          ctx.stroke();
        });

        // Highlighted shots on top
        filteredData.forEach(({ x, y, runs, highlight }) => {
          if (!highlight) return;
          const endX = cx + x * boundaryRadius;
          const endY = cy + y * boundaryRadius;

          ctx.beginPath();
          ctx.moveTo(batOriginX, batOriginY);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = "#e879f9";
          ctx.lineWidth = 3;
          ctx.globalAlpha = 1;
          ctx.stroke();
        });

        // Batter dot
        ctx.beginPath();
        ctx.arc(batOriginX, batOriginY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#020617";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(248,250,252,0.9)";
        ctx.stroke();
      }

      /** ---------- Zones perspective ---------- */
      if (perspective === "Zones") {
        const zones = [
          { label: "Mid Wicket", start: 0, end: 45 },
          { label: "Mid On", start: 45, end: 90 },
          { label: "Mid Off", start: 90, end: 135 },
          { label: "Cover", start: 135, end: 180 },
          { label: "Backward Point", start: -180, end: -135 },
          { label: "Third", start: -135, end: -90 },
          { label: "Fine Leg", start: -90, end: -45 },
          { label: "Backward Square", start: -45, end: 0 },
        ];

        const zoneColors = {
          Cover: "#22c55e",
          "Mid Off": "#0ea5e9",
          "Mid On": "#f97316",
          "Fine Leg": "#6366f1",
          "Backward Point": "#f97373",
          Third: "#facc15",
          "Mid Wicket": "#4ade80",
          "Backward Square": "#a855f7",
        };

        const normalize = (angle) => {
          if (angle < -180) return angle + 360;
          if (angle > 180) return angle - 360;
          return angle;
        };

        const findZone = (angle) => {
          for (const zone of zones) {
            const { start, end } = zone;
            if (start > end) {
              if (angle >= start || angle < end) return zone;
            } else {
              if (angle >= start && angle < end) return zone;
            }
          }
          return null;
        };

        const getIntersectionWithBoundary = (
          angleRad,
          originX,
          originY,
          cx0,
          cy0,
          r
        ) => {
          const dx = Math.cos(angleRad);
          const dy = Math.sin(angleRad);
          const a = dx * dx + dy * dy;
          const b =
            2 * (dx * (originX - cx0) + dy * (originY - cy0));
          const c =
            (originX - cx0) ** 2 + (originY - cy0) ** 2 - r ** 2;
          const disc = b * b - 4 * a * c;
          if (disc < 0) return null;
          const t = (-b + Math.sqrt(disc)) / (2 * a);
          return {
            x: originX + t * dx,
            y: originY + t * dy,
          };
        };

        const zoneStats = {};
        for (const { label } of zones) {
          zoneStats[label] = { runs: 0, balls: 0 };
        }

        filteredData.forEach(({ x, y, runs }) => {
          const angle = normalize((Math.atan2(y, x) * 180) / Math.PI);
          const zone = findZone(angle);
          if (zone && zoneStats[zone.label]) {
            zoneStats[zone.label].runs += runs;
            zoneStats[zone.label].balls += 1;
          }
        });

        zones.forEach(({ label, start, end }) => {
          const startRad = (Math.PI / 180) * start;
          const endRad = (Math.PI / 180) * end;
          const fillColor = zoneColors[label] || "#64748b";

          ctx.save();

          // Shaded wedge
          ctx.beginPath();
          ctx.moveTo(batOriginX, batOriginY);
          const arcSteps = 40;
          for (let i = 0; i <= arcSteps; i++) {
            const angleDeg = start + (i / arcSteps) * (end - start);
            const angleRad = (Math.PI / 180) * angleDeg;
            const pt = getIntersectionWithBoundary(
              angleRad,
              batOriginX,
              batOriginY,
              cx,
              cy,
              boundaryRadius
            );
            if (pt) ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = fillColor;
          ctx.fill();
          ctx.globalAlpha = 1;

          // Divider lines
          const startPt = getIntersectionWithBoundary(
            startRad,
            batOriginX,
            batOriginY,
            cx,
            cy,
            boundaryRadius
          );
          const endPt = getIntersectionWithBoundary(
            endRad,
            batOriginX,
            batOriginY,
            cx,
            cy,
            boundaryRadius
          );

          ctx.beginPath();
          ctx.moveTo(batOriginX, batOriginY);
          if (startPt) ctx.lineTo(startPt.x, startPt.y);
          ctx.moveTo(batOriginX, batOriginY);
          if (endPt) ctx.lineTo(endPt.x, endPt.y);
          ctx.strokeStyle = "rgba(15,23,42,0.9)";
          ctx.lineWidth = 1.1;
          ctx.stroke();

          // Label pill
          const labelRadius = boundaryRadius * 0.7;
          const midAngle = ((start + end) / 2) * (Math.PI / 180);
          const textX = cx + Math.cos(midAngle) * labelRadius;
          const textY = cy + Math.sin(midAngle) * labelRadius;

          const { runs, balls } = zoneStats[label];

          ctx.fillStyle = "rgba(15,23,42,0.9)";
          ctx.font =
            "500 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const line1 = label;
          const line2 = `${runs} (${balls})`;

          const maxW = Math.max(
            ctx.measureText(line1).width,
            ctx.measureText(line2).width
          );
          const paddingX = 6;
          const paddingY = 4;
          const pillHeight = 2 * 13 + paddingY * 2;

          ctx.beginPath();
          ctx.roundRect(
            textX - maxW / 2 - paddingX,
            textY - pillHeight / 2,
            maxW + paddingX * 2,
            pillHeight,
            8
          );
          ctx.fillStyle = "rgba(248,250,252,0.9)";
          ctx.fill();

          ctx.fillStyle = "#0f172a";
          ctx.fillText(line1, textX, textY - 8);
          ctx.fillText(line2, textX, textY + 6);

          ctx.restore();
        });

        // Batter position
        ctx.beginPath();
        ctx.arc(batOriginX, batOriginY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#020617";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(248,250,252,0.9)";
        ctx.stroke();
      }

      // Upload for reports (optional)
      if (!disableUpload) {
        try {
          const imageData = canvas.toDataURL("image/png");
          api
            .post("/api/upload-wagon-wheel", {
              image: imageData,
              type: "wagon_wheel",
            })
            .then((res) => {
              console.log(
                "✅ Wagon wheel image uploaded automatically:",
                res.data
              );
            })
            .catch((err) => {
              console.error("❌ Error uploading wagon wheel image:", err);
            });
        } catch (e) {
          console.error("❌ Error generating wagon wheel image:", e);
        }
      }

    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, perspective, compact]);

  const size = compact ? 320 : 500;

  return (
    <div className="text-center">
      <div
        style={{
          width: "100%",
          maxWidth: `${size}px`,
          margin: "0 auto",
        }}
      >
        <canvas
          id="wagonWheelCanvas"
          ref={canvasRef}
          style={{
            width: "100%",
            height: "auto",
            backgroundColor: "transparent",
            borderRadius: compact ? "16px" : "22px",
            boxShadow: "0 14px 32px rgba(0,0,0,0.45)",
          }}
        />
      </div>

      {/* Legend (optional) */}
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
          {WAGON_LEGEND.map((label) => {
            const color =
              label === "Wicket"
                ? "#fb7185"
                : runToColor(parseInt(label, 10) || 0);
            const isActive = activeTypes.includes(label);

            return (
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
                  opacity: isActive ? 1 : 0.4,
                  padding: "3px 9px",
                  borderRadius: "999px",
                  border:
                    "1px solid var(--color-border-subtle, rgba(148,163,184,0.6))",
                  background: isActive ? color : "rgba(15,23,42,0.9)",
                  color: isActive ? "#020617" : "#e5e7eb",
                  fontWeight: 600,
                  lineHeight: 1.1,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

};

export default WagonWheelChart;
