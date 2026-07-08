// ─────────────────────────────────────────────
//  EFBWeather — Orchestrator
//  Handles: API fetching, state, tab navigation,
//  runway list management, and layout assembly.
//
//  Redesigned to pass the aircraft ICAO code down
//  for top-view silhouette wind calculations.
// ─────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import { AircraftWindCard } from "./AircraftWindCard";
import {
  getReciprocalRunway,
  getFltCatProps,
  getRelativeHumidity,
  parseGustKt,
} from "./WindCalculations";
import type { MetarReport, TafReport, DatabaseRunway } from "./types";

// ─── Props ────────────────────────────────────

export interface EFBWeatherProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ofpData:        any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeBooking?: any;
}

// ─── Helpers ──────────────────────────────────

type TabId = "departure" | "arrival" | "alternate" | "search";

// ─── Component ───────────────────────────────

export default function EFBWeather({ ofpData, activeBooking }: EFBWeatherProps) {
  // ── Derived ICAO codes from props ────────────
  const depIcao = (ofpData as any)?.origin?.icao_code      || (activeBooking as any)?.flight_departure || "";
  const arrIcao = (ofpData as any)?.destination?.icao_code || (activeBooking as any)?.flight_arrival   || "";
  const altIcao = (ofpData as any)?.alternate?.icao_code   || "";

  // ── Derived Aircraft ICAO code from props ────
  const aircraftIcao = (
    (ofpData as any)?.aircraft?.icao_code ||
    (activeBooking as any)?.aircraft_icao ||
    "generic"
  ).toUpperCase();

  // ── UI state ─────────────────────────────────
  const [activeTab,        setActiveTab]        = useState<TabId>("departure");
  const [searchIcao,       setSearchIcao]       = useState("");
  const [loadedIcao,       setLoadedIcao]       = useState("");

  // ── Weather data ─────────────────────────────
  const [metarList,        setMetarList]        = useState<MetarReport[]>([]);
  const [selectedMetarIdx, setSelectedMetarIdx] = useState(0);
  const [taf,              setTaf]              = useState<TafReport | null>(null);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState<string | null>(null);

  // ── Runway state ─────────────────────────────
  const [customRunways,    setCustomRunways]    = useState<string[]>([]);
  const [newRunway,        setNewRunway]        = useState("");
  const [databaseRunways,  setDatabaseRunways]  = useState<DatabaseRunway[]>([]);

  // Derived
  const metar = metarList[selectedMetarIdx] ?? null;

  // ── ICAO resolution ───────────────────────────
  const getIcaoForTab = (tab: TabId): string => {
    switch (tab) {
      case "departure": return depIcao;
      case "arrival":   return arrIcao;
      case "alternate": return altIcao;
      case "search":    return searchIcao;
    }
  };

  const activeIcao = getIcaoForTab(activeTab);

  // ── Weather fetch ─────────────────────────────
  const fetchWeather = async (icao: string) => {
    if (!icao || icao.length !== 4) return;
    setLoading(true);
    setError(null);
    setLoadedIcao(icao.toUpperCase());
    setDatabaseRunways([]);

    try {
      const cleanIcao = icao.trim().toUpperCase();
      const res       = await fetch(`/api/efb/weather?icao=${cleanIcao}`);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as any).detail || `Failed to fetch weather for ${cleanIcao}`,
        );
      }

      const data = await res.json();

      if (!data.metars || data.metars.length === 0) {
        throw new Error(`No weather report available for ${cleanIcao}`);
      }

      setMetarList(data.metars as MetarReport[]);
      setSelectedMetarIdx(0);
      setTaf(data.taf as TafReport | null);

      // Concurrent runway fetch (non-fatal)
      try {
        const rRes = await fetch(`/api/efb/runways?icao=${cleanIcao}`);
        if (rRes.ok) {
          const rData = await rRes.json();
          setDatabaseRunways(rData as DatabaseRunway[]);
        }
      } catch (rwyErr) {
        console.error("Runway fetch failed:", rwyErr);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load weather.";
      console.error("Weather fetch error:", err);
      setError(msg);
      setMetarList([]);
      setTaf(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when tab / airport codes change
  useEffect(() => {
    if (activeTab !== "search") {
      const icao = getIcaoForTab(activeTab);
      if (icao) fetchWeather(icao);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, depIcao, arrIcao, altIcao]);

  // ── Form handlers ────────────────────────────
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchIcao.length === 4) {
      fetchWeather(searchIcao);
    } else {
      setError("Please enter a valid 4-letter ICAO code.");
    }
  };

  const handleAddRunway = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newRunway.trim().toUpperCase();
    if (/^\d{2}[LRC]?$/i.test(cleaned) && !customRunways.includes(cleaned)) {
      setCustomRunways((prev) => [...prev, cleaned]);
    }
    setNewRunway("");
  };

  const handleRemoveRunway = (rwy: string) => {
    setCustomRunways((prev) => prev.filter((r) => r !== rwy));
  };

  const handleAddDatabaseRunway = (val: string) => {
    if (val && !customRunways.includes(val)) {
      setCustomRunways((prev) => [...prev, val]);
    }
  };

  // ── Runway list ──────────────────────────────
  const planRwy      = activeTab === "departure"
    ? (ofpData as any)?.general?.orig_rwy ?? null
    : activeTab === "arrival"
    ? (ofpData as any)?.general?.dest_rwy ?? null
    : null;

  const planRwyRecip = planRwy ? getReciprocalRunway(planRwy) : null;

  const runways: string[] = (() => {
    const list: string[] = [];
    if (planRwy)      list.push(planRwy as string);
    if (planRwyRecip) list.push(planRwyRecip);
    customRunways.forEach((r) => {
      if (!list.includes(r.toUpperCase())) list.push(r.toUpperCase());
    });
    return list;
  })();

  // ── Derived display values ───────────────────
  const fltCat = getFltCatProps(metar?.fltCat);
  const rh     = getRelativeHumidity(metar?.temp, metar?.dewp);

  // ── Render ────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Airport Selector Tabs ──────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50 rounded-2xl border border-brand-border p-3">
        <div className="flex flex-wrap gap-1 w-full sm:w-auto">
          {(
            [
              ["departure", `Departure (${depIcao || "—"})`],
              ["arrival",   `Arrival (${arrIcao   || "—"})`],
              ["alternate", `Alternate (${altIcao || "—"})`],
              ["search",    "Search Custom ICAO"],
            ] as [TabId, string][]
          ).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => {
                if (tab === "search") {
                  setMetarList([]);
                  setTaf(null);
                }
                setActiveTab(tab);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === tab
                  ? "bg-brand text-white shadow-sm"
                  : "text-gray-500 hover:bg-brand-hover-bg hover:text-brand"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "search" && (
          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              maxLength={4}
              placeholder="e.g. EGLL"
              value={searchIcao}
              onChange={(e) => setSearchIcao(e.target.value.toUpperCase())}
              className="bg-white border border-brand-border text-gray-800 font-mono font-bold text-xs uppercase px-3 py-1.5 rounded-xl w-24 focus:outline-none focus:border-brand"
            />
            <button
              type="submit"
              className="bg-brand text-white hover:bg-brand-dark px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              Get Weather
            </button>
          </form>
        )}
      </div>

      {/* ── Body states ───────────────────────── */}
      {loading ? (
        <LoadingState icao={loadedIcao} />
      ) : error ? (
        <ErrorState
          error={error}
          activeIcao={activeIcao}
          loadedIcao={loadedIcao}
          onRetry={() => fetchWeather(activeIcao)}
        />
      ) : metar ? (
        <WeatherBody
          metar={metar}
          metarList={metarList}
          selectedMetarIdx={selectedMetarIdx}
          onSelectMetar={setSelectedMetarIdx}
          taf={taf}
          loadedIcao={loadedIcao}
          fltCat={fltCat}
          rh={rh}
          runways={runways}
          planRwy={planRwy as string | null}
          customRunways={customRunways}
          databaseRunways={databaseRunways}
          newRunway={newRunway}
          onNewRunwayChange={setNewRunway}
          onAddRunway={handleAddRunway}
          onRemoveRunway={handleRemoveRunway}
          onAddDatabaseRunway={handleAddDatabaseRunway}
          aircraftIcao={aircraftIcao}
        />
      ) : (
        <EmptyState />
      )}

    </div>
  );
}

