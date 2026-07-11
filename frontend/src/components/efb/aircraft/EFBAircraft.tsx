// ─────────────────────────────────────────────────────────────────────────────
//  EFBAircraft — Aircraft Performance Reference Page
//  Displays full performance data for the selected aircraft:
//  takeoff, landing, cruise, speed, VS, descent, flap limits, engine start.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AircraftProperties {
  full_name: string;
  manufacturer: string;
  engines: number;
}

interface FlapRetractStep {
  speed: number;
  setting: string;
  condition?: string;
}

interface LoadRangeEntry {
  load_range: [number, number];
  flaps: string;
  n1?: string;
  vr?: number;
  va?: number;
  vapp?: number;
  vflare?: number;
  altitude?: string;
}

interface PerformanceData {
  flap_speeds: Record<string, number>;
  cruise_profile: { west: LoadRangeEntry[]; east: LoadRangeEntry[] };
  takeoff_data: LoadRangeEntry[];
  landing_data: LoadRangeEntry[];
  speed_profile: {
    initial_speed: string;
    below_10k: string;
    above_10k: string;
    mach_transition_alt: string;
    mach: string;
  };
  climb_vs_profile: Record<string, string>;
  descent_speed_profile: Record<string, string>;
}

interface AircraftInfo {
  properties: AircraftProperties;
  engine_start_sequence: number[];
  flap_retraction_schedule: FlapRetractStep[];
  performance_data: PerformanceData;
}

interface EFBAircraftProps {
  aircraftInfo: AircraftInfo | null;
  activeAircraft: string;
  activeDirection: "east" | "west";
  aircraftCode: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatClimbLabel(key: string): string {
  return key
    .replace("0_5000", "0 → 5,000 ft")
    .replace("5000_15000", "5,000 → 15,000 ft")
    .replace("15000_24000", "15,000 → 24,000 ft")
    .replace("24000_cruise", "24,000 ft → Cruise");
}

function formatDescentLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/fl/gi, "FL")
    .toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Coloured pill badge */
function Badge({
  children,
  color = "brand",
}: {
  children: React.ReactNode;
  color?: "brand" | "green" | "amber" | "red" | "slate";
}) {
  const map: Record<string, string> = {
    brand: "bg-brand/10 text-brand border border-brand/20",
    green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border border-amber-200",
    red:   "bg-red-50   text-red-700   border border-red-200",
    slate: "bg-slate-100 text-slate-600 border border-slate-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold ${map[color]}`}>
      {children}
    </span>
  );
}

