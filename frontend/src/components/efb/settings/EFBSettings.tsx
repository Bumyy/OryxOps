import { useAppSelector } from "../../../store/hooks";

export interface EFBSettingsProps {
  availableVoices: SpeechSynthesisVoice[];
  selectedVoiceName: string;
  setSelectedVoiceName: (val: string) => void;
  speechRate: number;
  setSpeechRate: (val: number) => void;
  speechPitch: number;
  setSpeechPitch: (val: number) => void;
  triggerKeyword: string;
  setTriggerKeyword: (val: string) => void;
  playChime: boolean;
  setPlayChime: (val: boolean) => void;
  autoAdvance: boolean;
  setAutoAdvance: (val: boolean) => void;
  autoCollapse: boolean;
  setAutoCollapse: (val: boolean) => void;
  loadOverride: number | null;
  setLoadOverride: (val: number | null) => void;
  directionOverride: "east" | "west" | null;
  setDirectionOverride: (val: "east" | "west" | null) => void;
  aircraftOverride: string | null;
  setAircraftOverride: (val: string | null) => void;
  getCalculatedLoad: () => number;
  getFlightDirection: () => "east" | "west";
  aircraftCode: string;
  testSelectedVoice: () => void;
  transcriptLog: string;
  coPilotRunning: boolean;
  updateSettings: (key: string, value: any, stateSetter: (val: any) => void) => void;
  copilotState: "IDLE" | "SPEAKING_CHALLENGE" | "SPEAKING_RESPONSE" | "LISTENING" | "VALIDATING" | "SUCCESS";
  copilotKey: string;
  setCopilotKey: (val: string) => void;
  showFloatingButton: boolean;
  setShowFloatingButton: (val: boolean) => void;
  copilotInputMode: string;
  setCopilotInputMode: (val: string) => void;
}