// ─────────────────────────────────────────────
//  Sub-panels (kept in same file to minimise prop drilling)
// ─────────────────────────────────────────────

function LoadingState({ icao }: { icao: string }) {
  return (
    <div className="text-center py-20 flex flex-col items-center justify-center space-y-4">
      <div className="w-10 h-10 border-4 border-brand-border border-t-brand rounded-full animate-spin" />
      <div className="text-xs font-bold text-gray-500 tracking-wide">
        Fetching meteorological data for {icao}…
      </div>
    </div>
  );
}

function ErrorState({
  error,
  activeIcao,
  loadedIcao,
  onRetry,
}: {
  error:      string;
  activeIcao: string;
  loadedIcao: string;
  onRetry:    () => void;
}) {
  const isNoStation =
    error.includes("No weather report") || error.includes("404");

  if (isNoStation) {
    return (
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl p-6 text-center max-w-md mx-auto shadow-sm">
        <svg className="w-10 h-10 text-blue-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.085 1.085l-.04.02-.086.041a.25.25 0 00-.095.218v1.73a.25.25 0 00.25.25h.75a.75.75 0 010 1.5h-.75a2.25 2.25 0 01-2.25-2.25v-1.73a2.25 2.25 0 011.185-1.985zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" />
        </svg>
        <h4 className="text-sm font-bold uppercase tracking-wide">No Reporting Station</h4>
        <p className="text-xs mt-1.5 leading-relaxed">
          {loadedIcao} does not currently publish METAR observations. This is normal for smaller or military airfields.
        </p>
        <p className="text-xs mt-1.5 text-gray-500 font-medium">
          Try checking your Departure/Arrival airport weather, or search for a nearby major airport.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-2xl p-6 text-center max-w-md mx-auto shadow-sm">
      <svg className="w-10 h-10 text-orange-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <h4 className="text-sm font-bold uppercase tracking-wide">Connection Issue (NOAA API)</h4>
      <p className="text-xs mt-1.5 leading-relaxed">
        A temporary network timeout occurred while fetching reports from aviationweather.gov (Error: {error}).
      </p>
      <button
        onClick={onRetry}
        className="mt-4 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
      >
        🔄 Retry Connection
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 bg-gray-50 border border-brand-border rounded-2xl text-gray-500 font-semibold text-sm">
      Select an airport or search a custom ICAO to load meteorological reports.
    </div>
  );
}

// ─── Main weather body ───────────────────────

interface WeatherBodyProps {
  metar:            MetarReport;
  metarList:        MetarReport[];
  selectedMetarIdx: number;
  onSelectMetar:    (idx: number) => void;
  taf:              TafReport | null;
  loadedIcao:       string;
  fltCat:           { bg: string; label: string };
  rh:               number | null;
  runways:          string[];
  planRwy:          string | null;
  customRunways:    string[];
  databaseRunways:  DatabaseRunway[];
  newRunway:        string;
  onNewRunwayChange:(v: string) => void;
  onAddRunway:      (e: React.FormEvent) => void;
  onRemoveRunway:   (rwy: string) => void;
  onAddDatabaseRunway: (val: string) => void;
  aircraftIcao:     string;
}

function WeatherBody({
  metar,
  metarList,
  selectedMetarIdx,
  onSelectMetar,
  taf,
  loadedIcao,
  fltCat,
  rh,
  runways,
  planRwy,
  customRunways,
  databaseRunways,
  newRunway,
  onNewRunwayChange,
  onAddRunway,
  onRemoveRunway,
  onAddDatabaseRunway,
  aircraftIcao,
}: WeatherBodyProps) {
  return (
    <div className="space-y-6">

      {/* ── Top panel: Decoded + Raw ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Decoded Meteorological Grid */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-brand-border shadow-sm p-5 space-y-5">

          {/* Station header + flight category */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-brand-border pb-3.5">
            <div>
              <h3 className="text-lg font-bold text-brand">
                {metar.name || loadedIcao}
              </h3>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                DECODED WEATHER REPORT
              </span>
            </div>
            <div className={`px-3 py-1 text-xs font-bold rounded-full border ${fltCat.bg}`}>
              {fltCat.label}
            </div>
          </div>

          {/* METAR Trend Timeline */}
          {metarList.length > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50 border border-brand-border rounded-xl p-2.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide px-1">
                ⏱️ METAR Trend Timeline:
              </span>
              <div className="flex gap-1.5 w-full sm:w-auto">
                {metarList.map((m, idx) => {
                  const timeStr = m.reportTime
                    ? m.reportTime.split("T")[1].substring(0, 5) + "Z"
                    : "Obs";
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSelectMetar(idx)}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex-1 sm:flex-none ${
                        selectedMetarIdx === idx
                          ? "bg-brand text-white shadow-sm"
                          : "bg-white text-gray-600 border border-brand-border hover:bg-brand-hover-bg"
                      }`}
                    >
                      {idx === 0
                        ? `Latest (${timeStr})`
                        : idx === 1
                        ? `Previous (${timeStr})`
                        : `Historic (${timeStr})`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Data grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">

            {/* Wind */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">
                Wind Condition
              </span>
              <span className="text-sm font-bold text-gray-800 block">
                {metar.wdir ? `${String(metar.wdir).padStart(3, "0")}°` : "VRB"} @ {metar.wspd || 0} KT
              </span>
              {parseGustKt(metar.rawOb) && (
                <span className="text-[10px] text-red-500 font-bold bg-red-50 border border-red-100 px-2 py-0.5 rounded-full inline-block">
                  💨 Gusts: {parseGustKt(metar.rawOb)} KT
                </span>
              )}
            </div>

            {/* Temperature / Dewpoint */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">
                Temperature / Dewpoint
              </span>
              <span className="text-sm font-bold text-gray-800 block">
                {metar.temp}°C / {metar.dewp}°C
              </span>
              {rh !== null && (
                <span className="text-[10px] text-gray-400 block font-semibold">
                  Humidity: {rh}% (Spread: {Math.round(metar.temp - metar.dewp)}°C)
                </span>
              )}
            </div>

            {/* Altimeter */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">
                Altimeter Settings
              </span>
              <span className="text-sm font-bold text-gray-800 block">
                {metar.altim ? `${Math.round(metar.altim)} hPa` : "—"}
              </span>
              {metar.altim && (
                <span className="text-[10px] text-brand block font-mono font-bold">
                  {(metar.altim * 0.02953007).toFixed(2)} inHg
                </span>
              )}
            </div>

            {/* Visibility */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">
                Visibility
              </span>
              <span className="text-sm font-bold text-gray-800 block">
                {metar.visib} SM
              </span>
            </div>

            {/* Cloud layers */}
            <div className="space-y-1 col-span-2">
              <span className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">
                Cloud Layers
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {metar.clouds && metar.clouds.length > 0 ? (
                  metar.clouds.map((cloud: { cover: string; base?: number | null }, idx: number) => (
                    <span
                      key={idx}
                      className="bg-gray-100 text-gray-600 text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 font-bold uppercase"
                    >
                      {cloud.cover} @ {cloud.base ? `${cloud.base.toLocaleString()} FT` : "—"}
                    </span>
                  ))
                ) : (
                  <span className="bg-green-50 text-green-700 text-[10px] px-2.5 py-1 rounded-lg border border-green-100 font-bold uppercase">
                    Clear Sky (CAVOK)
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Raw Meteorological Strings */}
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5 space-y-4">
          <h4 className="text-xs font-bold text-brand tracking-wider uppercase border-b border-brand-border pb-2">
            📄 Raw Meteorological Strings
          </h4>
          <div className="space-y-3 font-mono text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-400 block">METAR</span>
              <div className="bg-gray-50 border border-brand-border rounded-xl p-3.5 text-gray-700 select-all leading-relaxed whitespace-pre-wrap">
                {metar.rawOb}
              </div>
            </div>
            {taf && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 block">TAF FORECAST</span>
                <div className="bg-gray-50 border border-brand-border rounded-xl p-3.5 text-gray-700 select-all leading-relaxed whitespace-pre-wrap">
                  {taf.rawTAF}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Bottom panel: Runway Wind Vectors ───── */}
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6 space-y-6">

        {/* Panel header + controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-brand-border pb-4">
          <div>
            <h3 className="text-lg font-bold text-brand">🛬 Runway Wind Vectors</h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
              TAKE-OFF &amp; LANDING ANALYSIS
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center shrink-0">

            {/* Database runway picker */}
            {databaseRunways.length > 0 && (
              <select
                onChange={(e) => {
                  onAddDatabaseRunway(e.target.value);
                  e.target.value = "";
                }}
                defaultValue=""
                className="bg-white border border-brand-border text-gray-800 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:border-brand cursor-pointer w-full sm:w-52"
              >
                <option value="" disabled>— Add Airport Runway —</option>
                {databaseRunways.map((dbRwy) => {
                  const isAdded = runways.includes(dbRwy.designator);
                  return (
                    <option
                      key={dbRwy.designator}
                      value={dbRwy.designator}
                      disabled={isAdded}
                    >
                      Runway {dbRwy.designator} ({dbRwy.length_ft.toLocaleString()} ft)
                    </option>
                  );
                })}
              </select>
            )}

            {/* Custom runway input */}
            <form onSubmit={onAddRunway} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                maxLength={3}
                placeholder="Custom e.g. 09L"
                value={newRunway}
                onChange={(e) => onNewRunwayChange(e.target.value)}
                className="bg-white border border-brand-border text-gray-800 font-mono font-bold text-xs uppercase px-3 py-2 rounded-xl focus:outline-none focus:border-brand w-full sm:w-44"
              />
              <button
                type="submit"
                className="bg-brand text-white hover:bg-brand-dark px-3 py-2 text-xs font-bold rounded-xl shadow-sm transition-colors shrink-0"
              >
                ➕ Add
              </button>
            </form>
          </div>
        </div>

        {/* Runway card grid */}
        {runways.length === 0 ? (
          <p className="text-xs text-gray-400 font-semibold text-center py-6">
            No runways selected. Add one from the dropdown or enter a custom designator above.
          </p>
        ) : (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
            {runways.map((rwy, idx) => {
              const isCustom = customRunways.includes(rwy) ||
                databaseRunways.some((dr) => dr.designator === rwy);
              const dbRwyInfo = databaseRunways.find(
                (dr) => dr.designator === rwy,
              );
              return (
                <AircraftWindCard
                  key={`${rwy}-${idx}`}
                  rwy={rwy}
                  metar={metar}
                  planRwy={planRwy}
                  dbRwyInfo={dbRwyInfo}
                  isCustom={isCustom}
                  onRemove={onRemoveRunway}
                  aircraftIcao={aircraftIcao}
                  uid={`${rwy}-${idx}`}
                />
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
