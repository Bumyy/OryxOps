// ─────────────────────────────────────────────
//  WindGaugeBars
//  Three SVG half-circle arc gauges displayed in
//  a row below the runway diagram:
//
//    [ HEADWIND ]  [ CROSSWIND ]  [ GUST ]
//
//  Each gauge is a 160×96 SVG with:
//    • Dark arc track (background)
//    • Colour-coded arc fill that animates via
//      CSS transition on stroke-dashoffset
//    • Large numeric value centred below the arc
//    • Unit label "KT"
//    • Gauge name label below the value
//    • Warning pulse when limits are exceeded
//
//  Scales:
//    Headwind  max 40 kt  (green)  / red when tailwind
//    Crosswind max 30 kt  (amber)  / pulse > 20 kt
//    Gust      max 50 kt  (red)
// ─────────────────────────────────────────────
import React from "react";
import {
  COLORS,
  GAUGE_MAX_HEADWIND,
  GAUGE_MAX_CROSSWIND,
  GAUGE_MAX_GUST,
} from "./constants";

// ─── Arc geometry constants ───────────────────

// SVG viewBox per gauge — scaled up from 120x72 so gauges read clearly
// even when the card is rendered at moderate width.
const GW = 160;
const GH = 96;

// Arc parameters — half-circle opening downward
const ARC_CX     = GW / 2;  // 80
const ARC_CY     = GH - 10; // 86  (arc centre near bottom)
const ARC_R      = 58;       // arc radius (was 46)
const STROKE_W   = 10;       // track + fill stroke width (was 7)

// Half-circle: from 180° to 0° (left to right, opening upward)
const CIRC       = 2 * Math.PI * ARC_R;
const ARC_LEN    = CIRC / 2;  // half-circle arc length

// ─── Types ────────────────────────────────────

interface WindGaugeBarsProps {
  headwindKt:  number;   // positive = headwind, negative = tailwind
  crosswindKt: number;   // magnitude only (abs value)
  gustKt:      number | null;
  isTailwind:  boolean;
}

// ─── Single gauge helper ──────────────────────

interface GaugeProps {
  label:     string;
  value:     number;       // displayed value (kt, already abs)
  maxKt:     number;
  color:     string;       // arc fill colour
  warning?:  boolean;      // applies pulse effect
  prefix?:   string;       // e.g. "TW" badge text
  dim?:      boolean;      // greyed out when no data
}

