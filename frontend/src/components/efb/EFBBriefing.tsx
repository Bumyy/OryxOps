import React from "react";

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
}

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
}: EFBBriefingProps) {
  return (
    <>
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
                <span className="font-semibold font-mono text-gray-800">{flightNum}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Aircraft</span>
                <span className="font-semibold font-mono text-gray-800">{ofpData.aircraft?.icao_code || "—"}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Route Distance</span>
                <span className="font-semibold font-mono text-gray-800">
                  {ofpData.general?.route_distance ? `${ofpData.general.route_distance} NM` : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Flight Time</span>
                <span className="font-semibold font-mono text-gray-800">
                  {ofpData.times?.est_time_enroute
                    ? `${Math.floor(ofpData.times.est_time_enroute / 3600)}h ${Math.round((ofpData.times.est_time_enroute % 3600) / 60)}m`
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2 - Dispatch & Fuel */}
        <div className="bg-gray-50/50 rounded-2xl border border-brand-border p-5 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Fuel (kgs)</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-mono">
                <span className="text-gray-500 font-medium text-xs">Block Fuel</span>
                <span className="font-bold text-gray-800">
                  {formatWeight(ofpData.fuel?.plan_ramp, units)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm font-mono">
                <span className="text-gray-500 font-medium text-xs">Taxi Fuel</span>
                <span className="font-bold text-gray-800">
                  {formatWeight(ofpData.fuel?.taxi, units)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm font-mono">
                <span className="text-gray-500 font-medium text-xs">Trip Fuel</span>
                <span className="font-bold text-gray-800">
                  {formatWeight(ofpData.fuel?.enroute_burn, units)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm font-mono">
                <span className="text-gray-500 font-medium text-xs">Landing Fuel</span>
                <span className="font-bold text-gray-800">
                  {formatWeight(ofpData.fuel?.est_ldg, units)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm font-mono">
                <span className="text-gray-500 font-medium text-xs">Contingency</span>
                <span className="font-bold text-gray-800">
                  {formatWeight(ofpData.fuel?.contingency, units)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3 - Departure */}
        <div className="bg-gray-50/50 rounded-2xl border border-brand-border p-5 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Departure</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Origin</span>
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
                <span className="text-gray-500 font-medium">ETD</span>
                <span className="font-semibold font-mono text-gray-800">{formatTimestampToTime(ofpData.times?.est_out)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Alternate</span>
                <span className="font-semibold font-mono text-gray-800">{ofpData.alternate?.icao_code || "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4 - Arrival */}
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
    </>
  );
}
