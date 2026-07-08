// ─────────────────────────────────────────────
//  EFB Weather — Design Constants
// ─────────────────────────────────────────────

export const COLORS = {
  // ── Card backgrounds (dark glass theme) ──────
  bg:                "#0A0F1A",             // dark slate background
  panelBg:           "#0D1525",             // slightly lighter dark blue
  panelBorder:       "rgba(51,65,85,0.45)",  // slate-700/45

  // ── Vector components (Garmin style) ─────────
  aircraft:          "#FFFFFF",             // white aircraft silhouette
  windArrow:         "#60A5FA",             // blue wind arrow
  headwind:          "#22C55E",             // green headwind
  tailwind:          "#EF4444",             // red tailwind
  crosswind:         "#F59E0B",             // amber crosswind
  compassRing:       "rgba(255,255,255,0.12)", // faint compass ring
  label:             "rgba(203,213,225,0.90)", // slate-300
  dimLabel:          "rgba(100,116,139,0.70)", // slate-500

  // ── Gauge arc colours (WindGaugeBars compatibility) ──
  gaugeTrack:        "rgba(255,255,255,0.08)",
  gaugeHeadwind:     "#22C55E",
  gaugeTailwind:     "#EF4444",
  gaugeCrosswind:    "#F59E0B",
  gaugeGust:         "#EF4444",
} as const;

// ─── Gauge limits ────────────────────────────
export const GAUGE_MAX_HEADWIND  = 40;
export const GAUGE_MAX_CROSSWIND = 30;
export const GAUGE_MAX_GUST      = 50;