export default function EFBSettings({
  availableVoices,
  selectedVoiceName,
  setSelectedVoiceName,
  speechRate,
  setSpeechRate,
  speechPitch,
  setSpeechPitch,
  triggerKeyword,
  setTriggerKeyword,
  playChime,
  setPlayChime,
  autoAdvance,
  setAutoAdvance,
  autoCollapse,
  setAutoCollapse,
  loadOverride,
  setLoadOverride,
  directionOverride,
  setDirectionOverride,
  aircraftOverride,
  setAircraftOverride,
  getCalculatedLoad,
  getFlightDirection,
  aircraftCode,
  testSelectedVoice,
  transcriptLog,
  coPilotRunning,
  updateSettings,
  copilotState,
  copilotKey,
  setCopilotKey,
  showFloatingButton,
  setShowFloatingButton,
  copilotInputMode,
  setCopilotInputMode,
}: EFBSettingsProps) {
  const aircraftsDb = useAppSelector((state) => state.aircraft.specs) || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* Left Column: Speech Engine Configurations */}
      <div className="bg-gray-50/50 rounded-2xl border border-brand-border p-5 space-y-5">
        <h3 className="text-base font-bold text-brand border-b border-brand-border pb-2.5">🗣️ Co-Pilot Voice Engine</h3>

        {/* Input Method Selection */}
        <div className="space-y-1">
          <label htmlFor="copilot-input-method-select" className="text-xs font-bold text-gray-500 block">CO-PILOT INPUT METHOD</label>
          <select
            id="copilot-input-method-select"
            value={copilotInputMode}
            onChange={e => updateSettings("copilot_input_mode", e.target.value, setCopilotInputMode)}
            className="select select-bordered select-sm w-full font-bold"
          >
            <option value="voice">🎙️ Voice Control (Microphone)</option>
            <option value="button">🖱️ Button &amp; Key Control</option>
          </select>
          <p className="text-[10px] text-gray-400 mt-1">
            Configure whether to check items by speaking, or manually tapping the button/key.
          </p>
        </div>
        
        {/* Voice Selection list */}
        <div className="space-y-1">
          <label htmlFor="copilot-voice-select" className="text-xs font-bold text-gray-500 block">AVAILABLE TTS VOICES</label>
          <select
            id="copilot-voice-select"
            value={selectedVoiceName}
            onChange={e => updateSettings("copilot_voice", e.target.value, setSelectedVoiceName)}
            className="select select-bordered select-sm w-full"
          >
            <option value="">System Default Voice</option>
            {availableVoices.map((voice, idx) => (
              <option key={idx} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>



        {/* Speech Speed Rate slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold text-gray-500">
            <label htmlFor="speech-rate-slider">SPEECH RATE SPEED</label>
            <span>{speechRate.toFixed(1)}x</span>
          </div>
          <input
            id="speech-rate-slider"
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={speechRate}
            onChange={e => updateSettings("copilot_rate", parseFloat(e.target.value), setSpeechRate)}
            className="range range-xs range-primary w-full"
          />
        </div>

        {/* Speech Pitch slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold text-gray-500">
            <label htmlFor="speech-pitch-slider">SPEECH PITCH LEVEL</label>
            <span>{speechPitch.toFixed(1)}</span>
          </div>
          <input
            id="speech-pitch-slider"
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={speechPitch}
            onChange={e => updateSettings("copilot_pitch", parseFloat(e.target.value), setSpeechPitch)}
            className="range range-xs range-primary w-full"
          />
        </div>

        <div className="pt-2">
          <button
            onClick={testSelectedVoice}
            className="w-full bg-brand-pale border border-brand text-brand hover:bg-brand-hover-bg text-sm font-bold py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
          >
            📢 Test Voice Configurations
          </button>
        </div>
      </div>

      {/* Right Column: Trigger keywords & Settings Override */}
      <div className="bg-gray-50/50 rounded-2xl border border-brand-border p-5 space-y-5">
        <h3 className="text-base font-bold text-brand border-b border-brand-border pb-2.5">🛠️ Voice Triggers &amp; Telemetry</h3>
        
        {/* Trigger Words input */}
        <div className="space-y-1">
          <label htmlFor="copilot-keywords-input" className="text-xs font-bold text-gray-500 block">SPEECH RECOGNITION KEYWORDS (Comma separated)</label>
          <input
            id="copilot-keywords-input"
            type="text"
            value={triggerKeyword}
            onChange={e => updateSettings("copilot_trigger", e.target.value, setTriggerKeyword)}
            className="input input-bordered input-sm w-full font-semibold"
            placeholder="e.g. check, checked, set, ok"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Whenever the microphone transcribes one of these words, it marks the current checklist item as completed.
          </p>
        </div>

        {/* Keyboard checklist key config */}
        <div className="space-y-1">
          <label htmlFor="copilot-advancing-key-select" className="text-xs font-bold text-gray-500 block">KEYBOARD CHECKLIST ADVANCING KEY</label>
          <select
            id="copilot-advancing-key-select"
            value={copilotKey}
            onChange={e => updateSettings("copilot_key", e.target.value, setCopilotKey)}
            className="select select-bordered select-sm w-full font-semibold"
          >
            <option value="Space">Space Bar</option>
            <option value="Enter">Enter Key</option>
            <option value="ArrowRight">Right Arrow Key</option>
            <option value="ArrowDown">Down Arrow Key</option>
            <option value="KeyC">C Key</option>
            <option value="KeyV">V Key</option>
          </select>
          <p className="text-[10px] text-gray-400 mt-1">
            Pressing this key on a desktop/laptop keyboard will automatically check off the current checklist item.
          </p>
        </div>

        {/* Settings Mic Tester */}
        <div className="bg-white rounded-xl border border-brand-border p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">
              {copilotInputMode === "voice" ? "🎙️ Settings Mic Tester" : "🎛️ Input Controller Mode"}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              copilotInputMode === "voice" 
                ? coPilotRunning ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                : "bg-brand/10 text-brand"
            }`}>
              {copilotInputMode === "voice" ? coPilotRunning ? "ACTIVE" : "OFFLINE" : "MANUAL"}
            </span>
          </div>
          {copilotInputMode === "voice" ? (
            <>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Speak here to verify what your browser speech recognition is capturing:
              </p>
              <div className="bg-gray-50 rounded-lg p-2.5 border border-brand-border min-h-[40px] flex items-center justify-center text-center">
                {transcriptLog ? (
                  <span className="text-xs font-mono font-bold text-brand">"{transcriptLog}"</span>
                ) : (
                  <span className="text-xs text-gray-400 italic">No speech captured yet...</span>
                )}
              </div>
            </>
          ) : (
            <p className="text-[11px] text-gray-500 leading-relaxed font-semibold text-gray-600">
              Microphone is offline. Press <kbd className="bg-gray-100 px-1.5 py-0.5 rounded border border-brand-border font-bold font-mono text-brand text-xs">{copilotKey === "Space" ? "Spacebar" : copilotKey}</kbd> on keyboard or tap the floating action button to check checklist items.
            </p>
          )}
        </div>

        {/* Settings toggles */}
        <div className="space-y-3 pt-1.5">
          <span className="text-xs font-bold text-gray-500 block">COPILOT BEHAVIORS</span>
          
          <label className="flex items-center gap-2.5 text-xs text-gray-600 font-semibold cursor-pointer label py-0 justify-start">
            <input
              type="checkbox"
              checked={playChime}
              onChange={e => updateSettings("copilot_chime", e.target.checked, setPlayChime)}
              className="checkbox checkbox-primary checkbox-sm cursor-pointer"
            />
            <span>Play electronic chime sound on success</span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-gray-600 font-semibold cursor-pointer label py-0 justify-start">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={e => updateSettings("copilot_auto_advance", e.target.checked, setAutoAdvance)}
              className="checkbox checkbox-primary checkbox-sm cursor-pointer"
            />
            <span>Auto-announce next item after checking off</span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-gray-600 font-semibold cursor-pointer label py-0 justify-start">
            <input
              type="checkbox"
              checked={autoCollapse}
              onChange={e => updateSettings("copilot_auto_collapse", e.target.checked, setAutoCollapse)}
              className="checkbox checkbox-primary checkbox-sm cursor-pointer"
            />
            <span>Auto-collapse finished phases and open next phase</span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-gray-600 font-semibold cursor-pointer label py-0 justify-start">
            <input
              type="checkbox"
              checked={showFloatingButton}
              onChange={e => updateSettings("copilot_show_floating", e.target.checked, setShowFloatingButton)}
              className="checkbox checkbox-primary checkbox-sm cursor-pointer"
            />
            <span>Show mobile/tablet floating advance button</span>
          </label>
        </div>

        {/* Overrides */}
        <div className="space-y-3 pt-2.5 border-t border-brand-border">
          <span className="text-xs font-bold text-gray-500 block">MANUAL TELEMETRY OVERRIDES</span>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="manual-load-input" className="text-[10px] text-gray-400 block font-bold">LOAD PERCENTAGE (%)</label>
              <input
                id="manual-load-input"
                type="number"
                min="0"
                max="100"
                value={loadOverride !== null ? loadOverride : ""}
                onChange={e => setLoadOverride(e.target.value ? Math.min(100, Math.max(0, parseInt(e.target.value, 10))) : null)}
                className="input input-bordered input-sm w-full font-mono"
                placeholder={`${getCalculatedLoad()}% (Calculated)`}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="manual-direction-select" className="text-[10px] text-gray-400 block font-bold">FLIGHT DIRECTION</label>
              <select
                id="manual-direction-select"
                value={directionOverride || ""}
                onChange={e => setDirectionOverride((e.target.value as any) || null)}
                className="select select-bordered select-sm w-full"
              >
                <option value="">{getFlightDirection().toUpperCase()} (Calculated)</option>
                <option value="east">EASTBOUND</option>
                <option value="west">WESTBOUND</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="force-aircraft-profile-select" className="text-[10px] text-gray-400 block font-bold">FORCE AIRCRAFT PROFILE</label>
            <select
              id="force-aircraft-profile-select"
              value={aircraftOverride || ""}
              onChange={e => setAircraftOverride(e.target.value || null)}
              className="select select-bordered select-sm w-full"
            >
              <option value="">{aircraftCode || "None (Default)"}</option>
              {Object.keys(aircraftsDb).map(code => (
                <option key={code} value={code}>
                  {code} - {aircraftsDb[code as keyof typeof aircraftsDb].properties.full_name}
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

    </div>
  );
}
