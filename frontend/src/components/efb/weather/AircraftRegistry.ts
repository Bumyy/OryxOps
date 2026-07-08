// ─────────────────────────────────────────────
//  Aircraft Registry
//  Maps aircraft ICAO codes to their raw SVG content.
//  Uses Vite's ?raw import suffix to load SVGs as inline strings.
// ─────────────────────────────────────────────

import a320Raw from "../../../assets/aircraft/A320.svg?raw";
import a20nRaw from "../../../assets/aircraft/A20N.svg?raw";
import a321Raw from "../../../assets/aircraft/A321.svg?raw";
import a21nRaw from "../../../assets/aircraft/A21N.svg?raw";
import a332Raw from "../../../assets/aircraft/A332.svg?raw";
import a333Raw from "../../../assets/aircraft/A333.svg?raw";
import a359Raw from "../../../assets/aircraft/A359.svg?raw";
import a35kRaw from "../../../assets/aircraft/A35K.svg?raw";
import a388Raw from "../../../assets/aircraft/A388.svg?raw";
import b738Raw from "../../../assets/aircraft/B738.svg?raw";
import b748Raw from "../../../assets/aircraft/B748.svg?raw";
import b77wRaw from "../../../assets/aircraft/B77W.svg?raw";
import b77lRaw from "../../../assets/aircraft/B77L.svg?raw";
import b77fRaw from "../../../assets/aircraft/B77F.svg?raw";
import b788Raw from "../../../assets/aircraft/B788.svg?raw";
import b789Raw from "../../../assets/aircraft/B789.svg?raw";
import b78xRaw from "../../../assets/aircraft/B78X.svg?raw";
import cl35Raw from "../../../assets/aircraft/CL35.svg?raw";
import genericRaw from "../../../assets/aircraft/generic.svg?raw";

const REGISTRY: Record<string, string> = {
  A320: a320Raw,
  A20N: a20nRaw,
  A321: a321Raw,
  A21N: a21nRaw,
  A332: a332Raw,
  A333: a333Raw,
  A359: a359Raw,
  A35K: a35kRaw,
  A388: a388Raw,
  B738: b738Raw,
  B748: b748Raw,
  B77W: b77wRaw,
  B77L: b77lRaw,
  B77F: b77fRaw,
  B788: b788Raw,
  B789: b789Raw,
  B78X: b78xRaw,
  CL35: cl35Raw,
  GENERIC: genericRaw,
};

/**
 * Clean up ICAO string (e.g. B738, A320) and retrieve corresponding SVG raw string content.
 * Falls back to generic.svg content if the model is not found in mapping.
 */
export function getAircraftSvg(icaoCode?: string): string {
  if (!icaoCode) return genericRaw;
  let clean = icaoCode.trim().toUpperCase();

  // Normalize ICAO variations to registered keys
  if (clean.includes("A320") || clean === "A32A" || clean === "A320-200") {
    clean = "A320";
  } else if (clean === "A20N" || clean === "A320NEO") {
    clean = "A20N";
  } else if (clean.includes("A321") || clean === "A321-200") {
    clean = "A321";
  } else if (clean === "A21N" || clean === "A321NEO") {
    clean = "A21N";
  } else if (clean.includes("A332")) {
    clean = "A332";
  } else if (clean.includes("A333")) {
    clean = "A333";
  } else if (clean.includes("A359")) {
    clean = "A359";
  } else if (clean.includes("A35K") || clean === "A350") {
    clean = "A35K";
  } else if (clean.includes("A388") || clean === "A380") {
    clean = "A388";
  } else if (clean.includes("B738") || clean === "B737" || clean.includes("B38M") || clean.includes("B39M")) {
    clean = "B738";
  } else if (clean.includes("B748") || clean === "B747") {
    clean = "B748";
  } else if (clean.includes("B77W") || clean === "B773" || clean.includes("B779")) {
    clean = "B77W";
  } else if (clean.includes("B77L") || clean === "B772") {
    clean = "B77L";
  } else if (clean.includes("B77F")) {
    clean = "B77F";
  } else if (clean.includes("B788")) {
    clean = "B788";
  } else if (clean.includes("B789") || clean === "B78D") {
    clean = "B789";
  } else if (clean.includes("B78X")) {
    clean = "B78X";
  }

  return REGISTRY[clean] || genericRaw;
}

