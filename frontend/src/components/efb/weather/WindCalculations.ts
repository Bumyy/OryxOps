// ─────────────────────────────────────────────
//  EFB Weather — Pure Wind Calculations
//  No React. No side-effects. Pure functions.
// ─────────────────────────────────────────────

import type { WindVectors, FlightCategoryStyle } from "./types";

/** Convert a runway designator (e.g. "09L") to its magnetic heading in degrees. */
export function getRunwayHeading(rwy: string): number {
  const match = rwy.trim().match(/^(\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 10;
}

/**
 * Compute the signed angle (degrees, range -180..+180) from the runway heading
 * to the wind direction.  Positive = wind from the right, negative = from left.
 */
export function getRelativeAngle(rwy: string, windDir: number | string): number {
  if (typeof windDir === "string" || isNaN(Number(windDir))) return 0;
  const rwyHeading = getRunwayHeading(rwy);
  let diff = Number(windDir) - rwyHeading;
  while (diff < -180) diff += 360;
  while (diff > 180)  diff -= 360;
  return diff;
}

/** Calculate headwind and crosswind components. */
export function getWindVectors(
  rwy: string,
  windDir: number | string,
  windSpeed: number,
): WindVectors | null {
  const match = rwy.trim().match(/^(\d+)/);
  if (!match) return null;

  if (typeof windDir === "string" || isNaN(Number(windDir))) {
    return { headwind: 0, crosswind: 0, isVariable: true };
  }

  const rwyHeading = parseInt(match[1], 10) * 10;
  let diff = Number(windDir) - rwyHeading;
  while (diff < -180) diff += 360;
  while (diff > 180)  diff -= 360;

  const angleRad = diff * (Math.PI / 180);
  return {
    headwind:      Math.round(windSpeed * Math.cos(angleRad)),
    crosswind:     Math.round(windSpeed * Math.sin(angleRad)),
    isVariable:    false,
    relativeAngle: diff,
  };
}

/** Compute the reciprocal runway designator (e.g. "15L" → "33R"). */
export function getReciprocalRunway(rwy: string): string {
  const match = rwy.trim().match(/^(\d+)([LRC]?)$/i);
  if (!match) return "";
  const num    = parseInt(match[1], 10);
  const letter = match[2].toUpperCase();
  const recipNum    = num <= 18 ? num + 18 : num - 18;
  const recipNumStr = recipNum < 10 ? `0${recipNum}` : `${recipNum}`;
  let   recipLetter = letter;
  if (letter === "L") recipLetter = "R";
  else if (letter === "R") recipLetter = "L";
  return `${recipNumStr}${recipLetter}`;
}

/**
 * Approximate relative humidity via the Tetens / Magnus formula.
 * Returns 0–100 or null when inputs are missing.
 */
export function getRelativeHumidity(
  temp?: number,
  dewp?: number,
): number | null {
  if (temp === undefined || dewp === undefined) return null;
  try {
    return Math.round(
      100 *
        Math.pow(
          10,
          (7.59 * dewp) / (dewp + 240.7) - (7.59 * temp) / (temp + 240.7),
        ),
    );
  } catch {
    return null;
  }
}

/** Map an aviation flight-category string to Tailwind colour classes + label. */
export function getFltCatProps(cat?: string): FlightCategoryStyle {
  switch (cat?.toUpperCase()) {
    case "VFR":
      return { bg: "bg-green-100 border-green-200 text-green-700",  label: "Visual Flight Rules (VFR)" };
    case "MVFR":
      return { bg: "bg-blue-100 border-blue-200 text-blue-700",     label: "Marginal Visual Flight Rules (MVFR)" };
    case "IFR":
      return { bg: "bg-red-100 border-red-200 text-red-700",        label: "Instrument Flight Rules (IFR)" };
    case "LIFR":
      return { bg: "bg-purple-100 border-purple-200 text-purple-700", label: "Low Instrument Flight Rules (LIFR)" };
    default:
      return { bg: "bg-gray-100 border-gray-200 text-gray-700",     label: "Unknown Conditions" };
  }
}

/**
 * Extract gust speed from a raw METAR observation string.
 * Returns knots as a number, or null if no gust group is present.
 */
export function parseGustKt(rawOb: string): number | null {
  const m = rawOb.match(/G(\d+)KT/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Get visual wind descriptors for full headwind / crosswind conditions.
 */
export function getWindQualityLabel(
  relativeAngleDeg: number,
  windSpeedKt: number,
): string | null {
  if (windSpeedKt < 3) return null;
  const absAngle = Math.abs(relativeAngleDeg);
  
  if (absAngle <= 10) {
    return "✔ Nearly Full Headwind";
  }
  if (absAngle >= 80 && absAngle <= 100) {
    return "⚠ Maximum Crosswind";
  }
  return null;
}