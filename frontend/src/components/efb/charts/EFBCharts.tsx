import React, { useState, useRef, useEffect } from "react";
import { api } from "../../../api/client";

interface EFBChartsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ofpData?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeBooking?: any;
}

type LoadStatus = "idle" | "loading" | "loaded" | "error";

export default function EFBCharts({ ofpData, activeBooking }: EFBChartsProps) {
  // Try to default to destination ICAO from OFP or active booking
  const defaultIcao = (
    (ofpData as any)?.destination?.icao_code ||
    (activeBooking as any)?.flight_arrival ||
    ""
  ).toUpperCase();

  const [icaoInput, setIcaoInput] = useState(defaultIcao);
  const [loadedIcao, setLoadedIcao] = useState("");
  const [iframeUrl, setIframeUrl] = useState("");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync default ICAO and load charts once ofpData or activeBooking loads
  useEffect(() => {
    if (defaultIcao && !loadedIcao) {
      setIcaoInput(defaultIcao);
      loadChartsForIcao(defaultIcao);
    }
  }, [defaultIcao]);

  const handleIcaoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase();
    if (val.length <= 4) {
      setIcaoInput(val);
    }
  };

  const loadChartsForIcao = async (icao: string) => {
    const cleanIcao = icao.trim().toUpperCase();
    if (cleanIcao.length !== 4) {
      setErrorMsg("ICAO code must be exactly 4 letters.");
      setStatus("error");
      return;
    }

    setLoadedIcao(cleanIcao);
    setStatus("loading");
    setErrorMsg(null);

    try {
      const res = await api.get<{ url: string }>(`/charts/embed-config/${cleanIcao}`);
      setIframeUrl(res.url);
    } catch (err: any) {
      console.error("Failed to load chart embed configuration:", err);
      setStatus("error");
      setErrorMsg(err?.message || "Failed to load ChartFox configuration from backend.");
    }
  };

  const handleLoadCharts = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    loadChartsForIcao(icaoInput);
  };

  const handleIframeLoad = () => {
    if (status === "loading") {
      setStatus("loaded");
    }
  };

  // Open link in browser
  const handleOpenInBrowser = () => {
    const targetIcao = loadedIcao || icaoInput || defaultIcao || "EGLL";
    window.open(`https://chartfox.org/${targetIcao}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      {/* Search Bar & Input Card */}
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5">
        <form onSubmit={handleLoadCharts} className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <label htmlFor="icao-input" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Airport ICAO Code
            </label>
            <div className="relative">
              <input
                id="icao-input"
                type="text"
                value={icaoInput}
                onChange={handleIcaoChange}
                placeholder="e.g. EGLL"
                className="w-full bg-gray-50 border border-brand-border rounded-xl px-4 py-2.5 font-mono text-sm font-bold text-brand uppercase focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
              />
              {icaoInput && (
                <button
                  type="button"
                  onClick={() => setIcaoInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          <button
            type="submit"
            disabled={icaoInput.length !== 4}
            className="sm:self-end bg-brand text-white text-xs font-bold px-6 py-3 rounded-xl hover:bg-brand-dark transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
          >
            Load Charts
          </button>
        </form>

        {/* Quick suggestions based on flight plan */}
        {(defaultIcao || (ofpData as any)?.origin?.icao_code) && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-brand-border text-xs">
            <span className="text-gray-400 font-semibold uppercase tracking-wider">Flight Plan ICAOs:</span>
            {(ofpData as any)?.origin?.icao_code && (
              <button
                type="button"
                onClick={() => {
                  const code = (ofpData as any).origin.icao_code;
                  setIcaoInput(code);
                  loadChartsForIcao(code);
                }}
                className="bg-brand-pale border border-brand-border rounded-lg px-2.5 py-1 font-mono font-bold text-brand hover:bg-brand/10 transition-colors"
              >
                DEP: {(ofpData as any).origin.icao_code}
              </button>
            )}
            {(ofpData as any)?.destination?.icao_code && (
              <button
                type="button"
                onClick={() => {
                  const code = (ofpData as any).destination.icao_code;
                  setIcaoInput(code);
                  loadChartsForIcao(code);
                }}
                className="bg-brand-pale border border-brand-border rounded-lg px-2.5 py-1 font-mono font-bold text-brand hover:bg-brand/10 transition-colors"
              >
                ARR: {(ofpData as any).destination.icao_code}
              </button>
            )}
            {(ofpData as any)?.alternate?.icao_code && (
              <button
                type="button"
                onClick={() => {
                  const code = (ofpData as any).alternate.icao_code;
                  setIcaoInput(code);
                  loadChartsForIcao(code);
                }}
                className="bg-brand-pale border border-brand-border rounded-lg px-2.5 py-1 font-mono font-bold text-brand hover:bg-brand/10 transition-colors"
              >
                ALT: {(ofpData as any).alternate.icao_code}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area - Iframe & Glassmorphic Fallback */}
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden flex flex-col h-[700px] relative">
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border bg-brand-pale/50">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h3 className="text-sm font-bold text-brand tracking-wide uppercase">
              {loadedIcao ? `${loadedIcao} Airport Charts` : "Aviation Charts Viewer"}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Status indicators */}
            {status === "loading" && (
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Loading...
              </div>
            )}
            {status === "loaded" && (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Loaded successfully
              </div>
            )}
            {status === "error" && (
              <div className="flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                Unable to display
              </div>
            )}
          </div>
        </div>

        {/* Content Viewport */}
        <div className="flex-1 bg-gray-50 relative flex flex-col justify-center items-center overflow-hidden">
          {status === "idle" && (
            <div className="text-center p-6 max-w-sm">
              <div className="w-16 h-16 bg-brand-pale rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-border">
                <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h4 className="text-sm font-bold text-brand">Enter Airport ICAO</h4>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Provide a valid 4-character airport code above to attempt loading ChartFox charts.
              </p>
            </div>
          )}

          {status === "loading" && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-brand-border border-t-brand rounded-full animate-spin" />
              <p className="text-xs font-bold text-gray-500 tracking-wide uppercase">Connecting to ChartFox...</p>
            </div>
          )}

          {(status === "loading" || status === "loaded") && iframeUrl && (
            <iframe
              ref={iframeRef}
              src={iframeUrl}
              onLoad={handleIframeLoad}
              className={`w-full h-full border-none transition-opacity duration-300 ${
                status === "loaded" ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              title="ChartFox Airport Charts"
            />
          )}

          {status === "error" && (
            <div className="p-6 max-w-md text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4 text-red-600 shadow-inner">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h4 className="text-sm font-bold text-brand">Unable to Display Charts</h4>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {errorMsg || "ChartFox does not allow embedding inside external websites. Open the chart in a new tab instead."}
              </p>
              <button
                type="button"
                onClick={handleOpenInBrowser}
                className="mt-5 bg-brand text-white text-xs font-bold px-6 py-2.5 rounded-xl hover:bg-brand-dark transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <span>Open in Browser</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
