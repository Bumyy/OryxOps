import React from "react";
import aircraftsDb from "../../assets/checklist/aircrafts.json";

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
  handleCheckActiveItem: (itemIdOverride?: string) => void;
  announceChecklistItem: (text: string, value: string) => void;
  activePhaseIndex: number;
  setActivePhaseIndex: (idx: number) => void;
  copilotState: "IDLE" | "SPEAKING_CHALLENGE" | "SPEAKING_RESPONSE" | "LISTENING" | "VALIDATING" | "SUCCESS";
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
  handleCheckActiveItem,
  announceChecklistItem,
  activePhaseIndex,
  setActivePhaseIndex,
  copilotState,
}: EFBChecklistProps) {

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
    const section = compiledChecklist[activePhaseIndex];
    if (!section) return null;
    return section.items.find((item: any) => !checkedItems[item.id] && !item.isTable) || null;
  };

  const activeItem = getActiveItem();

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
                Stop Co-Pilot (Mic: {isListening ? "Listening" : "Offline"})
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
            Reset
          </button>
        </div>
      </div>

      {/* Speech Recognition Monitor / Tester */}
      {coPilotRunning && (
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

      {/* Accordion checklist phases */}
      {aircraftInfo && (
        <div className="space-y-3">
          {compiledChecklist.map((section: any, sIdx: number) => {
            const isExpanded = activePhaseIndex === sIdx;
            const phaseTotal = section.items.filter((it: any) => !it.isTable).length;
            const phaseChecked = section.items.filter((it: any) => !it.isTable && checkedItems[it.id]).length;
            const phaseFinished = phaseTotal > 0 && phaseChecked === phaseTotal;

            return (
              <div
                key={sIdx}
                className={`border rounded-2xl overflow-hidden transition-all duration-200 bg-white ${
                  isExpanded ? "border-brand shadow-md" : "border-brand-border hover:border-brand-light"
                }`}
              >
                {/* Accordion Header */}
                <button
                  onClick={() => setActivePhaseIndex(isExpanded ? -1 : sIdx)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      phaseFinished
                        ? "bg-green-100 text-green-700"
                        : "bg-brand-pale text-brand"
                    }`}>
                      {phaseFinished ? "✓" : sIdx + 1}
                    </span>
                    <span className="font-bold text-gray-800 text-sm tracking-wide">
                      {section.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400">
                      {phaseChecked} / {phaseTotal}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="p-4 border-t border-brand-border divide-y divide-gray-100">
                    {section.text_section && (
                      <p className="text-xs text-gray-400 bg-gray-50 p-3 rounded-xl mb-3 leading-relaxed border border-brand-border">
                        {section.text_section}
                      </p>
                    )}
                    {section.items.map((item: any, iIdx: number) => {
                      if (item.isTable) {
                        return (
                          <div key={item.id || iIdx} className="py-4 overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-brand-border bg-gray-50">
                                  {item.headers.map((h: string, hIdx: number) => (
                                    <th key={hIdx} className="p-2.5 font-bold text-gray-500 uppercase tracking-wider">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 font-mono">
                                {item.rows.map((row: string[], rIdx: number) => (
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
                          className={`flex items-center justify-between py-3 px-2 group rounded-xl transition-colors ${
                            isChecked ? "bg-green-50/20" : "hover:bg-gray-50/50"
                          }`}
                        >
                          <label className="flex items-center gap-3 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckActiveItem(item.id)}
                              className="w-4 h-4 rounded text-brand focus:ring-brand border-gray-300 cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span className={`text-sm font-semibold transition-colors ${
                                isChecked ? "text-gray-400 line-through font-medium" : "text-gray-800"
                              }`}>
                                {item.text}
                              </span>
                              {item.remarks && (
                                <span className="text-[10px] text-gray-400 font-medium">
                                  {item.remarks}
                                </span>
                              )}
                            </div>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                              isChecked
                                ? "bg-gray-50 text-gray-300 border-gray-100"
                                : "bg-brand-pale text-brand border-brand-border"
                            }`}>
                              {item.value}
                            </span>
                            <button
                              onClick={() => announceChecklistItem(item.text, item.value)}
                              className="p-1.5 text-gray-400 hover:text-brand hover:bg-brand-hover-bg rounded-lg transition-all"
                              title="Announce item"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
