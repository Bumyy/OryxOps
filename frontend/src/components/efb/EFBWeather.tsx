import React, { useState, useEffect } from "react";

export interface EFBWeatherProps {
  ofpData: any;
}

export default function EFBWeather({ ofpData }: EFBWeatherProps) {
  const depIcao = ofpData?.origin?.icao_code || "";
  const arrIcao = ofpData?.destination?.icao_code || "";
  const altIcao = ofpData?.alternate?.icao_code || "";

  const [activeTab, setActiveTab] = useState<"departure" | "arrival" | "alternate" | "search">("departure");
  const [searchIcao, setSearchIcao] = useState("");
  const [loadedIcao, setLoadedIcao] = useState("");
  
  const [metarList, setMetarList] = useState<any[]>([]);
  const [selectedMetarIdx, setSelectedMetarIdx] = useState(0);
  const [taf, setTaf] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metar = metarList[selectedMetarIdx] || null;

  // Runway list state
  const [customRunways, setCustomRunways] = useState<string[]>([]);
  const [newRunway, setNewRunway] = useState("");

  // Determine which ICAO code to fetch
  const getIcaoForTab = (tab: typeof activeTab) => {
    switch (tab) {
      case "departure": return depIcao;
      case "arrival": return arrIcao;
      case "alternate": return altIcao;
      case "search": return searchIcao;
      default: return "";
    }
  };

  const activeIcao = getIcaoForTab(activeTab);

  const fetchWeather = async (icao: string) => {
    if (!icao || icao.length !== 4) return;
    setLoading(true);
    setError(null);
    setLoadedIcao(icao.toUpperCase());

    try {
      const cleanIcao = icao.trim().toUpperCase();
      const res = await fetch(`/api/efb/weather?icao=${cleanIcao}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to fetch weather reports for ${cleanIcao}`);
      }

      const data = await res.json();

      if (!data.metars || data.metars.length === 0) {
        throw new Error(`No weather report available for ${cleanIcao}`);
      }

      setMetarList(data.metars);
      setSelectedMetarIdx(0);
      setTaf(data.taf);
    } catch (err: any) {
      console.error("Weather fetch error:", err);
      setError(err.message || "Failed to load weather reports.");
      setMetarList([]);
      setTaf(null);
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when tab switches (excluding typing search)
  useEffect(() => {
    if (activeTab !== "search") {
      const icao = getIcaoForTab(activeTab);
      if (icao) fetchWeather(icao);
    }
  }, [activeTab, depIcao, arrIcao, altIcao]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchIcao.length === 4) {
      fetchWeather(searchIcao);
    } else {
      setError("Please enter a valid 4-letter ICAO code.");
    }
  };

  // Calculate reciprocal runway designator (e.g. 15L -> 33R)
  const getReciprocalRunway = (rwy: string): string => {
    const match = rwy.trim().match(/^(\d+)([LRC]?)$/i);
    if (!match) return "";
    const num = parseInt(match[1], 10);
    const letter = match[2].toUpperCase();
    
    let recipNum = num <= 18 ? num + 18 : num - 18;
    const recipNumStr = recipNum < 10 ? `0${recipNum}` : `${recipNum}`;
    
    let recipLetter = letter;
    if (letter === "L") recipLetter = "R";
    else if (letter === "R") recipLetter = "L";
    
    return `${recipNumStr}${recipLetter}`;
  };

  // Calculate wind vectors
  const getWindVectors = (rwy: string, windDir: number | string, windSpeed: number) => {
    const match = rwy.trim().match(/^(\d+)/);
    if (!match) return null;
    const rwyHeading = parseInt(match[1], 10) * 10;

    // Handle variable winds (e.g. VRB05KT)
    let parsedWindDir = 0;
    if (typeof windDir === "string" || isNaN(Number(windDir))) {
      return { headwind: 0, crosswind: 0, isVariable: true };
    } else {
      parsedWindDir = Number(windDir);
    }
    
    let diff = parsedWindDir - rwyHeading;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    
    const angleRad = diff * (Math.PI / 180);
    const headwind = Math.round(windSpeed * Math.cos(angleRad));
    const crosswind = Math.round(windSpeed * Math.sin(angleRad));
    
    return {
      headwind,
      crosswind,
      isVariable: false,
      relativeAngle: diff
    };
  };

  // Extract planned runway from SimBrief OFP context
  const getPlannedRunway = (): string | null => {
    if (activeTab === "departure") return ofpData?.general?.orig_rwy || null;
    if (activeTab === "arrival") return ofpData?.general?.dest_rwy || null;
    return null;
  };

  const planRwy = getPlannedRunway();
  const planRwyRecip = planRwy ? getReciprocalRunway(planRwy) : null;

  // Compile runway list to display
  const getDisplayRunways = (): string[] => {
    const list: string[] = [];
    if (planRwy) list.push(planRwy);
    if (planRwyRecip) list.push(planRwyRecip);
    
    customRunways.forEach(r => {
      if (!list.includes(r.toUpperCase())) {
        list.push(r.toUpperCase());
      }
    });
    return list;
  };

  const runways = getDisplayRunways();

  const handleAddRunway = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRwy = newRunway.trim().toUpperCase();
    if (/^\d{2}[LRC]?$/i.test(cleanRwy)) {
      if (!customRunways.includes(cleanRwy)) {
        setCustomRunways(prev => [...prev, cleanRwy]);
      }
      setNewRunway("");
    }
  };

  const handleRemoveCustomRunway = (rwy: string) => {
    setCustomRunways(prev => prev.filter(r => r !== rwy));
  };

  // Relative humidity calculation
  const getRelativeHumidity = (temp?: number, dewp?: number) => {
    if (temp === undefined || dewp === undefined) return null;
    try {
      return Math.round(100 * Math.pow(10, (7.59 * dewp) / (dewp + 240.7) - (7.59 * temp) / (temp + 240.7)));
    } catch {
      return null;
    }
  };

  // Flight Category styling properties
  const getFltCatProps = (cat?: string) => {
    switch (cat?.toUpperCase()) {
      case "VFR":
        return { bg: "bg-green-100 border-green-200 text-green-700", label: "Visual Flight Rules (VFR)" };
      case "MVFR":
        return { bg: "bg-blue-100 border-blue-200 text-blue-700", label: "Marginal Visual Flight Rules (MVFR)" };
      case "IFR":
        return { bg: "bg-red-100 border-red-200 text-red-700", label: "Instrument Flight Rules (IFR)" };
      case "LIFR":
        return { bg: "bg-purple-100 border-purple-200 text-purple-700", label: "Low Instrument Flight Rules (LIFR)" };
      default:
        return { bg: "bg-gray-100 border-gray-200 text-gray-700", label: "Unknown Conditions" };
    }
  };

  const fltCat = getFltCatProps(metar?.fltCat);
  const rh = getRelativeHumidity(metar?.temp, metar?.dewp);

  return (
    <div className="space-y-6">
      
      {/* Top Airport selection tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50 rounded-2xl border border-brand-border p-3">
        <div className="flex flex-wrap gap-1 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("departure")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "departure"
                ? "bg-brand text-white shadow-sm"
                : "text-gray-500 hover:bg-brand-hover-bg hover:text-brand"
            }`}
          >
            Departure ({depIcao || "—"})
          </button>
          <button
            onClick={() => setActiveTab("arrival")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "arrival"
                ? "bg-brand text-white shadow-sm"
                : "text-gray-500 hover:bg-brand-hover-bg hover:text-brand"
            }`}
          >
            Arrival ({arrIcao || "—"})
          </button>
          <button
            onClick={() => setActiveTab("alternate")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "alternate"
                ? "bg-brand text-white shadow-sm"
                : "text-gray-500 hover:bg-brand-hover-bg hover:text-brand"
            }`}
          >
            Alternate ({altIcao || "—"})
          </button>
          <button
            onClick={() => {
              setActiveTab("search");
              setMetarList([]);
              setTaf(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "search"
                ? "bg-brand text-white shadow-sm"
                : "text-gray-500 hover:bg-brand-hover-bg hover:text-brand"
            }`}
          >
            Search Custom ICAO
          </button>
        </div>

        {activeTab === "search" && (
          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              maxLength={4}
              placeholder="e.g. EGLL"
              value={searchIcao}
              onChange={e => setSearchIcao(e.target.value.toUpperCase())}
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

      {loading ? (
        <div className="text-center py-20 flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-brand-border border-t-brand rounded-full animate-spin"></div>
          <div className="text-xs font-bold text-gray-500 tracking-wide">Fetching meteorological data for {loadedIcao}...</div>
        </div>
      ) : error ? (
        error.includes("No weather report") || error.includes("404") ? (
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
        ) : (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-2xl p-6 text-center max-w-md mx-auto shadow-sm">
            <svg className="w-10 h-10 text-orange-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <h4 className="text-sm font-bold uppercase tracking-wide">Connection Issue (NOAA API)</h4>
            <p className="text-xs mt-1.5 leading-relaxed">
              A temporary network timeout occurred while fetching reports from aviationweather.gov (Error: {error}).
            </p>
            <button
              onClick={() => fetchWeather(activeIcao)}
              className="mt-4 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              🔄 Retry Connection
            </button>
          </div>
        )
      ) : metar ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Decoded weather info panel */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Decoded Meteorological Grid */}
            <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5 space-y-5">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-brand-border pb-3.5">
                <div>
                  <h3 className="text-lg font-bold text-brand">{metar.name || loadedIcao}</h3>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">DECODED WEATHER REPORT</span>
                </div>
                <div className={`px-3 py-1 text-xs font-bold rounded-full border ${fltCat.bg}`}>
                  {fltCat.label}
                </div>
              </div>

              {/* METAR Trend Selector */}
              {metarList.length > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50 border border-brand-border rounded-xl p-2.5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide px-1">⏱️ METAR Trend Timeline:</span>
                  <div className="flex gap-1.5 w-full sm:w-auto">
                    {metarList.map((m: any, idx: number) => {
                      const timeStr = m.reportTime ? m.reportTime.split("T")[1].substring(0, 5) + "Z" : "Obs";
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedMetarIdx(idx)}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex-1 sm:flex-none ${
                            selectedMetarIdx === idx
                              ? "bg-brand text-white shadow-sm"
                              : "bg-white text-gray-600 border border-brand-border hover:bg-brand-hover-bg"
                          }`}
                        >
                          {idx === 0 ? `Latest (${timeStr})` : idx === 1 ? `Previous (${timeStr})` : `Historic (${timeStr})`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                
                {/* Wind */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">WIND CONDITION</span>
                  <span className="text-sm font-bold text-gray-800 block">
                    {metar.wdir ? `${String(metar.wdir).padStart(3, "0")}°` : "VRB"} @ {metar.wspd || 0} KT
                  </span>
                  {metar.rawOb.match(/G(\d+)/) && (
                    <span className="text-[10px] text-red-500 font-bold bg-red-50 border border-red-100 px-2 py-0.5 rounded-full inline-block">
                      💨 Gusts: {metar.rawOb.match(/G(\d+)/)[1]} KT
                    </span>
                  )}
                </div>

                {/* Temp & Dewpoint */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">TEMPERATURE / DEWPOINT</span>
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
                  <span className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">ALTIMETER SETTINGS</span>
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
                  <span className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">VISIBILITY</span>
                  <span className="text-sm font-bold text-gray-800 block">
                    {metar.visib} SM
                  </span>
                </div>

                {/* Clouds */}
                <div className="space-y-1 col-span-2">
                  <span className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">CLOUD LAYERS</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {metar.clouds && metar.clouds.length > 0 ? (
                      metar.clouds.map((cloud: any, idx: number) => (
                        <span key={idx} className="bg-gray-100 text-gray-600 text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 font-bold uppercase">
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

            {/* Raw Reports Block */}
            <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5 space-y-4">
              <h4 className="text-xs font-bold text-brand tracking-wider uppercase border-b border-brand-border pb-2">📄 Raw Meteorological Strings</h4>
              
              <div className="space-y-3 font-mono text-xs">
                {/* METAR */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 block">METAR</span>
                  <div className="bg-gray-50 border border-brand-border rounded-xl p-3.5 text-gray-700 select-all leading-relaxed whitespace-pre-wrap">
                    {metar.rawOb}
                  </div>
                </div>

                {/* TAF */}
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

          {/* Performance: Headwind/Crosswind calculator */}
          <div className="space-y-6">
            
            <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5 space-y-5">
              
              <div>
                <h3 className="text-base font-bold text-brand">🏃 Runway Wind Vectors</h3>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">TAKE-OFF & LANDING ANALYSIS</span>
              </div>

              {/* Add Custom Runway form */}
              <form onSubmit={handleAddRunway} className="flex gap-2">
                <input
                  type="text"
                  maxLength={3}
                  placeholder="Runway e.g. 09L"
                  value={newRunway}
                  onChange={e => setNewRunway(e.target.value)}
                  className="bg-white border border-brand-border text-gray-800 font-mono font-bold text-xs uppercase px-3 py-2 rounded-xl flex-1 focus:outline-none focus:border-brand"
                />
                <button
                  type="submit"
                  className="bg-brand text-white hover:bg-brand-dark px-3 py-2 text-xs font-bold rounded-xl shadow-sm transition-colors"
                >
                  ➕ Add
                </button>
              </form>

              {/* Runway Wind component displays */}
              <div className="space-y-3">
                {runways.map((rwy, idx) => {
                  const isCustom = customRunways.includes(rwy);
                  const vectors = getWindVectors(rwy, metar.wdir, metar.wspd);
                  
                  if (!vectors) return null;

                  const isTailwind = vectors.headwind < 0;
                  const hwAbs = Math.abs(vectors.headwind);
                  const cwAbs = Math.abs(vectors.crosswind);
                  const cwDirection = vectors.crosswind < 0 ? "Left" : "Right";
                  
                  // Tailwind warning check (> 10 knots tailwind is risky)
                  const showTailwindWarning = isTailwind && hwAbs > 10;

                  return (
                    <div key={idx} className="bg-gray-50/50 border border-brand-border rounded-2xl p-4.5 space-y-3 relative">
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-brand font-mono">
                          RUNWAY {rwy}
                          {rwy === planRwy && (
                            <span className="ml-2 text-[9px] bg-brand/10 border border-brand/20 text-brand px-2 py-0.5 rounded-full font-bold uppercase">
                              PLANNED
                            </span>
                          )}
                        </span>
                        
                        {isCustom && (
                          <button
                            onClick={() => handleRemoveCustomRunway(rwy)}
                            className="text-gray-400 hover:text-red-500 text-xs p-1"
                            title="Remove Runway"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {vectors.isVariable ? (
                        <div className="text-xs font-semibold text-gray-500 italic">
                          Winds are variable. Check visual gusts.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          
                          {/* Headwind / Tailwind */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 block uppercase">LONGITUDINAL COMPONENT</span>
                            <span className={`text-sm font-bold flex items-center gap-1 ${
                              isTailwind 
                                ? showTailwindWarning ? "text-red-600 animate-pulse" : "text-red-500" 
                                : "text-green-600"
                            }`}>
                              {isTailwind ? "🔻" : "🟢"} {hwAbs} KT {isTailwind ? "Tailwind" : "Headwind"}
                            </span>
                          </div>

                          {/* Crosswind */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 block uppercase">LATERAL COMPONENT</span>
                            <span className={`text-sm font-bold ${cwAbs > 20 ? "text-orange-500 font-bold" : "text-gray-700"}`}>
                              💨 {cwAbs} KT {cwDirection}
                            </span>
                          </div>

                        </div>
                      )}

                    </div>
                  );
                })}
              </div>

            </div>

          </div>

        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 border border-brand-border rounded-2xl text-gray-500 font-semibold text-sm">
          Select an airport or search custom ICAO to load meteorological reports.
        </div>
      )}

    </div>
  );
}
