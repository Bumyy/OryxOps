// ─────────────────────────────────────────────
//  AircraftWindCard
//  Composes AircraftDiagram (SVG, left, z=10),
//  WindGaugeBars (gauges, bottom-left), and
//  the right-hand textual description panel.
// ─────────────────────────────────────────────

import React from "react";
import { AircraftDiagram } from "./AircraftDiagram";
import { WindGaugeBars }   from "./WindGaugeBars";
import {
  getWindVectors,
  getRelativeAngle,
  getRunwayHeading,
  parseGustKt,
} from "./WindCalculations";
import { COLORS } from "./constants";
import type { DatabaseRunway, MetarReport } from "./types";

interface AircraftWindCardProps {
  rwy:          string;
  metar:        MetarReport;
  planRwy:      string | null;
  dbRwyInfo:    DatabaseRunway | undefined;
  isCustom:     boolean;
  onRemove:     (rwy: string) => void;
  aircraftIcao: string;
  uid:          string;
}

export const AircraftWindCard = React.memo(function AircraftWindCard({
  rwy,
  metar,
  planRwy,
  dbRwyInfo,
  isCustom,
  onRemove,
  aircraftIcao,
  uid,
}: AircraftWindCardProps) {
  const vectors = getWindVectors(rwy, metar.wdir, metar.wspd);
  if (!vectors) return null;

  const relativeAngleDeg    = getRelativeAngle(rwy, metar.wdir);
  const gustBadgeKt         = parseGustKt(metar.rawOb);

  const isTailwind           = vectors.headwind < 0;
  const hwAbs                = Math.abs(vectors.headwind);
  const cwAbs                = Math.abs(vectors.crosswind);
  const cwDirection          = vectors.crosswind < 0 ? "Left" : "Right";
  const showTailwindWarning  = isTailwind && hwAbs > 10;
  const showCrosswindWarning = cwAbs > 20;

  return (
    <div
      className="w-full rounded-2xl overflow-hidden shadow-sm border flex flex-col md:flex-row"
      style={{ background: COLORS.bg, borderColor: COLORS.panelBorder }}
    >
      {/* ══════════════════════════════════════
          LEFT PANEL — Aircraft Wind Diagram & Gauges
      ══════════════════════════════════════ */}
      <div className="flex flex-col md:w-[70%] min-w-0">
        
        {/* Diagram Area */}
        <div
          className="relative w-full overflow-hidden flex items-center justify-center p-2"
          style={{
            background: COLORS.bg,
            aspectRatio: "1 / 1", // clean square format
            maxHeight: 400,
          }}
        >
          <AircraftDiagram
            rwy={rwy}
            vectors={vectors}
            windDir={metar.wdir}
            windSpeedKt={metar.wspd}
            aircraftIcao={aircraftIcao}
            uid={uid}
          />

          {/* Warnings Badges inside visualizer overlay */}
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 pointer-events-none">
            {showTailwindWarning && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-[8.5px] font-black px-2 py-0.5 rounded font-mono tracking-widest shadow-sm">
                ⚠ HIGH TAILWIND
              </div>
            )}
            {showCrosswindWarning && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[8.5px] font-black px-2 py-0.5 rounded font-mono tracking-widest shadow-sm">
                ⚠ HIGH CROSSWIND
              </div>
            )}
            {gustBadgeKt && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 text-[8.5px] font-black px-2 py-0.5 rounded font-mono tracking-widest shadow-sm">
                GUSTS {gustBadgeKt}KT
              </div>
            )}
          </div>
        </div>

        {/* Arc Gauges */}
        <WindGaugeBars
          headwindKt={vectors.headwind}
          crosswindKt={vectors.crosswind}
          gustKt={gustBadgeKt}
          isTailwind={isTailwind}
        />
      </div>

      {/* ══════════════════════════════════════
          RIGHT PANEL — Textual Details & Limits
      ══════════════════════════════════════ */}
      <div
        className="flex flex-col justify-between p-5 md:w-[30%] min-w-0 border-t md:border-t-0 md:border-l"
        style={{ background: COLORS.panelBg, borderColor: COLORS.panelBorder }}
      >
        <div>
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="min-w-0">
              <h3
                className="text-lg font-bold font-mono tracking-widest"
                style={{ color: COLORS.windArrow }}
              >
                RWY {rwy}
              </h3>
              {dbRwyInfo && (
                <span
                  className="text-[10px] font-semibold mt-0.5 block"
                  style={{ color: COLORS.dimLabel }}
                >
                  {dbRwyInfo.length_ft.toLocaleString()} ft × {dbRwyInfo.width_ft} ft
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              {rwy === planRwy && (
                <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  PLANNED
                </span>
              )}
              {isCustom && (
                <button
                  type="button"
                  onClick={() => onRemove(rwy)}
                  className="text-slate-400 hover:text-red-500 text-xs p-1 leading-none transition-colors"
                  title="Remove runway"
                  aria-label={`Remove runway ${rwy}`}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Wind Summary Card */}
          <div
            className="rounded-xl px-3 py-2.5 mb-4 border"
            style={{ background: "rgba(15,23,42,0.03)", borderColor: COLORS.panelBorder }}
          >
            <span
              className="text-[9px] font-bold uppercase tracking-widest block mb-1"
              style={{ color: COLORS.dimLabel }}
            >
              Reported Wind
            </span>
            <span
              className="text-sm font-bold font-mono"
              style={{ color: COLORS.label }}
            >
              {typeof metar.wdir === "number"
                ? `${String(metar.wdir).padStart(3, "0")}° @ ${metar.wspd} KT`
                : `VRB @ ${metar.wspd} KT`}
            </span>
          </div>

          {/* Detailed Readout Components */}
          {vectors.isVariable ? (
            <p className="text-xs italic py-2" style={{ color: COLORS.dimLabel }}>
              Winds are variable — refer to absolute values.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Longitudinal Box */}
              <div
                className="rounded-xl p-3 border flex justify-between items-center"
                style={{
                  background: "rgba(15,23,42,0.01)",
                  borderColor: isTailwind ? "rgba(220,38,38,0.25)" : "rgba(22,163,74,0.20)",
                }}
              >
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest block mb-0.5" style={{ color: COLORS.dimLabel }}>
                    Longitudinal
                  </span>
                  <span className="text-[10px]" style={{ color: isTailwind ? COLORS.tailwind : COLORS.headwind }}>
                    {isTailwind ? "Tailwind component" : "Headwind component"}
                  </span>
                </div>
                <span className="text-sm font-bold font-mono" style={{ color: isTailwind ? COLORS.tailwind : COLORS.headwind }}>
                  {isTailwind ? "▼" : "▲"} {hwAbs} KT
                </span>
              </div>

              {/* Lateral Box */}
              <div
                className="rounded-xl p-3 border flex justify-between items-center"
                style={{
                  background: "rgba(15,23,42,0.01)",
                  borderColor: showCrosswindWarning ? "rgba(217,119,6,0.25)" : COLORS.panelBorder,
                }}
              >
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest block mb-0.5" style={{ color: COLORS.dimLabel }}>
                    Lateral
                  </span>
                  <span className="text-[10px]" style={{ color: COLORS.label }}>
                    Crosswind {cwDirection}
                  </span>
                </div>
                <span className="text-sm font-bold font-mono" style={{ color: showCrosswindWarning ? COLORS.crosswind : COLORS.label }}>
                  ↔ {cwAbs} KT
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Details */}
        {!vectors.isVariable && (
          <p
            className="text-[9.5px] font-medium leading-relaxed mt-4 pt-3 border-t"
            style={{ color: COLORS.dimLabel, borderColor: COLORS.panelBorder }}
          >
            Relative angle to runway heading ({getRunwayHeading(rwy)}°) is{" "}
            <span className="font-mono" style={{ color: COLORS.label }}>
              {Math.abs(relativeAngleDeg).toFixed(0)}°
            </span>.
          </p>
        )}
      </div>
    </div>
  );
});
