import { useState, useEffect, useRef } from "react";
import { useAppSelector } from "../../../store/hooks";

export interface EFBChecklistProps {
  compiledChecklist: any[];
  checkedItems: Record<string, boolean>;
  checkedItemsCount: number;
  totalItems: number;
  checklistProgressPercent: number;
  aircraftInfo: any;
  activeAircraft: string;
  activeLoad: number;
  activeDirection: string;
  aircraftCode: string;
  setAircraftOverride: (val: string | null) => void;
  coPilotRunning: boolean;
  isListening: boolean;
  transcriptLog: string;
  triggerKeyword: string;
  toggleCoPilot: () => void;
  handleResetChecklist: () => void;
  handleResetPhase: (phaseIdx: number) => void;
  handleCheckActiveItem: (itemIdOverride?: string) => void;
  announceChecklistItem: (text: string, value: string) => void;
  activePhaseIndex: number;
  setActivePhaseIndex: (idx: number) => void;
  copilotState: "IDLE" | "SPEAKING_CHALLENGE" | "SPEAKING_RESPONSE" | "LISTENING" | "VALIDATING" | "SUCCESS";
  copilotKey: string;
  showFloatingButton: boolean;
  copilotInputMode: string;
}

export default function EFBChecklist({
  compiledChecklist,
  checkedItems,
  checkedItemsCount,
  totalItems,
  checklistProgressPercent,
  aircraftInfo,
  activeAircraft,
  activeLoad,
  activeDirection,
  aircraftCode,
  setAircraftOverride,
  coPilotRunning,
  isListening,
  transcriptLog,
  triggerKeyword,
  toggleCoPilot,
  handleResetChecklist,
  handleResetPhase,
  handleCheckActiveItem,
  announceChecklistItem,
  activePhaseIndex,
  setActivePhaseIndex,
  copilotState,
  copilotKey,
  showFloatingButton,
  copilotInputMode,
}: EFBChecklistProps) {
  const aircraftsDb = useAppSelector((state) => state.aircraft.specs) || {};

  const getStateLabel = (state: string) => {
    switch (state) {
      case "SPEAKING_CHALLENGE":
        return "🗣️ Calling Challenge";
      case "SPEAKING_RESPONSE":
        return "🗣️ Reading Expected State";
      case "LISTENING":
        return "🎙️ Hot Mic: Listening";
      case "VALIDATING":
        return "⚡ Analyzing Response";
      case "SUCCESS":
        return "✅ Correct Match";
      case "IDLE":
      default:
        return "💤 Co-Pilot Standby";
    }
  };

  const getActiveItem = () => {
    for (let i = activePhaseIndex; i < compiledChecklist.length; i++) {
      const section = compiledChecklist[i];
      if (!section) continue;
      const item = section.items.find((item: any) => !checkedItems[item.id] && !item.isTable);
      if (item) return item;
    }
    for (let i = 0; i < activePhaseIndex; i++) {
      const section = compiledChecklist[i];
      if (!section) continue;
      const item = section.items.find((item: any) => !checkedItems[item.id] && !item.isTable);
      if (item) return item;
    }
    return null;
  };

  const activeItem = getActiveItem();

  // Keyboard listener for checklist advancing key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea/contenteditable
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.getAttribute("contenteditable") === "true")) {
        return;
      }

      let isMatch = false;
      if (copilotKey === "Space" && (e.code === "Space" || e.key === " ")) {
        isMatch = true;
      } else if (copilotKey === "Enter" && e.code === "Enter") {
        isMatch = true;
      } else if (copilotKey === "ArrowRight" && e.code === "ArrowRight") {
        isMatch = true;
      } else if (copilotKey === "ArrowDown" && e.code === "ArrowDown") {
        isMatch = true;
      } else if (copilotKey === "KeyC" && e.code === "KeyC") {
        isMatch = true;
      } else if (copilotKey === "KeyV" && e.code === "KeyV") {
        isMatch = true;
      }

      if (isMatch) {
        e.preventDefault();
        handleCheckActiveItem();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copilotKey, activePhaseIndex, checkedItems, handleCheckActiveItem]);

  // Touch/Mouse draggable floating advance button positioning
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem("copilot_btn_pos");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
          return parsed;
        }
      }
    } catch {}
    return { x: window.innerWidth - 88, y: window.innerHeight - 100 };
  });

  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Sync position on window resize
  useEffect(() => {
    const handleResize = () => {
      const current = positionRef.current;
      const x = Math.max(10, Math.min(window.innerWidth - 80, current.x));
      const y = Math.max(10, Math.min(window.innerHeight - 80, current.y));
      setPosition({ x, y });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;
    let moved = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moved = true;
      let newX = moveEvent.clientX - startX;
      let newY = moveEvent.clientY - startY;

      newX = Math.max(10, Math.min(window.innerWidth - 80, newX));
      newY = Math.max(10, Math.min(window.innerHeight - 80, newY));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      localStorage.setItem("copilot_btn_pos", JSON.stringify(positionRef.current));
      if (!moved) {
        handleCheckActiveItem();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const startX = touch.clientX - position.x;
    const startY = touch.clientY - position.y;
    let moved = false;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      moved = true;
      const curTouch = moveEvent.touches[0];
      let newX = curTouch.clientX - startX;
      let newY = curTouch.clientY - startY;

      newX = Math.max(10, Math.min(window.innerWidth - 80, newX));
      newY = Math.max(10, Math.min(window.innerHeight - 80, newY));
      setPosition({ x: newX, y: newY });
    };

    const handleTouchEnd = () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      localStorage.setItem("copilot_btn_pos", JSON.stringify(positionRef.current));
      if (!moved) {
        handleCheckActiveItem();
      }
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
  };

  return (
    <div className="flex flex-col space-y-6">
      
      {/* Checklist Control Header */}
      <div className="bg-gray-50/50 rounded-2xl border border-brand-border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-brand flex items-center gap-2">
            📋 Checklist Engine
            {aircraftInfo && (
              <span className="text-xs bg-brand text-white font-mono px-2 py-0.5 rounded-full uppercase">
                {aircraftInfo.properties.full_name}
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-500">
            Aircraft profile: <span className="font-bold text-gray-700">{activeAircraft}</span> | Load: <span className="font-bold text-gray-700">{activeLoad}%</span> | Direction: <span className="font-bold text-gray-700 uppercase">{activeDirection}bound</span>
          </p>
        </div>

        {/* Co-Pilot Activator Panel */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleCoPilot}
            className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${
              coPilotRunning
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-brand text-white hover:bg-brand-dark"
            }`}
          >
            {coPilotRunning ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                Stop Co-Pilot {copilotInputMode === "voice" ? `(Mic: ${isListening ? "Listening" : "Offline"})` : "(Manual)"}
              </>
            ) : (
              <>
                🎙️ Start Audio Co-Pilot
              </>
            )}
          </button>
          
          <button
            onClick={handleResetChecklist}
            className="bg-white border border-brand-border text-red-600 hover:bg-red-50 text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Speech Recognition Monitor / Tester */}
      {coPilotRunning && (
        copilotInputMode === "voice" ? (
          <div className="bg-brand-pale border border-brand-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${copilotState === "LISTENING" ? "bg-green-500" : "bg-brand"}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${copilotState === "LISTENING" ? "bg-green-500" : "bg-brand"}`}></span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-2">
                  🎙️ Audio Co-Pilot Mic Monitor
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                    copilotState === "LISTENING" 
                      ? "bg-green-100 text-green-700 border border-green-200 animate-pulse" 
                      : "bg-brand/10 text-brand border border-brand/20"
                  }`}>
                    {getStateLabel(copilotState)}
                  </span>
                </span>
                <span className="text-sm font-semibold text-gray-700">
                  {transcriptLog ? (
                    <>
                      Heard: <span className="font-mono text-brand font-bold bg-white px-2 py-0.5 rounded border border-brand-border">"{transcriptLog}"</span>
                    </>
                  ) : (
                    <span className="italic text-gray-400">
                      {copilotState === "LISTENING" 
                        ? `Say "${activeItem ? activeItem.value : ""}" or your override word ("${triggerKeyword}") to check...`
                        : "Waiting for transmission sequence..."}
                    </span>
                  )}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-400 bg-white px-2.5 py-1 rounded-xl border border-brand-border font-mono self-start sm:self-auto">
              Keyword Override: {triggerKeyword}
            </div>
          </div>
        ) : (
          <div className="bg-brand-pale border border-brand-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-brand animate-bounce"></span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-2">
                  🎛️ Co-Pilot Controller Mode
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-brand/10 text-brand border border-brand-border/20">
                    {copilotState === "SPEAKING_CHALLENGE" ? "🗣️ Speaking" : "⌨️ Waiting for Key/Tap"}
                  </span>
                </span>
                <span className="text-sm font-semibold text-gray-700">
                  {copilotState === "SPEAKING_CHALLENGE" ? (
                    <span className="italic text-brand font-bold">Co-Pilot is reading item...</span>
                  ) : (
                    <span>Press <kbd className="bg-white px-1.5 py-0.5 rounded border border-brand-border font-mono font-bold text-xs">{copilotKey === "Space" ? "Spacebar" : copilotKey}</kbd> or tap the checkmark button to advance.</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )
      )}

      {/* Progress bar */}
      <div className="bg-gray-50/50 rounded-2xl border border-brand-border p-4">
        <div className="flex justify-between items-center text-xs font-bold text-gray-500 mb-1.5">
          <span>PROGRESS INDICATOR</span>
          <span>{checkedItemsCount} / {totalItems} ITEMS COMPLETED ({checklistProgressPercent}%)</span>
        </div>
        <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-brand h-full transition-all duration-300 rounded-full"
            style={{ width: `${checklistProgressPercent}%` }}
          ></div>
        </div>
      </div>

      {!aircraftInfo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 text-center text-yellow-800 text-sm">
          <p className="font-bold">Aircraft Profile Not Configured</p>
          <p className="mt-1 text-xs text-yellow-600">
            The aircraft code returned from SimBrief (<span className="font-mono">{aircraftCode}</span>) does not match any profile in our database. Please select a compatible aircraft below:
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <select
              onChange={(e) => setAircraftOverride(e.target.value)}
              className="bg-white border border-yellow-300 text-gray-800 rounded-xl px-3 py-1.5 text-sm"
              defaultValue=""
            >
              <option value="" disabled>Select aircraft profile</option>
              {Object.keys(aircraftsDb).map(code => (
                <option key={code} value={code}>{code} - {aircraftsDb[code as keyof typeof aircraftsDb].properties.full_name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Paginated grid layout */}
      {aircraftInfo && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* LEFT INDEX COLUMN: Scrollable vertical list of phases on Desktop */}
          <div className="hidden lg:flex flex-col space-y-1.5 bg-gray-50/50 rounded-2xl border border-brand-border p-3 max-h-[620px] overflow-y-auto">
            <span className="text-[10px] font-bold text-gray-400 px-2 pb-2 border-b border-brand-border/60 uppercase tracking-wider">
              Flight Checklist Pages
            </span>
            <div className="space-y-1 mt-2">
              {compiledChecklist.map((section: any, sIdx: number) => {
                const isActive = activePhaseIndex === sIdx;
                const phaseTotal = section.items.filter((it: any) => !it.isTable).length;
                const isTextOnly = phaseTotal === 0;
                const isNotam = section.title.toUpperCase().includes("NOTAM") || isTextOnly;
                const phaseChecked = section.items.filter((it: any) => !it.isTable && checkedItems[it.id]).length;
                const phaseFinished = phaseTotal > 0 && phaseChecked === phaseTotal;

                return (
                  <button
                    key={sIdx}
                    onClick={() => setActivePhaseIndex(sIdx)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left text-xs font-bold ${
                      isActive
                        ? "bg-brand text-white shadow-md shadow-brand/20 scale-[1.01] border border-transparent"
                        : phaseFinished
                        ? "bg-green-50/70 text-green-700 hover:bg-green-100/70 border border-green-100"
                        : isNotam
                        ? "bg-amber-50/40 text-amber-800 hover:bg-amber-100/40 border border-amber-100/20"
                        : "bg-white text-gray-600 hover:bg-brand-hover-bg hover:text-brand border border-brand-border/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                        isActive
                          ? "bg-white text-brand"
                          : phaseFinished
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : isNotam
                          ? "bg-amber-100 text-amber-700 border border-amber-200"
                          : "bg-brand-pale text-brand border border-brand-border"
                      }`}>
                        {isNotam ? "ℹ️" : phaseFinished ? "✓" : sIdx + 1}
                      </span>
                      <span className="truncate uppercase tracking-wide text-[11px]">
                        {section.title}
                      </span>
                    </div>
                    {!isNotam && (
                      <span className={`text-[10px] font-mono font-bold shrink-0 ml-1.5 px-1.5 py-0.5 rounded-md ${
                        isActive ? "bg-brand-dark/40 text-brand-pale" : "bg-gray-150 text-gray-400"
                      }`}>
                        {phaseChecked}/{phaseTotal}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* MOBILE RESPONSIVE TIMELINE SELECTOR: Visible below lg screens */}
          <div className="block lg:hidden w-full bg-gray-50/50 rounded-2xl border border-brand-border p-3.5 space-y-2">
            <label className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">
              Active flight checklist page
            </label>
            <select
              value={activePhaseIndex}
              onChange={(e) => setActivePhaseIndex(Number(e.target.value))}
              className="w-full bg-white border border-brand-border text-brand text-sm font-bold rounded-xl px-3 py-2.5 focus:ring-brand focus:border-brand"
            >
              {compiledChecklist.map((section: any, sIdx: number) => {
                const phaseTotal = section.items.filter((it: any) => !it.isTable).length;
                const isTextOnly = phaseTotal === 0;
                const isNotam = section.title.toUpperCase().includes("NOTAM") || isTextOnly;
                const phaseChecked = section.items.filter((it: any) => !it.isTable && checkedItems[it.id]).length;
                const phaseFinished = phaseTotal > 0 && phaseChecked === phaseTotal;
                
                const statusSuffix = isNotam ? " (Notice)" : phaseFinished ? " (✓ Done)" : ` (${phaseChecked}/${phaseTotal})`;
                return (
                  <option key={sIdx} value={sIdx}>
                    {sIdx + 1}. {section.title.toUpperCase()}{statusSuffix}
                  </option>
                );
              })}
            </select>
          </div>

          {/* RIGHT CHECKLIST CARD COLUMN: Renders the selected active page */}
          <div className="lg:col-span-3 space-y-4">
            {(() => {
              const section = compiledChecklist[activePhaseIndex];
              if (!section) return null;

              const phaseTotal = section.items.filter((it: any) => !it.isTable).length;
              const isTextOnly = phaseTotal === 0;
              const isNotam = section.title.toUpperCase().includes("NOTAM") || isTextOnly;
              const phaseChecked = section.items.filter((it: any) => !it.isTable && checkedItems[it.id]).length;
              const phaseFinished = phaseTotal > 0 && phaseChecked === phaseTotal;

              return (
                <div className={`border rounded-2xl overflow-hidden bg-white shadow-sm transition-all duration-300 ${
                  isNotam
                    ? "border-amber-400/80 shadow-md shadow-amber-50/30"
                    : phaseFinished
                    ? "border-green-400/80 shadow-md shadow-green-50/30"
                    : "border-brand shadow-md shadow-brand/5"
                }`}>
                  
                  {/* Phase Card Header */}
                  <div className={`p-5 border-b border-brand-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isNotam ? "bg-amber-50/10" : "bg-gray-50/30"
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isNotam
                          ? "bg-amber-100 text-amber-700"
                          : phaseFinished
                          ? "bg-green-100 text-green-700"
                          : "bg-brand text-white"
                      }`}>
                        {isNotam ? "ℹ️" : phaseFinished ? "✓" : activePhaseIndex + 1}
                      </span>
                      <div>
                        <h4 className={`text-base font-extrabold tracking-wide uppercase ${
                          isNotam ? "text-amber-800" : "text-brand"
                        }`}>
                          {section.title}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 tracking-wider">
                          {isNotam ? "Information briefing" : `Page Checklist: ${phaseChecked} of ${phaseTotal} items completed`}
                        </p>
                      </div>
                    </div>

                    {!isNotam && phaseTotal > 0 && (
                      <div className="w-full sm:w-40 space-y-1.5 self-start sm:self-auto">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 font-mono">
                          <span>PAGE PROGRESS</span>
                          <span>{Math.round((phaseChecked / phaseTotal) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              phaseFinished ? "bg-green-500" : "bg-brand"
                            }`}
                            style={{ width: `${(phaseChecked / phaseTotal) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Phase Card Content */}
                  <div className="p-5 divide-y divide-gray-100">
                    {section.text_section && (
                      <div className={`text-xs p-4 rounded-xl mb-4 leading-relaxed border font-medium space-y-2.5 ${
                        isNotam
                          ? "text-amber-800 bg-amber-50/30 border-amber-200/50"
                          : "text-gray-500 bg-gray-50 border-brand-border/60"
                      }`}>
                        {Array.isArray(section.text_section) ? (
                          section.text_section.map((line: string, index: number) => {
                            const isWarning = line.startsWith("⚠️ WARNING");
                            return (
                              <p key={index} className={isWarning ? "text-red-700 bg-red-50/70 p-3 rounded-lg border border-red-200/60 font-bold" : ""}>
                                {line}
                              </p>
                            );
                          })
                        ) : (
                          <p>{section.text_section}</p>
                        )}
                      </div>
                    )}

                    {section.items.map((item: any, iIdx: number) => {
                      if (item.isTable) {
                        const headers = item.headers || ["LOAD RANGE (%)", "FLAPS", "VAPP (KTS)", "VFLARE (KTS)"];
                        const rows = item.rows || (item.tableData ? item.tableData.map((ld: any) => [
                          `${ld.load_range[0]}% - ${ld.load_range[1]}%`,
                          ld.flaps,
                          `${ld.vapp} KTS`,
                          `${ld.vflare} KTS`
                        ]) : []);

                        return (
                          <div key={item.id || iIdx} className="py-4 overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-brand-border bg-gray-50">
                                  {headers.map((h: string, hIdx: number) => (
                                    <th key={hIdx} className="p-2.5 font-bold text-gray-500 uppercase tracking-wider">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 font-mono">
                                {rows.map((row: string[], rIdx: number) => (
                                  <tr key={rIdx} className="hover:bg-gray-50/50">
                                    {row.map((cell: string, cIdx: number) => (
                                      <td key={cIdx} className="p-2.5 text-gray-700">
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      const isChecked = !!checkedItems[item.id];
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between py-3.5 px-3 group rounded-xl transition-all duration-150 border border-transparent ${
                            isChecked ? "bg-green-50/15 border-green-100/10" : "hover:bg-brand-hover-bg/30"
                          }`}
                        >
                          <label className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckActiveItem(item.id)}
                              className="w-5 h-5 rounded text-brand focus:ring-brand border-gray-300 cursor-pointer"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className={`text-sm font-bold transition-colors truncate ${
                                isChecked ? "text-gray-400 line-through font-semibold" : "text-gray-800"
                              }`}>
                                {item.text}
                              </span>
                              {item.remarks && (
                                <span className="text-[10px] text-gray-400 font-bold mt-0.5 tracking-wide">
                                  {item.remarks}
                                </span>
                              )}
                            </div>
                          </label>
                          <div className="flex items-center gap-3">
                            <span className={`font-mono text-xs font-extrabold px-3 py-1 rounded-xl border tracking-wide shadow-sm transition-all duration-150 ${
                              isChecked
                                ? "bg-gray-50 text-gray-300 border-gray-150"
                                : "bg-brand-pale text-brand border-brand-border"
                            }`}>
                              {item.value}
                            </span>
                            <button
                              onClick={() => announceChecklistItem(item.text, item.value)}
                              className={`p-2 rounded-xl transition-all border ${
                                isChecked
                                  ? "text-gray-300 border-transparent bg-transparent"
                                  : "text-brand border-transparent bg-brand-pale hover:bg-brand hover:text-white"
                              }`}
                              title="Announce item"
                              disabled={isChecked}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Card Pagination Control Footer */}
                  <div className="p-4 border-t border-brand-border/60 bg-gray-50/20 flex items-center justify-between gap-3">
                    <button
                      onClick={() => setActivePhaseIndex(Math.max(0, activePhaseIndex - 1))}
                      disabled={activePhaseIndex === 0}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-white hover:bg-gray-50 text-gray-700 rounded-xl border border-brand-border disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      ← PREV
                    </button>

                    {!isNotam && phaseTotal > 0 && (
                      <button
                        onClick={() => handleResetPhase(activePhaseIndex)}
                        className="px-3.5 py-2 text-xs font-bold bg-white hover:bg-red-50 text-red-600 border border-brand-border rounded-xl transition-all shadow-sm"
                      >
                        Reset Phase
                      </button>
                    )}

                    <button
                      onClick={() => setActivePhaseIndex(Math.min(compiledChecklist.length - 1, activePhaseIndex + 1))}
                      disabled={activePhaseIndex === compiledChecklist.length - 1}
                      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-sm ${
                        phaseFinished && activePhaseIndex < compiledChecklist.length - 1
                          ? "bg-brand text-white hover:bg-brand-dark animate-pulse"
                          : "bg-white hover:bg-gray-50 text-gray-700 border border-brand-border"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      NEXT →
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Mobile/Tablet touch draggable checklist advance button */}
      {(showFloatingButton || copilotInputMode === "button") && (
        <div
          style={{
            position: "fixed",
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 9999,
            touchAction: "none",
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="w-14 h-14 bg-gradient-to-br from-brand to-brand-dark hover:from-brand-light hover:to-brand text-white rounded-full shadow-lg shadow-brand/30 flex items-center justify-center cursor-move transition-transform active:scale-95 border-2 border-brand-pale select-none"
          title="Drag to reposition, Tap to advance checklist"
        >
          <svg className="w-7 h-7 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
}
