// ─────────────────────────────────────────────
//  AircraftDiagram
//  Premium aviation EFB style wind visualization.
//  Aircraft silhouette is fixed pointing straight UP.
//  Only the wind arrow and readouts rotate / update.
//
//  SVG-only rendering. Uses a high-fidelity RAF loop
//  to smoothly animate arrow rotation and count numbers.
// ─────────────────────────────────────────────

import React, { useState, useEffect, useRef } from "react";
import { getAircraftSvg } from "./AircraftRegistry";
import { getRunwayHeading, getWindQualityLabel } from "./WindCalculations";
import { COLORS } from "./constants";
import type { AircraftDiagramProps } from "./types";

// Shortest distance compass delta helper
function shortestDelta(from: number, to: number): number {
  let d = to - from;
  while (d < -180) d += 360;
  while (d >  180) d -= 360;
  return d;
}

export const AircraftDiagram = React.memo(function AircraftDiagram({
  rwy,
  vectors,
  windDir,
  windSpeedKt,
  aircraftIcao,
  uid,
}: AircraftDiagramProps) {
  const rwyHeading = getRunwayHeading(rwy);
  const isVariable = vectors.isVariable;

  // ── Target values for animation ─────────────
  const targetAngle = vectors.relativeAngle ?? 0;
  const targetWspd  = windSpeedKt;
  const targetHw    = Math.max(0, vectors.headwind);
  const targetTw    = Math.max(0, -vectors.headwind);
  const targetCw    = Math.abs(vectors.crosswind);

  // ── Animated states ──────────────────────────
  const [angle, setAngle] = useState(targetAngle);
  const [wspd, setWspd]   = useState(targetWspd);
  const [hw, setHw]       = useState(targetHw);
  const [tw, setTw]       = useState(targetTw);
  const [cw, setCw]       = useState(targetCw);

  // Refs to track current animated values inside the loop
  const angleRef = useRef(angle);
  const wspdRef  = useRef(wspd);
  const hwRef    = useRef(hw);
  const twRef    = useRef(tw);
  const cwRef    = useRef(cw);

  useEffect(() => {
    let active = true;
    let frameId = 0;

    function animate() {
      if (!active) return;

      let changed = false;

      // 1. Lerp angle (shortest path)
      const dAngle = shortestDelta(angleRef.current, targetAngle);
      if (Math.abs(dAngle) > 0.05) {
        angleRef.current += dAngle * 0.08;
        angleRef.current = ((angleRef.current % 360) + 360) % 360;
        setAngle(angleRef.current);
        changed = true;
      } else if (angleRef.current !== targetAngle) {
        angleRef.current = targetAngle;
        setAngle(targetAngle);
        changed = true;
      }

      // 2. Lerp Wind Speed
      const dWspd = targetWspd - wspdRef.current;
      if (Math.abs(dWspd) > 0.1) {
        wspdRef.current += dWspd * 0.1;
        setWspd(wspdRef.current);
        changed = true;
      } else if (wspdRef.current !== targetWspd) {
        wspdRef.current = targetWspd;
        setWspd(targetWspd);
        changed = true;
      }

      // 3. Lerp Headwind
      const dHw = targetHw - hwRef.current;
      if (Math.abs(dHw) > 0.1) {
        hwRef.current += dHw * 0.1;
        setHw(hwRef.current);
        changed = true;
      } else if (hwRef.current !== targetHw) {
        hwRef.current = targetHw;
        setHw(targetHw);
        changed = true;
      }

      // 4. Lerp Tailwind
      const dTw = targetTw - twRef.current;
      if (Math.abs(dTw) > 0.1) {
        twRef.current += dTw * 0.1;
        setTw(twRef.current);
        changed = true;
      } else if (twRef.current !== targetTw) {
        twRef.current = targetTw;
        setTw(targetTw);
        changed = true;
      }

      // 5. Lerp Crosswind
      const dCw = targetCw - cwRef.current;
      if (Math.abs(dCw) > 0.1) {
        cwRef.current += dCw * 0.1;
        setCw(cwRef.current);
        changed = true;
      } else if (cwRef.current !== targetCw) {
        cwRef.current = targetCw;
        setCw(targetCw);
        changed = true;
      }

      frameId = requestAnimationFrame(animate);
    }

    frameId = requestAnimationFrame(animate);

    return () => {
      active = false;
      cancelAnimationFrame(frameId);
    };
  }, [targetAngle, targetWspd, targetHw, targetTw, targetCw]);

  // ── Aircraft silhouette retrieval ───────────
  const rawSvg = getAircraftSvg(aircraftIcao);
  const viewBoxMatch = rawSvg.match(/viewBox=["']([^"']+)["']/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 200 200";

  const cleanSvgInner = rawSvg
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>/i, "");

  // Dynamic centering calculations based on the SVG viewBox type
  let svgX = 120;
  let svgY = 145;
  let svgW = 100;
  let svgH = 100;

  const viewBoxParts = viewBox.split(/\s+/).map(Number);
  if (viewBoxParts.length === 4) {
    const [minX, minY, vbW, vbH] = viewBoxParts;
    if (vbW >= 75 && vbW <= 85) {
      // High-fidelity SVGs from RexKramer1 (typically 80x80)
      svgW = 416;
      svgH = 416;
      svgX = -3;
      svgY = -13;
    } else {
      // Legacy SVGs (typically 200x200)
      svgW = 140;
      svgH = 140;
      svgX = 170 - 140 / 2; // 100
      svgY = 195 - 140 / 2; // 125
    }
  }

  // Marker namespace
  const markerId = `arrowhead-${uid}`;

  // Wind quality descriptor (e.g. Nearly Full Headwind)
  const qualityLabel = getWindQualityLabel(vectors.relativeAngle ?? 0, windSpeedKt);

  return (
    <svg
      viewBox="0 0 340 340"
      className="w-full h-full select-none"
      style={{ background: COLORS.bg }}
      aria-label={`Runway ${rwy} wind analysis diagram`}
    >
      <style>
        {`
          .aircraft-silhouette path,
          .aircraft-silhouette polygon,
          .aircraft-silhouette rect,
          .aircraft-silhouette circle {
            fill: none !important;
            stroke: currentColor !important;
            stroke-width: 0.35px !important;
          }
          /* Custom accent layers (like the question mark on unidentified planes) should be filled solid */
          .aircraft-silhouette [id*="Accent"] path,
          .aircraft-silhouette [id*="accent"] path,
          .aircraft-silhouette [id*="layer4"] path,
          .aircraft-silhouette [id*="path1494"] {
            fill: currentColor !important;
            stroke: currentColor !important;
          }
        `}
      </style>

      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={COLORS.windArrow} />
        </marker>
      </defs>

      {/* ── 1. Faint compass ring + runway alignment markings ── */}
      <circle
        cx="170"
        cy="170"
        r="115"
        fill="none"
        stroke={COLORS.compassRing}
        strokeWidth="1.5"
      />
      <circle
        cx="170"
        cy="170"
        r="123"
        fill="none"
        stroke={COLORS.compassRing}
        strokeWidth="0.75"
        strokeDasharray="2,6"
      />

      {/* Cardinal Labels */}
      <text x="170" y="70" textAnchor="middle" fill={COLORS.dimLabel} fontSize="9" fontWeight="bold" fontFamily="monospace">N</text>
      <text x="170" y="278" textAnchor="middle" fill={COLORS.dimLabel} fontSize="9" fontWeight="bold" fontFamily="monospace">S</text>
      <text x="278" y="173" textAnchor="middle" fill={COLORS.dimLabel} fontSize="9" fontWeight="bold" fontFamily="monospace">E</text>
      <text x="62"  y="173" textAnchor="middle" fill={COLORS.dimLabel} fontSize="9" fontWeight="bold" fontFamily="monospace">W</text>

      {/* ── 2. Runway Threshold Graphic ── */}
      <g>
        {/* Runway surface */}
        <rect
          x="150"
          y="40"
          width="40"
          height="70"
          rx="3"
          fill="#1E293B"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="1"
        />
        {/* Runway threshold piano keys */}
        <line x1="154" y1="103" x2="154" y2="108" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="158" y1="103" x2="158" y2="108" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="162" y1="103" x2="162" y2="108" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="178" y1="103" x2="178" y2="108" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="182" y1="103" x2="182" y2="108" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="186" y1="103" x2="186" y2="108" stroke="#FFFFFF" strokeWidth="1.5" />
        {/* Runway centerline */}
        <line
          x1="170"
          y1="90"
          x2="170"
          y2="45"
          stroke="#FFFFFF"
          strokeWidth="1"
          strokeDasharray="3,4"
        />
        {/* Runway designator text */}
        <text
          x="170"
          y="98"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="10"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {rwy}
        </text>
      </g>

      {/* ── 3. Aircraft silhouette (aligned straight up, centered at 170,195) ── */}
      <svg
        x={svgX}
        y={svgY}
        width={svgW}
        height={svgH}
        viewBox={viewBox}
        className="aircraft-silhouette"
        style={{ color: COLORS.aircraft }}
        dangerouslySetInnerHTML={{ __html: cleanSvgInner }}
      />

      {/* ── 4. Wind Arrow Vector (Points to cockpit/nose of airplane, rotated by relative angle around plane center) ── */}
      {!isVariable && windSpeedKt >= 0.5 && (
        <g transform={`rotate(${angle}, 170, 195)`}>
          <line
            x1="170"
            y1="85"
            x2="170"
            y2="155"
            stroke={COLORS.windArrow}
            strokeWidth="3.5"
            strokeLinecap="round"
            markerEnd={`url(#${markerId})`}
          />
          {/* Arrow tail notch for authentic avionics look */}
          <path
            d="M 166 85 L 170 89 L 174 85"
            fill="none"
            stroke={COLORS.windArrow}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* ── 5. Absolute wind readout (Top center) ── */}
      <g transform="translate(170, 32)">
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fill={COLORS.windArrow}
          fontSize="15"
          fontWeight="900"
          fontFamily="monospace"
        >
          {isVariable ? "VRB" : `${String(windDir).padStart(3, "0")}°`} / {Math.round(wspd)} KT
        </text>
        <text
          x="0"
          y="12"
          textAnchor="middle"
          fill={COLORS.dimLabel}
          fontSize="7.5"
          fontWeight="bold"
          letterSpacing="1"
        >
          WIND VECTOR
        </text>
      </g>

      {/* ── 6. Component readout labels (arranged around compass frame) ── */}
      
      {/* LEFT: Headwind */}
      {!isVariable && vectors.headwind >= 0 && (
        <g transform="translate(30, 170)">
          <text
            x="0"
            y="-4"
            textAnchor="start"
            fill={COLORS.headwind}
            fontSize="18"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {Math.round(hw)} <tspan fontSize="9" fontWeight="normal">KT</tspan>
          </text>
          <text
            x="0"
            y="7"
            textAnchor="start"
            fill={COLORS.dimLabel}
            fontSize="8"
            fontWeight="bold"
            letterSpacing="0.5"
          >
            HEADWIND
          </text>
        </g>
      )}

      {/* BOTTOM: Tailwind (only if headwind is negative) */}
      {!isVariable && vectors.headwind < 0 && (
        <g transform="translate(170, 316)">
          <text
            x="0"
            y="-4"
            textAnchor="middle"
            fill={COLORS.tailwind}
            fontSize="18"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {Math.round(tw)} <tspan fontSize="9" fontWeight="normal">KT</tspan>
          </text>
          <text
            x="0"
            y="7"
            textAnchor="middle"
            fill={COLORS.dimLabel}
            fontSize="8"
            fontWeight="bold"
            letterSpacing="0.5"
          >
            TAILWIND
          </text>
        </g>
      )}

      {/* RIGHT: Crosswind */}
      {!isVariable && (
        <g transform="translate(310, 170)">
          <text
            x="0"
            y="-4"
            textAnchor="end"
            fill={COLORS.crosswind}
            fontSize="18"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {Math.round(cw)} <tspan fontSize="9" fontWeight="normal">KT</tspan>
          </text>
          <text
            x="0"
            y="7"
            textAnchor="end"
            fill={COLORS.dimLabel}
            fontSize="8"
            fontWeight="bold"
            letterSpacing="0.5"
          >
            CROSSWIND ({vectors.crosswind < 0 ? "L" : "R"})
          </text>
        </g>
      )}

      {/* ── 7. Bonus descriptors overlay (lower center) ── */}
      {qualityLabel && (
        <g transform="translate(170, 265)">
          <rect
            x="-75"
            y="-9"
            width="150"
            height="18"
            rx="4"
            fill="rgba(13, 21, 37, 0.9)"
            stroke={qualityLabel.startsWith("✔") ? COLORS.headwind : COLORS.crosswind}
            strokeWidth="0.75"
          />
          <text
            x="0"
            y="1"
            textAnchor="middle"
            dominantBaseline="middle"
            fill={qualityLabel.startsWith("✔") ? COLORS.headwind : COLORS.crosswind}
            fontSize="8"
            fontWeight="bold"
          >
            {qualityLabel}
          </text>
        </g>
      )}
    </svg>
  );
});