function ArcGauge({
  label,
  value,
  maxKt,
  color,
  warning = false,
  prefix,
  dim = false,
}: GaugeProps) {
  const fraction   = Math.min(1, value / maxKt);
  const fillLen    = fraction * ARC_LEN;
  const dashArray  = `${fillLen.toFixed(2)} ${(CIRC + 4).toFixed(2)}`;
  const dashOffset = "0";

  // Arc path: half-circle from left (180°) to right (0°), sweeping upward
  const startX = ARC_CX - ARC_R;
  const startY = ARC_CY;
  const endX   = ARC_CX + ARC_R;
  const endY   = ARC_CY;
  const arcPath = `M ${startX},${startY} A ${ARC_R},${ARC_R} 0 0,1 ${endX},${endY}`;

  const valueDisplay = value === 0 ? "0" : value.toString();

  return (
    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
      <svg
        viewBox={`0 0 ${GW} ${GH}`}
        className="w-full"
        style={{ maxWidth: 160 }}
        aria-label={`${label} gauge: ${value} knots`}
      >
        {/* ── Track arc (background) ────────── */}
        <path
          d={arcPath}
          fill="none"
          stroke={COLORS.gaugeTrack}
          strokeWidth={STROKE_W}
          strokeLinecap="round"
        />

        {/* ── Fill arc ─────────────────────── */}
        <path
          d={arcPath}
          fill="none"
          stroke={dim ? "rgba(100,120,150,0.3)" : color}
          strokeWidth={STROKE_W}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
          opacity={dim ? 0.4 : 1}
          style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)" }}
        />

        {/* ── Tick marks at 25%, 50%, 75% ── */}
        {[0.25, 0.5, 0.75].map((frac) => {
          const θ   = Math.PI - frac * Math.PI;
          const ix  = ARC_CX + ARC_R * Math.cos(θ);
          const iy  = ARC_CY - ARC_R * Math.sin(θ);
          const ox  = ARC_CX + (ARC_R + 7) * Math.cos(θ);
          const oy  = ARC_CY - (ARC_R + 7) * Math.sin(θ);
          return (
            <line
              key={frac}
              x1={ix.toFixed(1)} y1={iy.toFixed(1)}
              x2={ox.toFixed(1)} y2={oy.toFixed(1)}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1.5"
            />
          );
        })}

        {/* ── Value text ───────────────────── */}
        <text
          x={ARC_CX}
          y={ARC_CY - 20}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={dim ? "rgba(150,170,200,0.5)" : (warning ? color : "rgba(220,235,255,0.95)")}
          fontSize="27"
          fontWeight="bold"
          fontFamily="monospace"
          className={warning ? "animate-pulse" : ""}
        >
          {valueDisplay}
        </text>

        {/* ── KT unit ──────────────────────── */}
        <text
          x={ARC_CX}
          y={ARC_CY - 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(148,163,184,0.75)"
          fontSize="9.5"
          fontWeight="bold"
          fontFamily="monospace"
          letterSpacing="0.5"
        >
          KT
        </text>

        {/* ── Optional prefix badge (e.g. TW) ─ */}
        {prefix && (
          <>
            <rect
              x={ARC_CX + 20} y={ARC_CY - 38}
              width="26"       height="14"
              rx="3.5"
              fill="rgba(239,68,68,0.22)"
              stroke="rgba(239,68,68,0.55)"
              strokeWidth="0.8"
            />
            <text
              x={ARC_CX + 33} y={ARC_CY - 31}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={COLORS.tailwind}
              fontSize="8.5"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {prefix}
            </text>
          </>
        )}
      </svg>

      {/* ── Label ────────────────────────────── */}
      <span
        className={`text-[12px] font-bold tracking-widest uppercase mt-0.5 ${
          warning ? "animate-pulse" : ""
        }`}
        style={{ color: warning ? color : "rgba(148,163,184,0.8)" }}
      >
        {label}
      </span>

      {/* ── Warning tag ─────────────────────── */}
      {warning && (
        <span
          className="text-[10px] font-bold mt-0.5 animate-pulse"
          style={{ color }}
        >
          ⚠ LIMIT
        </span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────

export const WindGaugeBars = React.memo(function WindGaugeBars({
  headwindKt,
  crosswindKt,
  gustKt,
  isTailwind,
}: WindGaugeBarsProps) {
  const hwAbs = Math.abs(headwindKt);
  const cwAbs = Math.abs(crosswindKt);
  const gust  = gustKt ?? 0;

  const tailwindWarning  = isTailwind && hwAbs > 10;
  const crosswindWarning = cwAbs > 20;

  const hwColor = isTailwind ? COLORS.gaugeTailwind : COLORS.gaugeHeadwind;

  return (
    <div
      className="flex items-end gap-4 px-4 py-4"
      style={{ background: "rgba(10,15,26,0.85)", borderTop: "1px solid rgba(51,65,85,0.35)" }}
    >
      {/* Headwind / Tailwind */}
      <ArcGauge
        label={isTailwind ? "Tailwind" : "Headwind"}
        value={hwAbs}
        maxKt={GAUGE_MAX_HEADWIND}
        color={hwColor}
        warning={tailwindWarning}
        prefix={isTailwind ? "TW" : undefined}
      />

      {/* Divider */}
      <div className="w-px self-stretch" style={{ background: "rgba(51,65,85,0.5)" }} />

      {/* Crosswind */}
      <ArcGauge
        label="Crosswind"
        value={cwAbs}
        maxKt={GAUGE_MAX_CROSSWIND}
        color={COLORS.gaugeCrosswind}
        warning={crosswindWarning}
      />

      {/* Divider */}
      <div className="w-px self-stretch" style={{ background: "rgba(51,65,85,0.5)" }} />

      {/* Gust */}
      <ArcGauge
        label="Gust"
        value={gust}
        maxKt={GAUGE_MAX_GUST}
        color={COLORS.gaugeGust}
        warning={gust > 35}
        dim={gust === 0}
      />
    </div>
  );
});