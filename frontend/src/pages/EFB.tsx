import { useState, useEffect } from "react";
import useReveal from "../hooks/useReveal";

export default function EFB() {
  const revealRef = useReveal();
  
  const [simbriefUsername, setSimbriefUsername] = useState(() => {
    return localStorage.getItem("simbrief_pilot_id") || "";
  });
  const [isSavedPilotId, setIsSavedPilotId] = useState(!!localStorage.getItem("simbrief_pilot_id"));
  const [zuluTime, setZuluTime] = useState("");
  
  const [ofpData, setOfpData] = useState<any>(null);
  const [loadingOfp, setLoadingOfp] = useState(false);
  const [ofpError, setOfpError] = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState(false);

  // Zulu Clock timer
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setZuluTime(d.toISOString().slice(11, 19) + "Z");
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch OFP from SimBrief
  const fetchSimBriefOFP = async (pilotId: string) => {
    if (!pilotId) return;
    setLoadingOfp(true);
    setOfpError(null);
    setPdfLoadError(false);
    try {
      const res = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?userid=${pilotId}&json=1`);
      if (!res.ok) {
        throw new Error("Unable to retrieve your latest SimBrief flight plan.");
      }
      const data = await res.json();
      
      // Empty state condition: fetch.status !== Success or missing PDF link
      if (data.fetch?.status?.toLowerCase() !== "success" || !data.files?.pdf?.link) {
        setOfpData(null);
        setOfpError("No SimBrief Operational Flight Plan Found");
      } else {
        setOfpData(data);
      }
    } catch (err: any) {
      setOfpData(null);
      setOfpError("Unable to retrieve your latest SimBrief flight plan.");
    } finally {
      setLoadingOfp(false);
    }
  };

  // Fetch automatically when pilot ID is saved/available
  useEffect(() => {
    if (isSavedPilotId && simbriefUsername) {
      fetchSimBriefOFP(simbriefUsername);
    }
  }, [isSavedPilotId]);

  const handleSavePilotId = () => {
    if (simbriefUsername.trim()) {
      localStorage.setItem("simbrief_pilot_id", simbriefUsername.trim());
      setIsSavedPilotId(true);
    }
  };

  const handleClearPilotId = () => {
    localStorage.removeItem("simbrief_pilot_id");
    setSimbriefUsername("");
    setIsSavedPilotId(false);
    setOfpData(null);
    setOfpError(null);
  };

  const handleRefreshOfp = () => {
    if (simbriefUsername) {
      fetchSimBriefOFP(simbriefUsername);
    }
  };

  const handleToggleFullscreen = () => {
    const viewerElement = document.getElementById("pdf-viewer-container");
    if (!viewerElement) return;

    if (!document.fullscreenElement) {
      viewerElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const getPdfUrl = () => {
    if (!ofpData?.files?.pdf?.link) return "";
    return ofpData.files.directory + ofpData.files.pdf.link;
  };

  // Helper formatting functions
  const formatSecondsToHM = (secondsStr?: string) => {
    if (!secondsStr) return "—";
    const seconds = parseInt(secondsStr);
    if (isNaN(seconds)) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatTimestampToTime = (timestampStr?: string) => {
    if (!timestampStr) return "—";
    const ts = parseInt(timestampStr);
    if (isNaN(ts)) return "—";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
  };

  const formatWeight = (value?: string, unit?: string) => {
    if (!value) return "—";
    const displayUnit = unit ? ` ${unit.toUpperCase()}` : "";
    return `${value}${displayUnit}`;
  };

  const units = ofpData?.params?.units || "";
  const flightNum = ofpData?.general?.icao_airline && ofpData?.general?.flight_number
    ? `${ofpData.general.icao_airline}${ofpData.general.flight_number}`
    : ofpData?.general?.flight_number || "—";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8" ref={revealRef}>
      
      {/* Header section matching other pages */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-5xl font-bold text-brand">Electronic Flight Bag (EFB)</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Fetch and review your latest SimBrief Operational Flight Plan (OFP) in real-time.
          </p>
        </div>
        
        {/* Zulu Time Widget */}
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm px-4 py-2.5 flex items-center gap-3 self-start md:self-auto font-mono text-sm font-bold text-brand">
          <svg className="w-4 h-4 text-brand animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Zulu Time: {zuluTime || "00:00:00Z"}
        </div>
      </div>

      {/* Main EFB Content card */}
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
        
        {/* Connection Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-brand-border pb-5 mb-6 gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2ECC71] shadow-sm shadow-[#2ECC71]/70"></span>
            <h2 className="text-lg font-bold text-brand">SimBrief Dispatch System</h2>
          </div>

          <div className="flex items-center gap-2">
            {isSavedPilotId ? (
              <div className="flex items-center gap-3 bg-brand-pale border border-brand-border px-3 py-1.5 rounded-xl">
                <span className="text-xs text-gray-500 font-semibold">PILOT ID:</span>
                <span className="font-mono font-bold text-brand text-sm">{simbriefUsername}</span>
                <button
                  onClick={handleClearPilotId}
                  className="text-red-600 hover:text-red-800 font-bold ml-1 text-sm"
                  title="Disconnect SimBrief ID"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="SimBrief Pilot ID"
                  value={simbriefUsername}
                  onChange={e => setSimbriefUsername(e.target.value)}
                  className="bg-white border border-brand-border text-gray-800 px-3 py-1.5 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:border-brand w-40"
                />
                <button
                  onClick={handleSavePilotId}
                  className="bg-brand text-white text-sm font-bold px-4 py-1.5 rounded-xl hover:bg-brand-dark transition-colors shadow-sm"
                >
                  Connect
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content Body */}
        {!isSavedPilotId ? (
          <div className="text-center py-16 px-4 max-w-md mx-auto">
            <div className="w-16 h-16 bg-brand-pale rounded-full flex items-center justify-center mx-auto mb-5 border border-brand-border">
              <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-brand">Connect SimBrief Account</h3>
            <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
              Please enter your SimBrief Pilot ID at the top right to synchronize and view your latest Operational Flight Plan (OFP).
            </p>
            <a
              href="https://www.simbrief.com/system/dispatch.php"
              target="_blank"
              rel="noreferrer"
              className="mt-6 bg-brand text-white hover:bg-brand-dark text-sm font-bold px-5 py-2.5 rounded-xl transition-colors inline-block shadow-sm"
            >
              Generate Flight Plan on SimBrief
            </a>
          </div>
        ) : loadingOfp ? (
          <div className="text-center py-24 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-brand-border border-t-brand rounded-full animate-spin"></div>
            <div className="text-sm font-bold text-gray-500 tracking-wide">Retrieving latest dispatch briefing...</div>
          </div>
        ) : ofpError ? (
          <div className="text-center py-16 px-4 max-w-md mx-auto">
            <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-yellow-200">
              <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800">{ofpError}</h3>
            <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
              Ensure you have generated a flight plan on SimBrief first, or try entering your Pilot ID again.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={handleRefreshOfp}
                className="bg-white border border-brand-border text-brand font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-brand-hover-bg transition-colors"
              >
                Retry Fetch
              </button>
              <a
                href="https://www.simbrief.com/system/dispatch.php"
                target="_blank"
                rel="noreferrer"
                className="bg-brand text-white hover:bg-brand-dark text-sm font-bold px-5 py-2.5 rounded-xl transition-colors inline-block"
              >
                Open SimBrief
              </a>
            </div>
          </div>
        ) : ofpData ? (
          <div className="flex flex-col">
            
            {/* Captain's Briefing Header */}
            <h3 className="text-lg font-bold text-brand mb-4">Captain's Briefing</h3>
            
            {/* Grid of 5 Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
              
              {/* Card 1 - Flight */}
              <div className="bg-gray-50/50 rounded-2xl border border-brand-border p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Flight</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Flight Number</span>
                      <span className="font-semibold font-mono text-brand">{flightNum}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Aircraft</span>
                      <span className="font-semibold font-mono text-gray-800">{ofpData.aircraft?.icao_code || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Route</span>
                      <span className="font-semibold font-mono text-gray-800">
                        {ofpData.origin?.icao_code || "—"} ➔ {ofpData.destination?.icao_code || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Distance</span>
                      <span className="font-semibold font-mono text-gray-800">
                        {ofpData.general?.route_distance ? `${ofpData.general.route_distance} NM` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Est. Flight Time</span>
                      <span className="font-semibold font-mono text-gray-800">{formatSecondsToHM(ofpData.times?.est_time_enroute)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2 - Fuel */}
              <div className="bg-gray-50/50 rounded-2xl border border-brand-border p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Fuel</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Block Fuel</span>
                      <span className="font-semibold font-mono text-gray-800">{formatWeight(ofpData.fuel?.plan_ramp, units)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Taxi Fuel</span>
                      <span className="font-semibold font-mono text-gray-800">{formatWeight(ofpData.fuel?.taxi, units)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Trip Fuel</span>
                      <span className="font-semibold font-mono text-gray-800">{formatWeight(ofpData.fuel?.enroute_burn, units)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Landing Fuel</span>
                      <span className="font-semibold font-mono text-gray-800">
                        {formatWeight(ofpData.fuel?.est_ldg || ofpData.fuel?.plan_landing, units)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Contingency Fuel</span>
                      <span className="font-semibold font-mono text-gray-800">{formatWeight(ofpData.fuel?.contingency, units)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 4 - Departure */}
              <div className="bg-gray-50/50 rounded-2xl border border-brand-border p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Departure</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Airport</span>
                      <span className="font-semibold font-mono text-gray-800">{ofpData.origin?.icao_code || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Airport Name</span>
                      <span className="font-semibold text-gray-800 text-right truncate max-w-[150px] inline-block" title={ofpData.origin?.name}>
                        {ofpData.origin?.name || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">SID</span>
                      <span className="font-semibold font-mono text-gray-800">{ofpData.general?.sid_ident || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Runway</span>
                      <span className="font-semibold font-mono text-gray-800">{ofpData.origin?.plan_rwy || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Alternate</span>
                      <span className="font-semibold font-mono text-gray-800">{ofpData.alternate?.icao_code || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 5 - Arrival */}
              <div className="bg-gray-50/50 rounded-2xl border border-brand-border p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Arrival</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Destination</span>
                      <span className="font-semibold font-mono text-gray-800">{ofpData.destination?.icao_code || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Airport Name</span>
                      <span className="font-semibold text-gray-800 text-right truncate max-w-[150px] inline-block" title={ofpData.destination?.name}>
                        {ofpData.destination?.name || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">STAR</span>
                      <span className="font-semibold font-mono text-gray-800">{ofpData.general?.star_ident || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Runway</span>
                      <span className="font-semibold font-mono text-gray-800">{ofpData.destination?.plan_rwy || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">ETA</span>
                      <span className="font-semibold font-mono text-gray-800">{formatTimestampToTime(ofpData.times?.est_in)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Alternate</span>
                      <span className="font-semibold font-mono text-gray-800">{ofpData.alternate?.icao_code || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 5 - Weights & Fuel */}
              <div className="bg-gray-50/50 rounded-2xl border border-brand-border p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Weights &amp; Fuel</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-mono">
                      <span className="text-gray-500 font-medium text-xs">PAX</span>
                      <span className="font-bold text-gray-800">{ofpData.weights?.pax_count_actual || ofpData.weights?.pax_count || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-mono">
                      <span className="text-gray-500 font-medium text-xs">BAG/CARGO</span>
                      <span className="font-bold text-gray-800">
                        {formatWeight(ofpData.weights?.cargo, units)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-mono">
                      <span className="text-gray-500 font-medium text-xs">PAYLOAD</span>
                      <span className="font-bold text-gray-800">
                        {formatWeight(ofpData.weights?.payload, units)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-mono">
                      <span className="text-gray-500 font-medium text-xs">ZFW</span>
                      <span className="font-bold text-gray-800">
                        {formatWeight(ofpData.weights?.est_zfw, units)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-mono">
                      <span className="text-gray-500 font-medium text-xs">FUEL</span>
                      <span className="font-bold text-gray-800">
                        {formatWeight(ofpData.fuel?.plan_ramp, units)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-mono">
                      <span className="text-gray-500 font-medium text-xs">TOW</span>
                      <span className="font-bold text-gray-800">
                        {formatWeight(ofpData.weights?.est_tow, units)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-mono">
                      <span className="text-gray-500 font-medium text-xs">STAB TRIM</span>
                      <span className="font-bold text-gray-800">—</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-mono">
                      <span className="text-gray-500 font-medium text-xs">LAW</span>
                      <span className="font-bold text-gray-800">
                        {formatWeight(ofpData.weights?.est_ldw, units)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Information Chips Section */}
            <div className="flex flex-wrap gap-2.5 mb-5">
              <div className="bg-brand-pale border border-brand-border rounded-full px-3 py-1 flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-gray-400 font-medium uppercase tracking-wider">Flight:</span>
                <span className="text-brand font-mono">{flightNum}</span>
              </div>
              <div className="bg-brand-pale border border-brand-border rounded-full px-3 py-1 flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-gray-400 font-medium uppercase tracking-wider">Route:</span>
                <span className="text-brand font-mono">
                  {ofpData.origin?.icao_code || "—"} ➔ {ofpData.destination?.icao_code || "—"}
                </span>
              </div>
              <div className="bg-brand-pale border border-brand-border rounded-full px-3 py-1 flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-gray-400 font-medium uppercase tracking-wider">Aircraft:</span>
                <span className="text-brand font-mono">{ofpData.aircraft?.icao_code || "—"}</span>
              </div>
              <div className="bg-brand-pale border border-brand-border rounded-full px-3 py-1 flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-gray-400 font-medium uppercase tracking-wider">Distance:</span>
                <span className="text-brand font-mono">
                  {ofpData.general?.route_distance ? `${ofpData.general.route_distance} NM` : "—"}
                </span>
              </div>
              <div className="bg-brand-pale border border-brand-border rounded-full px-3 py-1 flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-gray-400 font-medium uppercase tracking-wider">Generated:</span>
                <span className="text-brand font-mono">{ofpData.fetch?.time || "—"}</span>
              </div>
            </div>

            {/* PDF Viewer Container */}
            <div
              id="pdf-viewer-container"
              className="bg-gray-50 border border-brand-border rounded-xl p-1 overflow-hidden relative flex flex-col h-[750px] shadow-inner"
            >
              {/* Overlay PDF tools */}
              <div className="absolute right-4 top-4 z-10 flex items-center gap-1 bg-white/95 px-2.5 py-1.5 rounded-xl border border-brand-border shadow-md">
                <button
                  onClick={handleRefreshOfp}
                  className="p-1.5 hover:bg-brand-hover-bg rounded-lg text-gray-500 hover:text-brand transition-colors"
                  title="Refresh OFP"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" />
                  </svg>
                </button>
                <a
                  href={getPdfUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 hover:bg-brand-hover-bg rounded-lg text-gray-500 hover:text-brand transition-colors inline-block"
                  title="Open PDF in New Tab"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a
                  href={getPdfUrl()}
                  download
                  className="p-1.5 hover:bg-brand-hover-bg rounded-lg text-gray-500 hover:text-brand transition-colors inline-block"
                  title="Download PDF"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
                <button
                  onClick={handleToggleFullscreen}
                  className="p-1.5 hover:bg-brand-hover-bg rounded-lg text-gray-500 hover:text-brand transition-colors"
                  title="Fullscreen Viewer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5m-11 11h4m-4 0v-4m0 4l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                </button>
              </div>

              {pdfLoadError ? (
                <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-6 text-center text-gray-500 space-y-4">
                  <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div>
                    <h4 className="text-gray-800 font-bold">Unable to display PDF directly</h4>
                    <p className="text-sm text-gray-400 mt-1 max-w-sm">
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
                  className="w-full h-full border-0 rounded-lg bg-white"
                  title="SimBrief OFP Viewer"
                  onError={() => setPdfLoadError(true)}
                ></iframe>
              )}
            </div>

          </div>
        ) : (
          <div className="text-center py-8 text-sm text-gray-500 font-semibold">
            Connect your SimBrief account to display your flight plan.
          </div>
        )}

      </div>
    </div>
  );
}