/** Section card wrapper */
function Card({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-brand-border bg-brand-pale/50">
        <span className="text-brand">{icon}</span>
        <h3 className="text-sm font-bold text-brand tracking-wide uppercase">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/** Speed value pill */
function SpeedPill({ label, value, unit = "kts", color = "brand" }: {
  label: string;
  value: string | number;
  unit?: string;
  color?: "brand" | "green" | "amber" | "red" | "slate";
}) {
  const colorMap: Record<string, string> = {
    brand: "from-brand to-brand/80 text-white",
    green: "from-emerald-500 to-emerald-600 text-white",
    amber: "from-amber-500 to-amber-600 text-white",
    red:   "from-red-500 to-red-600 text-white",
    slate: "from-slate-400 to-slate-500 text-white",
  };
  return (
    <div className="flex flex-col items-center gap-1 min-w-[70px]">
      <div className={`bg-gradient-to-br ${colorMap[color]} rounded-xl px-4 py-2.5 text-center shadow-sm`}>
        <span className="text-xl font-black tracking-tight">{value}</span>
        <span className="text-xs font-semibold opacity-80 ml-1">{unit}</span>
      </div>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

/** Compact data table with highlighted active row */
function PerfTable({
  headers,
  rows,
  activeRow,
  compact = false,
}: {
  headers: string[];
  rows: (string | number)[][];
  activeRow?: number;
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-brand-pale">
            {headers.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-2 text-left font-bold text-brand/80 uppercase tracking-wide whitespace-nowrap ${compact ? "py-1.5" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const isActive = ri === activeRow;
            return (
              <tr
                key={ri}
                className={`border-t border-brand-border/50 transition-colors ${
                  isActive
                    ? "bg-brand text-white font-bold"
                    : "hover:bg-brand-pale/50"
                }`}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-2 font-mono ${compact ? "py-1.5" : ""} ${
                      isActive ? "text-white" : "text-gray-700"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const icons = {
  plane: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  takeoff: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 17l2-2m10-6l2-2m-4 4l-8-8M3 21h18" />
    </svg>
  ),
  landing: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-2 2M5 17l2-2M9 9l8 8M3 21h18" />
    </svg>
  ),
  cruise: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  speed: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  vs: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  ),
  descent: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  ),
  flap: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l6 6 4-4 8 8" />
    </svg>
  ),
  engine: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EFBAircraft({
  aircraftInfo,
  activeAircraft,
  activeDirection,
  aircraftCode,
}: EFBAircraftProps) {

  const [cruiseTab, setCruiseTab] = useState<"east" | "west">(activeDirection);

  // ── No data state ──────────────────────────────────────────────────────────
  if (!aircraftInfo) {
    return (
      <div className="text-center py-20 px-4 max-w-sm mx-auto">
        <div className="w-16 h-16 bg-brand-pale rounded-full flex items-center justify-center mx-auto mb-5 border border-brand-border">
          {icons.plane}
        </div>
        <h3 className="text-lg font-bold text-brand">No Aircraft Data Available</h3>
        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
          Aircraft performance data for <span className="font-bold text-brand">{activeAircraft}</span> is
          not in the database. Please check your booking or SimBrief plan.
        </p>
      </div>
    );
  }

  const { properties, engine_start_sequence, flap_retraction_schedule, performance_data } = aircraftInfo;
  const pd = performance_data;

  // VS profile bar chart max value
  const vsValues = Object.values(pd.climb_vs_profile).map(Number);
  const maxVs = Math.max(...vsValues);

  return (
    <div className="space-y-6">

      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-brand to-brand/80 text-white p-6 shadow-lg flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Aircraft icon silhouette */}
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 shadow-inner">
          <svg className="w-9 h-9 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-black text-2xl tracking-tight">{activeAircraft}</span>
            <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-lg">
              {aircraftCode || activeAircraft}
            </span>
          </div>
          <p className="text-white/80 text-sm font-semibold">{properties.full_name}</p>
          <p className="text-white/60 text-xs">{properties.manufacturer}</p>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="text-xs font-bold">{properties.engines} Engines</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs font-bold">Start: {engine_start_sequence.join(" → ")}</span>
          </div>
        </div>
      </div>



      {/* ── Engine Start Sequence ─────────────────────────────────────────── */}
      <Card title="Engine Start Sequence" icon={icons.engine}>
        <div className="flex flex-wrap items-center gap-3">
          {engine_start_sequence.map((engNum, idx) => (
            <React.Fragment key={engNum}>
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  {/* Pulsing ring on first engine */}
                  {idx === 0 && (
                    <span className="absolute inset-0 rounded-full bg-brand/20 animate-ping" />
                  )}
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-brand/70 flex items-center justify-center shadow-md relative">
                    <span className="text-white font-black text-xl">{engNum}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {idx === 0 ? "1st" : idx === 1 ? "2nd" : idx === 2 ? "3rd" : `${idx + 1}th`}
                </span>
              </div>
              {idx < engine_start_sequence.length - 1 && (
                <svg className="w-5 h-5 text-brand/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Flap retraction schedule */}
        {flap_retraction_schedule && flap_retraction_schedule.length > 0 && (
          <div className="mt-5 pt-5 border-t border-brand-border">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Flap Retraction After Takeoff
            </p>
            <div className="space-y-2">
              {flap_retraction_schedule.map((step, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="bg-brand-pale border border-brand-border rounded-lg px-2.5 py-1 font-mono text-xs font-bold text-brand min-w-[70px] text-center">
                    {step.speed} kts
                  </span>
                  <svg className="w-4 h-4 text-brand/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-gray-600 font-semibold text-xs">
                    Flaps <span className="text-brand font-bold">{step.setting}</span>
                    {step.condition && (
                      <span className="text-gray-400 font-normal ml-1">({step.condition})</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── Flap Speed Reference ──────────────────────────────────────────── */}
      <Card title="Flap Speed Limits" icon={icons.flap}>
        <div className="flex flex-wrap gap-2">
          {Object.entries(pd.flap_speeds)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .map(([setting, maxSpeed]) => (
              <div
                key={setting}
                className="flex flex-col items-center bg-brand-pale border border-brand-border rounded-xl px-4 py-3 min-w-[72px]"
              >
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Flaps {setting}
                </span>
                <span className="text-lg font-black text-brand">{maxSpeed}</span>
                <span className="text-[10px] text-gray-400 font-semibold">kts max</span>
              </div>
            ))}
        </div>
      </Card>

      {/* ── Full Takeoff Data Table ───────────────────────────────────────── */}
      <Card title="Full Takeoff Data Table" icon={icons.takeoff}>
        <PerfTable
          headers={["Load %", "Flaps", "N1 Range", "Vr (kts)", "V2 (kts)"]}
          rows={pd.takeoff_data.map((r) => [
            `${r.load_range[0]}–${r.load_range[1]}%`,
            r.flaps,
            r.n1 ?? "—",
            r.vr ?? "—",
            r.va ?? "—",
          ])}
          compact
        />
      </Card>

      {/* ── Speed Profile + Climb VS ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Speed Schedule */}
        <Card title="Speed Schedule" icon={icons.speed}>
          <div className="space-y-2.5">
            {[
              { label: "Initial Climb Speed", value: `${pd.speed_profile.initial_speed} kts`, color: "bg-brand/10 text-brand border-brand/20" },
              { label: "Below 10,000 ft", value: `${pd.speed_profile.below_10k} kts`, color: "bg-amber-50 text-amber-700 border-amber-200" },
              { label: "Above 10,000 ft", value: `${pd.speed_profile.above_10k} kts`, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { label: "Mach Transition", value: pd.speed_profile.mach_transition_alt, color: "bg-sky-50 text-sky-700 border-sky-200" },
              { label: "Cruise Mach", value: `M ${pd.speed_profile.mach}`, color: "bg-purple-50 text-purple-700 border-purple-200" },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border ${item.color}`}
              >
                <span className="text-xs font-semibold">{item.label}</span>
                <span className="font-black text-sm font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Climb VS Profile */}
        <Card title="Climb VS Profile" icon={icons.vs}>
          <div className="space-y-3">
            {Object.entries(pd.climb_vs_profile).map(([key, vsStr]) => {
              const vs = parseInt(vsStr);
              const pct = maxVs > 0 ? Math.round((vs / maxVs) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-600">{formatClimbLabel(key)}</span>
                    <span className="text-xs font-black text-brand font-mono">{vs.toLocaleString()} fpm</span>
                  </div>
                  <div className="w-full bg-brand-pale rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-brand to-brand/60 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Cruise Profile ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-brand-border bg-brand-pale/50">
          <span className="text-brand">{icons.cruise}</span>
          <h3 className="text-sm font-bold text-brand tracking-wide uppercase">Cruise Altitude Profile</h3>
          {/* Toggle east / west */}
          <div className="ml-auto flex items-center gap-1 bg-brand-pale rounded-xl p-1">
            {(["east", "west"] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setCruiseTab(dir)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  cruiseTab === dir
                    ? "bg-brand text-white shadow-sm"
                    : "text-gray-500 hover:text-brand"
                }`}
              >
                {dir === "east" ? "→ Eastbound" : "← Westbound"}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5">
          <PerfTable
            headers={["Load %", "Cruise FL"]}
            rows={(pd.cruise_profile[cruiseTab] || []).map((r) => [
              `${r.load_range[0]}–${r.load_range[1]}%`,
              r.altitude ?? "—",
            ])}
            compact
          />
        </div>
      </div>

      {/* ── Descent Speed Profile ─────────────────────────────────────────── */}
      <Card title="Descent Speed Profile" icon={icons.descent}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(pd.descent_speed_profile).map(([phase, speed], idx) => {
            const colors = [
              "border-purple-200 bg-purple-50 text-purple-700",
              "border-sky-200 bg-sky-50 text-sky-700",
              "border-emerald-200 bg-emerald-50 text-emerald-700",
            ];
            const col = colors[idx % colors.length];
            return (
              <div key={phase} className={`rounded-xl border px-4 py-3 ${col}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">
                  {formatDescentLabel(phase)}
                </p>
                <p className="text-base font-black font-mono">{speed}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Full Landing Data Table ───────────────────────────────────────── */}
      <Card title="Full Landing Data Table" icon={icons.landing}>
        <PerfTable
          headers={["Load %", "Flaps", "Vapp (kts)", "Vflare (kts)"]}
          rows={pd.landing_data.map((r) => [
            `${r.load_range[0]}–${r.load_range[1]}%`,
            r.flaps,
            r.vapp ?? "—",
            r.vflare ?? "—",
          ])}
          compact
        />
      </Card>
    </div>
  );
}
