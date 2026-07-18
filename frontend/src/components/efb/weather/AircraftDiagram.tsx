// ─────────────────────────────────────────────
//  AircraftDiagram
//  Premium aviation EFB style wind visualization.
//  Aircraft silhouette is fixed pointing straight UP.
//  Only the wind arrow and readouts rotate / update.
//
//  SVG-only rendering. Uses a high-fidelity RAF loop
//  to smoothly animate arrow rotation and count numbers.
// ─────────────────────────────────────────────

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
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

// Generate sleek aerodynamic wind streamlines (slow, long, graceful)
const WIND_STREAKS = Array.from({ length: 8 }).map((_, i) => ({
  id: i,
  offsetX: (Math.random() - 0.5) * 180, // spread across compass width
  offsetY: (Math.random() - 0.5) * 80 - 60, // starting higher up
  length: 120 + Math.random() * 80,     // VERY long streamlines
  delay: Math.random() * 3,             // randomized start times
  duration: 2.5 + Math.random() * 1.5,  // slow, graceful movement
}));

const DARK_THEME = {
  compassRing: "rgba(255,255,255,0.15)",
  dimLabel: "rgba(255,255,255,0.5)",
  windArrow: "#60A5FA", // vibrant light blue
};

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

  // ── Aircraft silhouette retrieval & scaling ──
  const rawSvg = getAircraftSvg(aircraftIcao);
  const viewBoxMatch = rawSvg.match(/viewBox=["']([^"']+)["']/i);
  const viewBoxStr = viewBoxMatch ? viewBoxMatch[1] : "0 0 100 100";
  
  const cleanSvgInner = rawSvg
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>/i, "");

  const aircraftGroupRef = useRef<SVGGElement>(null);
  const [bbox, setBbox] = useState(() => {
    const parts = viewBoxStr.split(/\s+/).map(Number);
    if (parts.length === 4) return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    return { x: 0, y: 0, width: 100, height: 100 };
  });

  useLayoutEffect(() => {
    if (aircraftGroupRef.current) {
      try {
        const measured = aircraftGroupRef.current.getBBox();
        if (measured && measured.width > 0 && measured.height > 0) {
          setBbox({
            x: measured.x,
            y: measured.y,
            width: measured.width,
            height: measured.height
          });
        }
      } catch (e) {
        // Ignore fallback
      }
    }
  }, [cleanSvgInner]);

  // We want the visual height of the plane to always be ~140px.
  // We place the nose exactly at y=145 (bottom of runway).
  const visualHeight = 140;
  const visualWidth = visualHeight * (bbox.width / bbox.height);
  const svgX = 170 - visualWidth / 2;
  const svgY = 145; // Nose of the plane aligned with runway

  // Wind quality descriptor (e.g. Nearly Full Headwind)
  const qualityLabel = getWindQualityLabel(vectors.relativeAngle ?? 0, windSpeedKt);

  return (
    <svg
      viewBox="0 0 340 340"
      className="w-full h-full select-none"
      style={{ background: "transparent" }}
      aria-label={`Runway ${rwy} wind analysis diagram`}
    >
      <style>
        {`
          @keyframes windFlowAnim {
            0% { transform: translateY(-120px); opacity: 0; }
            20% { opacity: 0.25; }
            80% { opacity: 0.25; }
            100% { transform: translateY(220px); opacity: 0; }
          }
          .wind-streak {
            animation: windFlowAnim linear infinite;
          }
          /* Metallic outline for dark mode avionics */
          .aircraft-silhouette * {
            stroke: #94A3B8 !important;
            fill: none !important;
          }
        `}
      </style>

      <defs>
        <clipPath id={`compass-clip-${uid}`}>
          <circle cx="170" cy="170" r="115" />
        </clipPath>
      </defs>

      {/* ── 1. Faint compass ring + runway alignment markings ── */}
      <circle
        cx="170"
        cy="170"
        r="115"
        fill="none"
        stroke={DARK_THEME.compassRing}
        strokeWidth="1.5"
      />
      <circle
        cx="170"
        cy="170"
        r="123"
        fill="none"
        stroke={DARK_THEME.compassRing}
        strokeWidth="0.75"
        strokeDasharray="2,6"
      />

      {/* Cardinal Labels */}
      <text x="170" y="70" textAnchor="middle" fill={DARK_THEME.dimLabel} fontSize="9" fontWeight="bold" fontFamily="monospace">N</text>
      <text x="170" y="278" textAnchor="middle" fill={DARK_THEME.dimLabel} fontSize="9" fontWeight="bold" fontFamily="monospace">S</text>
      <text x="278" y="173" textAnchor="middle" fill={DARK_THEME.dimLabel} fontSize="9" fontWeight="bold" fontFamily="monospace">E</text>
      <text x="62"  y="173" textAnchor="middle" fill={DARK_THEME.dimLabel} fontSize="9" fontWeight="bold" fontFamily="monospace">W</text>

      {/* ── 2. Runway Threshold Graphic ── */}
      <g>
        {/* Runway surface */}
        <rect
          x="125"
          y="65"
          width="90"
          height="70"
          rx="4"
          fill="#1D2939"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="1"
        />
        {/* Runway threshold piano keys */}
        <line x1="129" y1="129" x2="129" y2="134" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="135" y1="129" x2="135" y2="134" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="141" y1="129" x2="141" y2="134" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="147" y1="129" x2="147" y2="134" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="193" y1="129" x2="193" y2="134" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="199" y1="129" x2="199" y2="134" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="205" y1="129" x2="205" y2="134" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="211" y1="129" x2="211" y2="134" stroke="#FFFFFF" strokeWidth="1.5" />
        {/* Runway centerline */}
        <line
          x1="170"
          y1="115"
          x2="170"
          y2="70"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeDasharray="5,6"
        />
        {/* Runway designator text */}
        <text
          x="170"
          y="123"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="14"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {rwy}
        </text>
      </g>

      {/* ── 3. Aircraft silhouette (Auto-scaled to fit precisely at the threshold) ── */}
      <svg
        x={svgX}
        y={svgY}
        width={visualWidth}
        height={visualHeight}
        viewBox={`${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`}
        className="aircraft-silhouette"
        style={{ overflow: "visible" }}
      >
        <g ref={aircraftGroupRef} dangerouslySetInnerHTML={{ __html: cleanSvgInner }} />
      </svg>

      {/* ── 4. Wind Flow Particles (Flowing across the compass ring) ── */}
      {!isVariable && windSpeedKt >= 0.5 && (
        <g clipPath={`url(#compass-clip-${uid})`}>
          <g transform={`rotate(${angle}, 170, 170)`}>
            {WIND_STREAKS.map((streak) => (
              <line
                key={streak.id}
                x1={170 + streak.offsetX}
                y1={170 + streak.offsetY}
                x2={170 + streak.offsetX}
                y2={170 + streak.offsetY + streak.length}
                stroke={DARK_THEME.windArrow}
                strokeWidth="1.5"
                strokeLinecap="round"
                className="wind-streak"
                style={{
                  animationDuration: `${streak.duration}s`,
                  animationDelay: `${streak.delay}s`,
                }}
              />
            ))}
          </g>
        </g>
      )}

      {/* ── 5. Absolute wind readout (Top center) ── */}
      <g transform="translate(170, 40)">
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fill={DARK_THEME.windArrow}
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
          fill={DARK_THEME.dimLabel}
          fontSize="7.5"
          fontWeight="bold"
          letterSpacing="1"
        >
          WIND VECTOR
        </text>
      </g>

      {/* ── 6. Component readout labels (arranged dynamically outside the compass circle) ── */}
      
      {/* HEADWIND (Top center, completely outside compass circle) */}
      {!isVariable && vectors.headwind >= 0 && (
        <g transform="translate(170, 16)">
          <text
            x="0"
            y="0"
            textAnchor="middle"
            fill={COLORS.headwind}
            fontSize="14"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {Math.round(hw)} <tspan fontSize="8" fontWeight="normal">KT</tspan>
          </text>
          <text
            x="0"
            y="9"
            textAnchor="middle"
            fill={COLORS.dimLabel}
            fontSize="7"
            fontWeight="bold"
            letterSpacing="0.5"
          >
            HEADWIND
          </text>
        </g>
      )}

      {/* TAILWIND (Bottom center, completely outside compass circle) */}
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

      {/* LEFT CROSSWIND (Only if crosswind is coming from the left) */}
      {!isVariable && vectors.crosswind < 0 && (
        <g transform="translate(15, 215)">
          <text
            x="0"
            y="-4"
            textAnchor="start"
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
            textAnchor="start"
            fill={COLORS.dimLabel}
            fontSize="8"
            fontWeight="bold"
            letterSpacing="0.5"
          >
            CROSSWIND (L)
          </text>
        </g>
      )}

      {/* RIGHT CROSSWIND (Only if crosswind is coming from the right) */}
      {!isVariable && vectors.crosswind >= 0 && (
        <g transform="translate(325, 215)">
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
            CROSSWIND (R)
          </text>
        </g>
      )}

      {/* ── 7. Bonus descriptors overlay (lower center) ── */}
      {qualityLabel && (
        <g transform="translate(170, 285)">
          <rect
            x="-75"
            y="-9"
            width="150"
            height="18"
            rx="4"
            fill="#0F172A"
            stroke={qualityLabel.startsWith("✔") ? COLORS.headwind : COLORS.crosswind}
            strokeWidth="1"
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

