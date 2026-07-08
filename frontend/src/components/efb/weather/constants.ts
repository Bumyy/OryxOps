// ─────────────────────────────────────────────
//  EFB Weather — Design Constants
// ─────────────────────────────────────────────

export const COLORS = {
  // ── Card backgrounds (light theme matching bg-white / brand border) ──────
  bg:                "#FFFFFF",             // pure white background
  panelBg:           "#F8FAFC",             // slate-50 background for details panel
  panelBorder:       "rgba(226,232,240,0.8)", // slate-200 border

  // ── Vector components (high contrast light theme) ─────────
  aircraft:          "#0F172A",             // dark slate aircraft outline
  windArrow:         "#2563EB",             // royal blue wind arrow
  headwind:          "#16A34A",             // rich green headwind
  tailwind:          "#DC2626",             // rich red tailwind
  crosswind:         "#D97706",             // rich amber crosswind
  compassRing:       "rgba(15,23,42,0.08)",  // faint slate-900 compass ring
  label:             "#0F172A",             // dark slate labels
  dimLabel:          "rgba(15,23,42,0.50)",  // muted slate-900 labels

  // ── Gauge arc colours ──
  gaugeTrack:        "rgba(15,23,42,0.06)",  // faint track arc
  gaugeHeadwind:     "#16A34A",
  gaugeTailwind:     "#DC2626",
  gaugeCrosswind:    "#D97706",
  gaugeGust:         "#DC2626",
} as const;

// ─── Gauge limits ────────────────────────────
export const GAUGE_MAX_HEADWIND  = 40;
export const GAUGE_MAX_CROSSWIND = 30;
export const GAUGE_MAX_GUST      = 50;
