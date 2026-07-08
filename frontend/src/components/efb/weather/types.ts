// ─────────────────────────────────────────────
//  EFB Weather — Shared Types
// ─────────────────────────────────────────────

export interface MetarReport {
  rawOb: string;
  name?: string;
  wdir: number | string;
  wspd: number;
  wgst?: number | null;
  temp: number;
  dewp: number;
  altim?: number;
  visib: number | string;
  clouds: CloudLayer[];
  fltCat?: string;
  reportTime?: string;
}

export interface CloudLayer {
  cover: string;
  base?: number | null;
}

export interface TafReport {
  rawTAF: string;
}

export interface DatabaseRunway {
  designator: string;
  length_ft: number;
  width_ft: number;
  heading?: number;
}

export interface WindVectors {
  headwind: number;
  crosswind: number;
  isVariable: boolean;
  relativeAngle?: number;
}

export interface FlightCategoryStyle {
  bg: string;
  label: string;
}

export interface AircraftDiagramProps {
  rwy:          string;
  vectors:      WindVectors;
  windDir:      number | string;
  windSpeedKt:  number;
  aircraftIcao: string;
  uid:          string;
}
