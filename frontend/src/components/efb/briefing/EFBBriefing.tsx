import React from "react";

export const getSimBriefAircraftType = (type: string | undefined): string => {
  const clean = (type || "").trim().toUpperCase();
  const mapping: Record<string, string> = {
    "A330": "A333",
    "A350": "A359",
    "B777": "B77W",
    "B787": "B789",
    "B737": "B738",
    "777": "B77W",
    "787": "B789",
    "737": "B738",
    "330": "A333",
    "350": "A359",
  };
  return mapping[clean] || clean || "A320";
};

export interface EFBBriefingProps {
  ofpData: any;
  units: string;
  flightNum: string;
  formatTimestampToTime: (ts: any) => string;
  formatWeight: (val: any, unit: string) => string;
  getPdfUrl: () => string;
  handleRefreshOfp: () => void;
  pdfLoadError: boolean;
  setPdfLoadError: (val: boolean) => void;
  handleToggleFullscreen: () => void;

  // Booking-driven & manual settings properties
  activeBooking?: any;
  activeLoad: number;
  setActiveLoad: (load: number) => void;
  activeCruiseAlt: number;
  setActiveCruiseAlt: (alt: number) => void;

  efbDataSource: "simbrief" | "booking";
  setEfbDataSource: (src: "simbrief" | "booking") => void;
}

// ─── Reusable sub-components ─────────────────────────────────────────────────

/** A labelled data field used inside the route hero banner */
function BriefingField({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span
        className={`text-sm font-bold leading-tight ${mono ? "font-mono" : ""} ${highlight ? "text-yellow-400 dark:text-yellow-300" : ""}`}
        style={highlight ? {} : { color: "var(--text-main)" }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

/** A row inside a metric card */
function MetricRow({
  label,
  value,
  accent = false,
  large = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-2"
      style={{ borderBottom: "1px solid var(--border-main)" }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span
        className={`font-mono font-bold ${large ? "text-base" : "text-sm"} ${
          accent ? "text-yellow-500 dark:text-yellow-300" : ""
        }`}
        style={accent ? {} : { color: "var(--text-main)" }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EFBBriefing({
  ofpData,
  units,
  flightNum,
  formatTimestampToTime,
  formatWeight,
  getPdfUrl,
  handleRefreshOfp,
  pdfLoadError,
  setPdfLoadError,
  handleToggleFullscreen,
  activeBooking,
  activeLoad,
  setActiveLoad,
  activeCruiseAlt,
  setActiveCruiseAlt,
  efbDataSource,
  setEfbDataSource,
}: EFBBriefingProps) {
  return (
    <div className="space-y-5">

      {/* ── EFB Data Source Switcher ─────────────────────────────────────── */}
      {(ofpData || activeBooking) && (
        <div
          className="flex flex-col md:flex-row md:items-center justify-between rounded-2xl p-4 gap-4"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--brand-border)",
          }}
        >
          <div>
            <h4
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: "var(--brand)" }}
            >
              EFB Data Source
            </h4>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Select the source for EFB calculations and checklists
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-start md:self-auto flex-wrap">
            {activeBooking && (
              <a
                href={`https://www.simbrief.com/system/dispatch.php?orig=${activeBooking.flight_departure}&dest=${activeBooking.flight_arrival}&pax=${activeBooking.pax_count || 150}&type=${getSimBriefAircraftType(activeBooking.aircraft_icao)}&flt=${activeBooking.flight_number?.replace(/\D/g, "") || "100"}&airline=${activeBooking.flight_number?.replace(/\d/g, "") || "QR"}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-br from-red-600 to-red-800 text-white font-bold text-xs px-4 py-2 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                <span>Generate SimBrief ({activeBooking.pax_count} Pax)</span>
              </a>
            )}
            {/* Segmented toggle */}
            <div
              className="flex p-1 rounded-xl gap-1"
              style={{ background: "var(--bg-slate)", border: "1px solid var(--brand-border)" }}
            >
              <button
                type="button"
                disabled={!ofpData}
                onClick={() => setEfbDataSource("simbrief")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  efbDataSource === "simbrief"
                    ? "bg-brand text-white shadow-sm"
                    : "text-gray-500 hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                ✈️ SimBrief OFP
              </button>
              <button
                type="button"
                disabled={!activeBooking}
                onClick={() => setEfbDataSource("booking")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  efbDataSource === "booking"
                    ? "bg-brand text-white shadow-sm"
                    : "text-gray-500 hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                📅 Booking Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SIMBRIEF OFP VIEW
      ════════════════════════════════════════════════════════════════════ */}
      {efbDataSource === "simbrief" && ofpData ? (
        <>
          {/* ── Page title ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {/* Wing icon */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                style={{ background: "var(--brand)", color: "#fff" }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0011.5 2 1.5 1.5 0 0010 3.5V9L2 14v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z"/>
                </svg>
              </div>
              <div>
                <h3
                  className="text-base font-black uppercase tracking-wide leading-none"
                  style={{ color: "var(--text-main)" }}
                >
                  Captain's Briefing
                </h3>
                <p className="text-[10px] mt-0.5 uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>
                  SimBrief Operational Flight Plan
                </p>
              </div>
            </div>
            {/* Quick-action strip */}
            <div className="flex items-center gap-1.5">
              {[
                { title: "Refresh OFP", onClick: handleRefreshOfp, icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" />
                  </svg>
                )},
                { title: "Open in New Tab", href: getPdfUrl(), icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                )},
                { title: "Download PDF", href: getPdfUrl(), download: true, icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )},
                { title: "Fullscreen", onClick: handleToggleFullscreen, icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5m-11 11h4m-4 0v-4m0 4l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                )},
              ].map((btn, i) =>
                btn.href ? (
                  <a
                    key={i}
                    href={btn.href}
                    target={btn.download ? undefined : "_blank"}
                    rel="noreferrer"
                    download={btn.download}
                    title={btn.title}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:-translate-y-0.5"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--brand-border)",
                      color: "var(--text-sub)",
                    }}
                  >
                    {btn.icon}
                  </a>
                ) : (
                  <button
                    key={i}
                    onClick={btn.onClick}
                    title={btn.title}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:-translate-y-0.5 cursor-pointer"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--brand-border)",
                      color: "var(--text-sub)",
                    }}
                  >
                    {btn.icon}
                  </button>
                )
              )}
            </div>
          </div>

          {/* ── HERO ROUTE BANNER ─────────────────────────────────────────── */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, var(--brand-dark) 0%, var(--brand) 100%)",
              border: "1px solid var(--brand-border)",
            }}
          >
            {/* Subtle world-map texture overlay */}
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Ccircle cx='200' cy='100' r='90' fill='none' stroke='white' stroke-width='0.5'/%3E%3Ccircle cx='200' cy='100' r='60' fill='none' stroke='white' stroke-width='0.5'/%3E%3Ccircle cx='200' cy='100' r='30' fill='none' stroke='white' stroke-width='0.5'/%3E%3Cline x1='20' y1='100' x2='380' y2='100' stroke='white' stroke-width='0.5'/%3E%3Cline x1='200' y1='10' x2='200' y2='190' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
                backgroundRepeat: "repeat",
                backgroundSize: "300px 150px",
              }}
            />

            <div className="relative p-5 md:p-7">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8">

                {/* LEFT — Origin */}
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">
                      {ofpData.origin?.icao_code || "—"}
                    </div>
                    <div className="text-xs md:text-sm font-semibold text-white/70 mt-1 truncate">
                      {ofpData.origin?.name || "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    <BriefingField label="SID" value={ofpData.general?.sid_ident} mono />
                    <BriefingField label="Runway" value={ofpData.origin?.plan_rwy} mono />
                    <BriefingField
                      label="ETD"
                      value={
                        <span className="text-yellow-300 font-black font-mono">
                          {formatTimestampToTime(ofpData.times?.est_out)}
                        </span>
                      }
                    />
                  </div>
                </div>

                {/* CENTER — Flight path graphic */}
                <div className="flex flex-col items-center gap-2 min-w-[90px] md:min-w-[140px]">
                  {/* Flight number pill */}
                  <div className="bg-white/15 border border-white/25 rounded-full px-3 py-0.5 text-xs font-black text-white font-mono tracking-widest">
                    {flightNum}
                  </div>

                  {/* Dashed line with aircraft */}
                  <div className="relative flex items-center w-full">
                    <div className="flex-1 border-t-2 border-dashed border-white/30" />
                    <div className="mx-2 text-white drop-shadow-md">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0011.5 2 1.5 1.5 0 0010 3.5V9L2 14v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z"/>
                      </svg>
                    </div>
                    <div className="flex-1 border-t-2 border-dashed border-white/30" />
                  </div>

                  {/* Distance & flight time */}
                  <div className="text-center">
                    <div className="text-xs font-black text-white font-mono">
                      {ofpData.general?.route_distance ? `${ofpData.general.route_distance} NM` : "—"}
                    </div>
                    <div className="text-[10px] font-semibold text-white/60 mt-0.5">
                      {ofpData.times?.est_time_enroute
                        ? `${Math.floor(ofpData.times.est_time_enroute / 3600)}h ${Math.round((ofpData.times.est_time_enroute % 3600) / 60)}m`
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* RIGHT — Destination */}
                <div className="flex flex-col gap-3 items-end text-right">
                  <div>
                    <div className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">
                      {ofpData.destination?.icao_code || "—"}
                    </div>
                    <div className="text-xs md:text-sm font-semibold text-white/70 mt-1 truncate">
                      {ofpData.destination?.name || "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 justify-end">
                    <BriefingField label="STAR" value={ofpData.general?.star_ident} mono />
                    <BriefingField label="Runway" value={ofpData.destination?.plan_rwy} mono />
                    <BriefingField
                      label="ETA"
                      value={
                        <span className="text-yellow-300 font-black font-mono">
                          {formatTimestampToTime(ofpData.times?.est_in)}
                        </span>
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Bottom strip — Aircraft type */}
              <div className="mt-5 pt-4 border-t border-white/15 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">Aircraft</span>
                <span className="text-xs font-black text-white font-mono bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  {ofpData.aircraft?.icao_code || "—"}
                </span>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">Cruise</span>
                <span className="text-xs font-black text-white font-mono bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  FL{ofpData.general?.initial_altitude ? Math.round(parseInt(ofpData.general.initial_altitude) / 100) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* ── METRIC CARDS ROW ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

            {/* Card 1 — Fuel */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-1"
              style={{ background: "var(--bg-card)", border: "1px solid var(--brand-border)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--brand-pale)", color: "var(--brand)" }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.35 2.7A2 2 0 007.5 19h9a2 2 0 001.85-2.3L17 13" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--brand)" }}>
                    Fuel
                  </h4>
                  <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                    {units === "kgs" ? "Kilograms" : "Pounds"}
                  </p>
                </div>
                {/* Large block fuel highlight */}
                <div className="ml-auto text-right">
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>Block</div>
                  <div className="text-base font-black font-mono" style={{ color: "var(--text-main)" }}>
                    {formatWeight(ofpData.fuel?.plan_ramp, units)}
                  </div>
                </div>
              </div>
              <MetricRow label="Trip Fuel" value={formatWeight(ofpData.fuel?.enroute_burn, units)} />
              <MetricRow label="Taxi Fuel" value={formatWeight(ofpData.fuel?.taxi, units)} />
              <MetricRow label="Landing Fuel" value={formatWeight(ofpData.fuel?.est_ldg, units)} />
              <MetricRow label="Contingency" value={formatWeight(ofpData.fuel?.contingency, units)} />
            </div>

            {/* Card 2 — Weights */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-1"
              style={{ background: "var(--bg-card)", border: "1px solid var(--brand-border)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--brand-pale)", color: "var(--brand)" }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--brand)" }}>
                    Weights
                  </h4>
                  <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                    {units === "kgs" ? "Kilograms" : "Pounds"}
                  </p>
                </div>
                {/* PAX count */}
                <div className="ml-auto text-right">
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>PAX</div>
                  <div className="text-base font-black font-mono" style={{ color: "var(--text-main)" }}>
                    {ofpData.weights?.pax_count_actual || ofpData.weights?.pax_count || "—"}
                  </div>
                </div>
              </div>
              <MetricRow label="Payload" value={formatWeight(ofpData.weights?.payload, units)} />
              <MetricRow label="ZFW" value={formatWeight(ofpData.weights?.est_zfw, units)} />
              <MetricRow label="TOW" value={formatWeight(ofpData.weights?.est_tow, units)} accent large />
              <MetricRow label="LAW" value={formatWeight(ofpData.weights?.est_ldw, units)} />
            </div>

            {/* Card 3 — Departure & Arrival compact */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-1 md:col-span-2 xl:col-span-1"
              style={{ background: "var(--bg-card)", border: "1px solid var(--brand-border)" }}
            >
              {/* Departure section */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--brand-pale)", color: "var(--brand)" }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--brand)" }}>
                  Departure
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-x-4 pb-3" style={{ borderBottom: "1px solid var(--border-main)" }}>
                <div className="flex flex-col gap-2">
                  <MetricRow label="Origin" value={ofpData.origin?.icao_code} />
                  <MetricRow label="SID" value={ofpData.general?.sid_ident} />
                </div>
                <div className="flex flex-col gap-2">
                  <MetricRow label="Runway" value={ofpData.origin?.plan_rwy} />
                  <MetricRow label="ETD" value={formatTimestampToTime(ofpData.times?.est_out)} accent />
                </div>
              </div>

              {/* Arrival section */}
              <div className="flex items-center gap-2 mt-2 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--brand-pale)", color: "var(--brand)" }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h4 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--brand)" }}>
                  Arrival
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                <div className="flex flex-col gap-2">
                  <MetricRow label="Dest" value={ofpData.destination?.icao_code} />
                  <MetricRow label="STAR" value={ofpData.general?.star_ident} />
                </div>
                <div className="flex flex-col gap-2">
                  <MetricRow label="Runway" value={ofpData.destination?.plan_rwy} />
                  <MetricRow label="ETA" value={formatTimestampToTime(ofpData.times?.est_in)} accent />
                </div>
              </div>
            </div>
          </div>

          {/* ── INFO PILL STRIP ───────────────────────────────────────────── */}
          <div
            className="flex flex-wrap gap-2 px-4 py-3 rounded-xl"
            style={{
              background: "var(--bg-slate)",
              border: "1px solid var(--brand-border)",
            }}
          >
            {[
              { label: "Flight", value: flightNum },
              { label: "Route", value: `${ofpData.origin?.icao_code || "—"} ➔ ${ofpData.destination?.icao_code || "—"}` },
              { label: "Aircraft", value: ofpData.aircraft?.icao_code },
              { label: "Distance", value: ofpData.general?.route_distance ? `${ofpData.general.route_distance} NM` : "—" },
              {
                label: "Flight Time",
                value: ofpData.times?.est_time_enroute
                  ? `${Math.floor(ofpData.times.est_time_enroute / 3600)}h ${Math.round((ofpData.times.est_time_enroute % 3600) / 60)}m`
                  : "—",
              },
            ].map((chip) => (
              <div
                key={chip.label}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                style={{
                  background: "var(--brand-pale)",
                  border: "1px solid var(--brand-border)",
                }}
              >
                <span className="font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {chip.label}:
                </span>
                <span className="font-black font-mono" style={{ color: "var(--brand)" }}>
                  {chip.value || "—"}
                </span>
              </div>
            ))}
          </div>

          {/* ── PDF VIEWER ────────────────────────────────────────────────── */}
          <div
            id="pdf-viewer-container"
            className="relative flex flex-col overflow-hidden rounded-2xl shadow-lg"
            style={{
              background: "var(--bg-slate)",
              border: "1px solid var(--brand-border)",
              height: "750px",
            }}
          >
            {/* Floating PDF toolbar */}
            <div
              className="absolute right-4 top-4 z-10 flex items-center gap-1 px-2 py-1.5 rounded-xl shadow-lg"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--brand-border)",
              }}
            >
              <button
                onClick={handleRefreshOfp}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Refresh OFP"
                style={{ color: "var(--text-sub)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--brand)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-sub)")}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" />
                </svg>
              </button>
              <a
                href={getPdfUrl()}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg transition-colors inline-block"
                title="Open in New Tab"
                style={{ color: "var(--text-sub)" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <a
                href={getPdfUrl()}
                download
                className="p-1.5 rounded-lg transition-colors inline-block"
                title="Download PDF"
                style={{ color: "var(--text-sub)" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
              <button
                onClick={handleToggleFullscreen}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Fullscreen"
                style={{ color: "var(--text-sub)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--brand)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-sub)")}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5m-11 11h4m-4 0v-4m0 4l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              </button>
            </div>

            {pdfLoadError ? (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4"
                style={{ background: "var(--bg-card)" }}
              >
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: "var(--text-muted)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div>
                  <h4 className="font-bold" style={{ color: "var(--text-main)" }}>
                    Unable to display PDF directly
                  </h4>
                  <p className="text-sm mt-1 max-w-sm mx-auto leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    Your browser's PDF plug-in might be blocked. Click below to view the OFP in a new window.
                  </p>
                </div>
                <a
                  href={getPdfUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-brand text-white hover:bg-brand-dark font-bold text-sm px-5 py-2.5 rounded-xl transition-colors inline-block shadow-sm"
                >
                  Open PDF in New Window
                </a>
              </div>
            ) : (
              <iframe
                src={`${getPdfUrl()}#toolbar=1&zoom=100`}
                className="w-full h-full border-0 rounded-2xl"
                title="SimBrief OFP Viewer"
                onError={() => setPdfLoadError(true)}
              />
            )}
          </div>
        </>


      ) : (
        /* ════════════════════════════════════════════════════════════════════
           BOOKING PLAN VIEW
        ════════════════════════════════════════════════════════════════════ */
        <>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                style={{ background: "var(--brand)", color: "#fff" }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-wide leading-none" style={{ color: "var(--text-main)" }}>
                  Flight Dispatch & Briefing
                </h3>
                <p className="text-[10px] mt-0.5 uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>
                  Booking-Based Plan
                </p>
              </div>
            </div>
            {activeBooking && (
              <div className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-200 font-bold dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                ✓ Active Roster Flight
              </div>
            )}
          </div>

          {activeBooking ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Booking & Route Details */}
              <div
                className="lg:col-span-2 rounded-2xl p-6 flex flex-col gap-6"
                style={{ background: "var(--bg-card)", border: "1px solid var(--brand-border)" }}
              >
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: "var(--brand)" }}>
                    Flight Parameters
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                    <div>
                      <MetricRow label="Flight Number" value={activeBooking.flight_number} />
                      <MetricRow label="Aircraft Type" value={activeBooking.aircraft_icao} accent />
                      <MetricRow label="Registration" value={activeBooking.aircraft_registration} />
                    </div>
                    <div>
                      <MetricRow label="Origin" value={activeBooking.flight_departure} />
                      <MetricRow label="Destination" value={activeBooking.flight_arrival} />
                      <MetricRow
                        label="Sched. Departure"
                        value={
                          activeBooking.flight_scheduled_dep
                            ? new Date(activeBooking.flight_scheduled_dep).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "UTC",
                              }) + " UTC"
                            : "—"
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Performance Controls */}
                <div
                  className="rounded-xl p-4 space-y-4"
                  style={{ background: "var(--bg-slate)", border: "1px solid var(--brand-border)" }}
                >
                  <h5 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    Aircraft Adjustments
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <div className="flex justify-between items-center text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                        <span>Payload Load %</span>
                        <span className="font-black" style={{ color: "var(--brand)" }}>{activeLoad}%</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={activeLoad}
                        onChange={(e) =>
                          setActiveLoad(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))
                        }
                        className="text-sm font-semibold rounded-lg px-3 py-1.5 w-full focus:outline-none focus:border-brand"
                        style={{
                          background: "var(--bg-card)",
                          color: "var(--text-main)",
                          border: "1px solid var(--brand-border)",
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                        <span>Plan Cruise Altitude</span>
                        <span className="font-black font-mono" style={{ color: "var(--brand)" }}>
                          FL{Math.round(activeCruiseAlt / 100)}
                        </span>
                      </div>
                      <div
                        className="text-sm font-semibold rounded-lg px-3 py-1.5 w-full select-none cursor-not-allowed"
                        style={{ background: "var(--bg-slate)", color: "var(--text-muted)", border: "1px solid var(--border-main)" }}
                      >
                        FL{Math.round(activeCruiseAlt / 100)} (Auto-assigned)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SimBrief Sync Box */}
              <div
                className="rounded-2xl p-6 flex flex-col justify-between gap-4"
                style={{ background: "var(--bg-card)", border: "1px solid var(--brand-border)" }}
              >
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--brand)" }}>
                    SimBrief Connection
                  </h4>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    To sync your flight planning data and view your official SimBrief PDF dispatch release inside this EFB, ensure your SimBrief Pilot ID is linked to your account.
                  </p>
                  <div
                    className="rounded-xl p-3.5 text-center text-xs font-medium"
                    style={{ background: "var(--bg-slate)", border: "1px solid var(--brand-border)", color: "var(--text-muted)" }}
                  >
                    Your SimBrief ID is managed securely by flight operations staff. Contact staff to register or change it.
                  </div>
                  {activeBooking && (
                    <a
                      href={`https://www.simbrief.com/system/dispatch.php?orig=${activeBooking.flight_departure}&dest=${activeBooking.flight_arrival}&pax=${activeBooking.pax_count || 150}&type=${getSimBriefAircraftType(activeBooking.aircraft_icao)}&flt=${activeBooking.flight_number?.replace(/\D/g, "") || "100"}&airline=${activeBooking.flight_number?.replace(/\d/g, "") || "QR"}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-red-600 to-red-800 text-white font-bold text-xs px-4 py-2.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all w-full"
                    >
                      🔗 Pre-fill SimBrief Flight ({activeBooking.pax_count} Pax)
                    </a>
                  )}
                </div>
                <div className="text-[11px] pt-4" style={{ borderTop: "1px solid var(--brand-border)", color: "var(--text-muted)" }}>
                  💡 Tip: The co-pilot checklist and weather tabs are fully functional without SimBrief linking.
                </div>
              </div>
            </div>
          ) : (
            <div
              className="text-center py-16 px-4 max-w-md mx-auto rounded-3xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--brand-border)" }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: "var(--brand-pale)", border: "1px solid var(--brand-border)" }}
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: "var(--brand)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold" style={{ color: "var(--brand)" }}>
                No Active Booking Found
              </h3>
              <p className="text-sm mt-2 max-w-sm mx-auto leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Please book a flight schedule on the bookings dashboard first, or contact staff to update your registered SimBrief Pilot ID.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
