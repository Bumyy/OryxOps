import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import useReveal from "../hooks/useReveal";
import checklistTemplate from "../assets/checklist/checklist_template.json";
import aircraftsDb from "../assets/checklist/aircrafts.json";
import EFBBriefing from "../components/efb/EFBBriefing";
import EFBChecklist from "../components/efb/EFBChecklist";
import EFBSettings from "../components/efb/EFBSettings";
import EFBWeather from "../components/efb/EFBWeather";

export default function EFB() {
  const revealRef = useReveal();
  
  // Base Connection & OFP States
  const [simbriefUsername, setSimbriefUsername] = useState(() => {
    return localStorage.getItem("simbrief_pilot_id") || "";
  });
  const [isSavedPilotId, setIsSavedPilotId] = useState(!!localStorage.getItem("simbrief_pilot_id"));
  const [zuluTime, setZuluTime] = useState("");
  const [ofpData, setOfpData] = useState<any>(null);
  const [loadingOfp, setLoadingOfp] = useState(false);
  const [ofpError, setOfpError] = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState(false);

  // Tab state derived from router path
  const location = useLocation();
  const activeTab = location.pathname === "/efb/checklist"
    ? "checklist"
    : location.pathname === "/efb/weather"
    ? "weather"
    : location.pathname === "/efb/settings"
    ? "settings"
    : "briefing";

  // Checklist Overrides State
  const [aircraftOverride, setAircraftOverride] = useState<string | null>(null);
  const [loadOverride, setLoadOverride] = useState<number | null>(null);
  const [directionOverride, setDirectionOverride] = useState<"east" | "west" | null>(null);

  // Co-Pilot Settings State
  const [selectedVoiceName, setSelectedVoiceName] = useState(() => localStorage.getItem("copilot_voice") || "");
  const [speechRate, setSpeechRate] = useState(() => parseFloat(localStorage.getItem("copilot_rate") || "1.0"));
  const [speechPitch, setSpeechPitch] = useState(() => parseFloat(localStorage.getItem("copilot_pitch") || "1.0"));
  const [triggerKeyword, setTriggerKeyword] = useState(() => localStorage.getItem("copilot_trigger") || "check");
  const [playChime, setPlayChime] = useState(() => localStorage.getItem("copilot_chime") !== "false");
  const [autoAdvance, setAutoAdvance] = useState(() => localStorage.getItem("copilot_auto_advance") !== "false");
  const [autoCollapse, setAutoCollapse] = useState(() => localStorage.getItem("copilot_auto_collapse") !== "false");

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [coPilotRunning, setCoPilotRunning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcriptLog, setTranscriptLog] = useState("");
  const [copilotState, setCopilotState] = useState<"IDLE" | "SPEAKING_CHALLENGE" | "SPEAKING_RESPONSE" | "LISTENING" | "VALIDATING" | "SUCCESS">("IDLE");

  // Checklist Engine States
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("copilot_checked_items");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [activePhaseIndex, setActivePhaseIndex] = useState<number>(() => {
    const saved = localStorage.getItem("copilot_active_phase_index");
    return saved ? parseInt(saved, 10) : 0;
  });

  const recognitionRef = useRef<any>(null);

  // Save Settings Helper
  const updateSettings = (key: string, value: any, setter: Function) => {
    localStorage.setItem(key, String(value));
    setter(value);
  };

  // Sync checklist progress state to browser cache
  useEffect(() => {
    localStorage.setItem("copilot_checked_items", JSON.stringify(checkedItems));
  }, [checkedItems]);

  useEffect(() => {
    localStorage.setItem("copilot_active_phase_index", String(activePhaseIndex));
  }, [activePhaseIndex]);

  // Load SpeechSynthesis voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        if (voices.length > 0 && !localStorage.getItem("copilot_voice")) {
          const defaultVoice = voices.find(v => v.lang.startsWith("en")) || voices[0];
          setSelectedVoiceName(defaultVoice.name);
          localStorage.setItem("copilot_voice", defaultVoice.name);
        }
      }
    };
    updateVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

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

  // Dynamic Variable Calculations for Checklist
  const getCalculatedLoad = () => {
    if (!ofpData) return 78;
    const payload = parseFloat(ofpData.weights?.payload);
    const maxTow = parseFloat(ofpData.weights?.max_tow);
    const oew = parseFloat(ofpData.weights?.oew);
    if (!isNaN(payload) && !isNaN(maxTow) && !isNaN(oew) && maxTow - oew > 0) {
      return Math.min(100, Math.max(0, Math.round((payload / (maxTow - oew)) * 100)));
    }
    return 78;
  };

  const activeLoad = loadOverride !== null ? loadOverride : getCalculatedLoad();

  const getFlightDirection = () => {
    if (!ofpData) return "east";
    const depLon = parseFloat(ofpData.origin?.pos_long);
    const arrLon = parseFloat(ofpData.destination?.pos_long);
    if (isNaN(depLon) || isNaN(arrLon)) return "east";
    let diff = arrLon - depLon;
    if (Math.abs(diff) > 180) {
      diff = diff > 0 ? diff - 360 : diff + 360;
    }
    return diff < 0 ? "west" : "east";
  };

  const activeDirection = directionOverride !== null ? directionOverride : getFlightDirection();

  const aircraftCode = ofpData?.aircraft?.icao_code?.toUpperCase() || "";
  const activeAircraft = aircraftOverride || aircraftCode;
  const aircraftInfo = aircraftsDb[activeAircraft as keyof typeof aircraftsDb] as any;

  // Retrieve performance data
  const getPerformanceData = () => {
    const defaultData = {
      takeoff_flaps: "1",
      n1_target: "90%",
      vr_speed: "140",
      va_speed: "145",
      cruise_altitude: "FL350",
      initial_climb_vs: "2200",
      vs_5k: "1800",
      vs_15k: "1400",
      vs_24k: "1000",
      initial_speed: "250",
      accel_speed_10k: "280",
      mach_transition_alt: "FL280",
      mach_speed: "0.80",
      descent_speed_profile: {},
      flap_speeds: {},
      engine_start_sequence: [1, 2],
      engine_stable_percentage: 20
    };
    if (!aircraftInfo) return defaultData;
    const acData = aircraftInfo.performance_data;
    
    const takeoffPerf = acData.takeoff_data.find(
      (p: any) => p.load_range[0] <= activeLoad && activeLoad <= p.load_range[1]
    ) || acData.takeoff_data[acData.takeoff_data.length - 1];

    const cruiseProfile = acData.cruise_profile[activeDirection] || acData.cruise_profile["east"];
    const cruisePerf = cruiseProfile.find(
      (p: any) => p.load_range[0] <= activeLoad && activeLoad <= p.load_range[1]
    ) || cruiseProfile[cruiseProfile.length - 1];

    return {
      takeoff_flaps: takeoffPerf?.flaps || "1",
      n1_target: takeoffPerf?.n1 || "90%",
      vr_speed: String(takeoffPerf?.vr || "140"),
      va_speed: String(takeoffPerf?.va || "145"),
      cruise_altitude: cruisePerf?.altitude || "FL350",
      initial_climb_vs: acData.climb_vs_profile?.["0_5000"] || "2200",
      vs_5k: acData.climb_vs_profile?.["5000_15000"] || "1800",
      vs_15k: acData.climb_vs_profile?.["15000_24000"] || "1400",
      vs_24k: acData.climb_vs_profile?.["24000_cruise"] || "1000",
      initial_speed: acData.speed_profile?.initial_speed || "250",
      accel_speed_10k: acData.speed_profile?.above_10k || "280",
      mach_transition_alt: acData.speed_profile?.mach_transition_alt || "FL280",
      mach_speed: acData.speed_profile?.mach || "0.80",
      descent_speed_profile: acData.descent_speed_profile || {},
      flap_speeds: acData.flap_speeds || {},
      engine_start_sequence: aircraftInfo.engine_start_sequence || [1, 2],
      engine_stable_percentage: aircraftInfo.engine_stable_percentage || 20
    };
  };

  // Compile checklist items dynamically
  const getCompiledChecklist = () => {
    const perf = getPerformanceData();
    const placeholders: Record<string, string> = {
      load_percentage: String(activeLoad),
      cruise_altitude: perf.cruise_altitude,
      takeoff_flaps: perf.takeoff_flaps,
      n1_target: perf.n1_target,
      vr_speed: perf.vr_speed,
      va_speed: perf.va_speed,
      initial_climb_vs: perf.initial_climb_vs,
      vs_5k: perf.vs_5k,
      vs_15k: perf.vs_15k,
      vs_24k: perf.vs_24k,
      initial_speed: perf.initial_speed,
      accel_speed_10k: perf.accel_speed_10k,
      mach_transition_alt: perf.mach_transition_alt,
      mach_speed: perf.mach_speed
    };

    return checklistTemplate.checklist.map((section: any, sIdx: number) => {
      const items: Array<{ id: string; text: string; value: string; isTable?: boolean; tableData?: any }> = [];

      if (section.items) {
        section.items.forEach((item: any, iIdx: number) => {
          let resolvedValue = item.value;
          
          if (resolvedValue.includes("REDUCE VS TO")) {
            try {
              let curr = 0, targ = 0;
              if (resolvedValue.includes("{vs_5k}")) {
                curr = parseInt(perf.initial_climb_vs, 10);
                targ = parseInt(perf.vs_5k, 10);
              } else if (resolvedValue.includes("{vs_15k}")) {
                curr = parseInt(perf.vs_5k, 10);
                targ = parseInt(perf.vs_15k, 10);
              } else if (resolvedValue.includes("{vs_24k}")) {
                curr = parseInt(perf.vs_15k, 10);
                targ = parseInt(perf.vs_24k, 10);
              }
              if (targ > curr) resolvedValue = resolvedValue.replace("REDUCE", "INCREASE");
            } catch {}
          }

          Object.entries(placeholders).forEach(([k, v]) => {
            resolvedValue = resolvedValue.replace(`{${k}}`, v);
          });

          let extraNote = "";
          if (item.text === "TAKEOFF FLAPS" && aircraftInfo?.flap_notam) {
            if (perf.takeoff_flaps.includes("/")) {
              extraNote = aircraftInfo.flap_notam;
            }
          }

          items.push({
            id: `item-${sIdx}-${iIdx}-main`,
            text: item.text,
            value: resolvedValue + (extraNote ? ` (NOTE: ${extraNote})` : "")
          });
        });
      }

      if (section.special_section) {
        if (section.special_section === "engine_start") {
          perf.engine_start_sequence.forEach((engNum: number, eIdx: number) => {
            items.push({
              id: `item-${sIdx}-${eIdx}-eng-start`,
              text: `ENGINE ${engNum}`,
              value: "START"
            });
            items.push({
              id: `item-${sIdx}-${eIdx}-eng-stable`,
              text: `ENGINE ${engNum}`,
              value: `STABLE (${perf.engine_stable_percentage}%)`
            });
          });
        } else if (section.special_section === "flap_retraction_below_10k") {
          const speedThreshold = aircraftInfo?.speed_threshold_10k || 250;
          const takeoffFlap = perf.takeoff_flaps;
          const hasMultipleFlaps = takeoffFlap.includes("/");

          if (aircraftInfo?.flap_retraction_schedule) {
            const schedule = aircraftInfo.flap_retraction_schedule;
            let takeoffIdx = -1;
            if (!hasMultipleFlaps) {
              takeoffIdx = schedule.findIndex((step: any) => step.setting === takeoffFlap);
            }
            schedule.forEach((step: any, stepIdx: number) => {
              if (step.speed <= speedThreshold) {
                if (!hasMultipleFlaps && takeoffIdx !== -1 && stepIdx <= takeoffIdx) return;
                items.push({
                  id: `item-${sIdx}-${stepIdx}-flap-ret-blw`,
                  text: `AS SPEED INCREASES, AT ${step.speed} KTS`,
                  value: `SET FLAPS ${step.setting}`
                });
              }
            });
          } else {
            const flap1Speed = perf.flap_speeds["1"] || 245;
            const flap5Speed = perf.flap_speeds["5"] || 230;
            if (hasMultipleFlaps) {
              const options = takeoffFlap.split("/");
              const lowerFlap = options[0];
              const higherFlap = options[1] || lowerFlap;
              const higherFlapSpeed = perf.flap_speeds[higherFlap] || 230;
              const lowerFlapSpeed = perf.flap_speeds[lowerFlap] || 245;

              if (higherFlapSpeed <= speedThreshold) {
                items.push({
                  id: `item-${sIdx}-flap-ret-blw-h`,
                  text: `AS SPEED INCREASES, AT ${higherFlapSpeed} KTS`,
                  value: `SET FLAPS ${lowerFlap} (if flaps ${higherFlap} selected during takeoff)`
                });
              }
              if (lowerFlapSpeed <= speedThreshold) {
                items.push({
                  id: `item-${sIdx}-flap-ret-blw-l`,
                  text: `AS SPEED INCREASES, AT ${lowerFlapSpeed} KTS`,
                  value: `SET FLAPS 1 (if flaps ${lowerFlap} selected during takeoff)`
                });
              }
            } else {
              if (takeoffFlap === "5") {
                items.push({
                  id: `item-${sIdx}-flap-ret-blw-5`,
                  text: `AS SPEED INCREASES, AT ${flap1Speed} KTS`,
                  value: "SET FLAPS 1"
                });
              } else if (takeoffFlap === "15") {
                items.push({
                  id: `item-${sIdx}-flap-ret-blw-15a`,
                  text: `AS SPEED INCREASES, AT ${flap5Speed} KTS`,
                  value: "SET FLAPS 5"
                });
                items.push({
                  id: `item-${sIdx}-flap-ret-blw-15b`,
                  text: `AS SPEED INCREASES, AT ${flap1Speed} KTS`,
                  value: "SET FLAPS 1"
                });
              }
            }
          }
        } else if (section.special_section === "flap_retraction_above_10k") {
          const speedThreshold = aircraftInfo?.speed_threshold_10k || 250;
          if (aircraftInfo?.flap_retraction_schedule) {
            const schedule = aircraftInfo.flap_retraction_schedule;
            schedule.forEach((step: any, stepIdx: number) => {
              if (step.speed > speedThreshold) {
                items.push({
                  id: `item-${sIdx}-${stepIdx}-flap-ret-abv`,
                  text: `AS SPEED INCREASES, AT ${step.speed} KTS`,
                  value: `SET FLAPS ${step.setting}`
                });
              }
            });
          } else {
            const flap1Speed = perf.flap_speeds["1"] || 265;
            items.push({
              id: `item-${sIdx}-flap-ret-abv-d`,
              text: `AS SPEED INCREASES, AT ${flap1Speed} KTS`,
              value: "SET FLAPS 0"
            });
          }
        } else if (section.special_section === "step_climb") {
          const cruiseProfile = aircraftInfo?.performance_data?.cruise_profile?.[activeDirection] || [];
          const stepClimbs = cruiseProfile.filter((p: any) => p.load_range[1] < activeLoad);
          if (stepClimbs.length > 0) {
            items.push({
              id: `item-${sIdx}-step-climb-hdr`,
              text: "STEP CLIMB (IF POSSIBLE)",
              value: "ADVISED"
            });
            const sortedSteps = [...stepClimbs].sort((a: any, b: any) => b.load_range[1] - a.load_range[1]);
            sortedSteps.forEach((step: any, stepIdx: number) => {
              items.push({
                id: `item-${sIdx}-${stepIdx}-step-climb-item`,
                text: `AT ${step.load_range[1]}% LOAD`,
                value: `CLIMB TO ${step.altitude}`
              });
            });
          }
        } else if (section.special_section === "descent_speed_profile") {
          Object.entries(perf.descent_speed_profile).forEach(([phase, speed]: [string, any], pIdx: number) => {
            const phaseText = phase.replace(/_/g, " ").replace("fl", "FL").toUpperCase();
            items.push({
              id: `item-${sIdx}-${pIdx}-desc-spd`,
              text: `${phaseText}`,
              value: `${speed}`
            });
          });
        } else if (section.special_section === "flap_deploy_above_10k" || section.special_section === "flap_deploy_below_10k") {
          const speedThreshold = aircraftInfo?.speed_threshold_10k || 250;
          const sortedFlaps = Object.entries(perf.flap_speeds).sort((a: any, b: any) => (b[1] as number) - (a[1] as number));
          sortedFlaps.forEach(([flapSetting, speed]: [string, any], fIdx: number) => {
            const isAbove = speed > speedThreshold;
            const matchesSection = section.special_section === "flap_deploy_above_10k" ? isAbove : !isAbove;
            if (matchesSection) {
              let resolvedFlapVal = `SET FLAPS ${flapSetting}`;
              if (flapSetting === "40" && aircraftCode === "B38M") {
                resolvedFlapVal += " (Short Runway Only)";
              }
              items.push({
                id: `item-${sIdx}-${fIdx}-flap-dep-${section.special_section}`,
                text: `AS SPEED DECREASES, AT ${speed} KTS`,
                value: resolvedFlapVal
              });
            }
          });
        }
      }

      if (section.items_after_special) {
        section.items_after_special.forEach((item: any, iIdx: number) => {
          let resolvedValue = item.value;
          if (resolvedValue.includes("REDUCE VS TO")) {
            try {
              let curr = 0, targ = 0;
              if (resolvedValue.includes("{vs_5k}")) {
                curr = parseInt(perf.initial_climb_vs, 10);
                targ = parseInt(perf.vs_5k, 10);
              } else if (resolvedValue.includes("{vs_15k}")) {
                curr = parseInt(perf.vs_5k, 10);
                targ = parseInt(perf.vs_15k, 10);
              } else if (resolvedValue.includes("{vs_24k}")) {
                curr = parseInt(perf.vs_15k, 10);
                targ = parseInt(perf.vs_24k, 10);
              }
              if (targ > curr) resolvedValue = resolvedValue.replace("REDUCE", "INCREASE");
            } catch {}
          }
          Object.entries(placeholders).forEach(([k, v]) => {
            resolvedValue = resolvedValue.replace(`{${k}}`, v);
          });
          items.push({
            id: `item-${sIdx}-${iIdx}-after-sp`,
            text: item.text,
            value: resolvedValue
          });
        });
      }

      if (section.special_section_2) {
        if (section.special_section_2 === "flap_deploy_above_10k") {
          const speedThreshold = aircraftInfo?.speed_threshold_10k || 250;
          const sortedFlaps = Object.entries(perf.flap_speeds).sort((a: any, b: any) => (b[1] as number) - (a[1] as number));
          sortedFlaps.forEach(([flapSetting, speed]: [string, any], fIdx: number) => {
            if (speed > speedThreshold) {
              let resolvedFlapVal = `SET FLAPS ${flapSetting}`;
              if (flapSetting === "40" && aircraftCode === "B38M") {
                resolvedFlapVal += " (Short Runway Only)";
              }
              items.push({
                id: `item-${sIdx}-${fIdx}-flap-dep-sp2`,
                text: `AS SPEED DECREASES, AT ${speed} KTS`,
                value: resolvedFlapVal
              });
            }
          });
        } else if (section.special_section_2 === "landing_data_table") {
          const landingData = aircraftInfo?.performance_data?.landing_data || [];
          const filteredData = landingData.filter((ld: any) => ld.load_range[1] <= activeLoad);
          const sortedLanding = [...filteredData].sort((a: any, b: any) => b.load_range[1] - a.load_range[1]);
          
          if (sortedLanding.length > 0) {
            items.push({
              id: `item-${sIdx}-landing-table`,
              text: "LANDING DATA TABLE",
              value: "DISPLAYED",
              isTable: true,
              tableData: sortedLanding
            });
            if (aircraftInfo?.performance_data?.landing_notam) {
              items.push({
                id: `item-${sIdx}-landing-notam`,
                text: "LANDING NOTAM",
                value: aircraftInfo.performance_data.landing_notam
              });
            }
          }
        }
      }

      if (section.items_after_table) {
        section.items_after_table.forEach((item: any, iIdx: number) => {
          let resolvedValue = item.value;
          Object.entries(placeholders).forEach(([k, v]) => {
            resolvedValue = resolvedValue.replace(`{${k}}`, v);
          });
          items.push({
            id: `item-${sIdx}-${iIdx}-after-tbl`,
            text: item.text,
            value: resolvedValue
          });
        });
      }

      return {
        title: section.title,
        text_section: section.text_section || null,
        items
      };
    });
  };

  const compiledChecklist = getCompiledChecklist();

  // Dynamic accepted response variations for fuzzy matching
  const getAcceptedResponses = (text: string, value: string): string[] => {
    const cleanVal = value.toLowerCase().trim();
    
    // Always valid generic pilot confirmations
    const base = ["check", "checked", "set", "done", "confirm", "confirmed"];
    const results = [cleanVal, ...base];

    if (cleanVal === "on") {
      results.push("on", "active", "engaged");
    } else if (cleanVal === "off") {
      results.push("off", "deactivated", "cut");
    } else if (cleanVal.includes("start")) {
      results.push("start", "run", "running", "on");
    } else if (cleanVal.includes("connect")) {
      results.push("connected", "connect", "hooked up");
    } else if (cleanVal.includes("disconnect")) {
      results.push("disconnected", "disconnect", "removed");
    } else if (cleanVal === "rotate") {
      results.push("rotate", "rotation", "lifting");
    } else if (cleanVal.includes("gear up")) {
      results.push("gear up", "up", "retracted");
    } else if (cleanVal.includes("arm")) {
      results.push("armed", "arm", "spoilers armed");
    } else if (cleanVal.includes("%")) {
      const digits = cleanVal.replace(/[^0-9]/g, "");
      if (digits) {
        results.push(digits, `${digits}%`, `${digits} percent`, "set", "checked");
      }
    }

    return Array.from(new Set(results.map(r => r.trim()).filter(r => r.length > 0)));
  };

  // String similarity score computation (Levenshtein + substring fallback)
  const calculateSimilarity = (s1: string, s2: string): number => {
    s1 = s1.toLowerCase().trim();
    s2 = s2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;

    const m = s1.length;
    const n = s2.length;
    if (m === 0) return n === 0 ? 1.0 : 0.0;
    if (n === 0) return 0.0;

    const d: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost
        );
      }
    }

    const distance = d[m][n];
    const maxLength = Math.max(m, n);
    return 1.0 - (distance / maxLength);
  };

  // Phonetic translation dictionary for natural pronunciation
  const getPhoneticText = (str: string) => {
    if (!str) return "";
    return str
      .replace(/\bPAX\b/gi, "passengers")
      .replace(/\bZFW\b/gi, "zero fuel weight")
      .replace(/\bTOW\b/gi, "takeoff weight")
      .replace(/\bLAW\b/gi, "landing weight")
      .replace(/\bAPU\b/gi, "A P U")
      .replace(/\bGPU\b/gi, "G P U")
      .replace(/\bSID\b/gi, "S I D")
      .replace(/\bSTAR\b/gi, "Star")
      .replace(/\bLNAV\b/gi, "L Nav")
      .replace(/\bVNAV\b/gi, "V Nav")
      .replace(/\bATIS\b/gi, "Ay tis")
      .replace(/\bMETAR\b/gi, "Mee tar")
      .replace(/\bALTN\b/gi, "alternate")
      .replace(/\bFT\b/gi, "feet")
      .replace(/\bFL\b/gi, "flight level")
      .replace(/\bKTS\b/gi, "knots")
      .replace(/\bAPPR\b/gi, "approach")
      .replace(/\bVS\b/gi, "vertical speed")
      .replace(/\bBAG\/CARGO\b/gi, "baggage and cargo")
      .replace(/\bSTAB TRIM\b/gi, "stabilizer trim")
      .replace(/\bN\/A\b/gi, "not applicable")
      .replace(/\bETA\b/gi, "E T A")
      .replace(/➔/g, "to")
      .replace(/→/g, "to")
      // Spell out 4-letter ICAO codes letter-by-letter (e.g. SBGR -> S B G R)
      .replace(/\b([A-Z]{4})\b/g, (match) => match.split("").join(" "));
  };

  // Synthesize Web Audio Radio Mic Click (Subtle VHF radio pop)
  const playMicClick = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bufferSize = audioCtx.sampleRate * 0.035; // 35ms burst
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate bandpass-shaped high-frequency random pop
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 900; // Radio speaker center frequency
      filter.Q.value = 1.2;
      
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.035);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      
      noise.start();
    } catch (e) {
      console.warn("Mic click failed", e);
    }
  };

  // TTS Reader
  const announceChecklistItem = (text: string, value: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    setCopilotState("SPEAKING_CHALLENGE");

    // Turn microphone off while co-pilot is speaking to avoid hearing itself or ambient loops
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }

    window.speechSynthesis.cancel(); 

    const cleanText = getPhoneticText(text);
    const cleanValue = getPhoneticText(value);

    // Play click before challenge
    playMicClick();

    // Create challenge callout
    const challengeUtterance = new SpeechSynthesisUtterance(cleanText);
    if (selectedVoiceName) {
      const voice = availableVoices.find(v => v.name === selectedVoiceName);
      if (voice) challengeUtterance.voice = voice;
    }
    challengeUtterance.rate = speechRate;
    challengeUtterance.pitch = speechPitch;

    // Speak the response after a natural 450ms pilot pause
    challengeUtterance.onend = () => {
      if (!coPilotRunningRef.current) return;
      setCopilotState("SPEAKING_RESPONSE");
      setTimeout(() => {
        if (!coPilotRunningRef.current) return;
        
        playMicClick();

        const responseUtterance = new SpeechSynthesisUtterance(cleanValue);
        if (selectedVoiceName) {
          const voice = availableVoices.find(v => v.name === selectedVoiceName);
          if (voice) responseUtterance.voice = voice;
        }
        responseUtterance.rate = speechRate;
        responseUtterance.pitch = speechPitch;

        // When response finishes, play hot-mic pop and start listening
        responseUtterance.onend = () => {
          setTimeout(() => {
            if (coPilotRunningRef.current) {
              playMicClick();
              setCopilotState("LISTENING");
              if (!isListeningRef.current) {
                try {
                  recognitionRef.current?.start();
                  setIsListening(true);
                } catch (err) {
                  console.warn("Speech start after TTS failed:", err);
                }
              }
            }
          }, 100);
        };

        window.speechSynthesis.speak(responseUtterance);
      }, 450);
    };

    window.speechSynthesis.speak(challengeUtterance);
  };



  // Synthesize Web Audio Success Chime
  const playSuccessChime = () => {
    if (!playChime) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine";
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      console.warn("Chime failed", e);
    }
  };

  // Find next unchecked item
  const getFirstUncheckedItemInPhase = (phaseIdx: number) => {
    const section = compiledChecklist[phaseIdx];
    if (!section) return null;
    return section.items.find((item: any) => !checkedItems[item.id] && !item.isTable) || null;
  };

  // Check off active item and advance
  const handleCheckActiveItem = (itemIdOverride?: string) => {
    let targetItemId = "";

    if (itemIdOverride) {
      targetItemId = itemIdOverride;
    } else {
      const activeItem = getFirstUncheckedItemInPhase(activePhaseIndex);
      if (activeItem) {
        targetItemId = activeItem.id;
      }
    }

    if (!targetItemId) return;

    setCopilotState("SUCCESS");
    setCheckedItems(prev => {
      const next = { ...prev, [targetItemId]: true };
      playSuccessChime();

      if (coPilotRunning && autoAdvance) {
        setTimeout(() => {
          const nextActiveItem = compiledChecklist[activePhaseIndex].items.find((item: any) => !next[item.id] && !item.isTable);
          if (nextActiveItem) {
            announceChecklistItem(nextActiveItem.text, nextActiveItem.value);
          } else {
            if (activePhaseIndex < compiledChecklist.length - 1) {
              const nextPhase = activePhaseIndex + 1;
              if (autoCollapse) {
                setActivePhaseIndex(nextPhase);
              }
              const firstItemOfNextPhase = compiledChecklist[nextPhase].items.find((item: any) => !next[item.id] && !item.isTable);
              if (firstItemOfNextPhase) {
                announceChecklistItem(firstItemOfNextPhase.text, firstItemOfNextPhase.value);
              }
            } else {
              if (typeof window !== "undefined" && window.speechSynthesis) {
                window.speechSynthesis.speak(new SpeechSynthesisUtterance("Checklist completed. Have a safe flight."));
              }
              setCoPilotRunning(false);
              setIsListening(false);
            }
          }
        }, 700);
      } else if (coPilotRunning && !autoAdvance) {
        // If not auto-advancing, restart microphone listening on a fresh session after the beep
        setTimeout(() => {
          if (coPilotRunningRef.current && !isListeningRef.current) {
            try {
              recognitionRef.current?.start();
              setIsListening(true);
            } catch {}
          }
        }, 500);
      }

      return next;
    });
  };

  // Prevent stale closures in Speech Recognition event listeners
  const triggerKeywordRef = useRef(triggerKeyword);
  const coPilotRunningRef = useRef(coPilotRunning);
  const isListeningRef = useRef(isListening);
  const activePhaseIndexRef = useRef(activePhaseIndex);
  const handleCheckActiveItemRef = useRef(handleCheckActiveItem);

  useEffect(() => { triggerKeywordRef.current = triggerKeyword; }, [triggerKeyword]);
  useEffect(() => { coPilotRunningRef.current = coPilotRunning; }, [coPilotRunning]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { activePhaseIndexRef.current = activePhaseIndex; }, [activePhaseIndex]);
  useEffect(() => { handleCheckActiveItemRef.current = handleCheckActiveItem; }, [handleCheckActiveItem]);

  // Speech Recognition listener loop
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported.");
      return;
    }

    let rec = recognitionRef.current;
    if (!rec) {
      rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onresult = (event: any) => {
        const lastResultIndex = event.results.length - 1;
        const rawTranscript = event.results[lastResultIndex][0].transcript;
        const transcript = rawTranscript.trim().toLowerCase();
        console.log("Speech transcript:", transcript);
        
        // Show live transcript to the user for testing
        setTranscriptLog(rawTranscript);
        setCopilotState("VALIDATING");

        // 1. Check for manual keyword overrides (like "check" or "checked")
        const keywords = triggerKeywordRef.current.split(",").map(k => k.trim().toLowerCase());
        const hasKeywordMatch = keywords.some(kw => {
          const regex = new RegExp(`\\b${kw}\\b`, "i");
          return regex.test(transcript) || transcript.includes(kw);
        });

        // 2. Check for expected value fuzzy matching
        let hasFuzzyMatch = false;
        const activeItem = getFirstUncheckedItemInPhase(activePhaseIndexRef.current);
        if (activeItem) {
          const accepted = getAcceptedResponses(activeItem.text, activeItem.value);
          hasFuzzyMatch = accepted.some(acc => calculateSimilarity(transcript, acc) >= 0.82);
        }

        if (hasKeywordMatch || hasFuzzyMatch) {
          // Immediately stop recognition to clear native audio buffer & prevent echo loops
          try {
            rec.stop();
          } catch {}
          setIsListening(false);
          
          handleCheckActiveItemRef.current();
        } else {
          // Revert state back to listening if mismatch occurred
          setCopilotState("LISTENING");
        }
      };

      rec.onerror = (e: any) => {
        console.error("Speech recognition error:", e);
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setIsListening(false);
          setCoPilotRunning(false);
        }
      };

      rec.onend = () => {
        // Only restart if co-pilot is running, isListening is true, and the co-pilot is not actively speaking
        if (
          coPilotRunningRef.current &&
          isListeningRef.current &&
          typeof window !== "undefined" &&
          !window.speechSynthesis.speaking
        ) {
          try {
            rec.start();
          } catch {}
        }
      };

      recognitionRef.current = rec;
    }

    if (coPilotRunning && !isListening) {
      // Do not start recording if the browser is currently announcing a checklist item
      if (typeof window !== "undefined" && !window.speechSynthesis.speaking) {
        try {
          rec.start();
          setIsListening(true);
        } catch (err) {
          console.warn("Recognition start failed:", err);
        }
      }
    } else if (!coPilotRunning && isListening) {
      try {
        rec.stop();
        setIsListening(false);
      } catch {}
    }

    return () => {
      // Cleanups
    };
  }, [coPilotRunning, isListening, triggerKeyword, activePhaseIndex]);

  const toggleCoPilot = () => {
    if (coPilotRunning) {
      setCoPilotRunning(false);
      setIsListening(false);
      setTranscriptLog("");
      setCopilotState("IDLE");
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } else {
      const activeItem = getFirstUncheckedItemInPhase(activePhaseIndex);
      setCoPilotRunning(true);
      setTranscriptLog("");
      if (activeItem) {
        announceChecklistItem(activeItem.text, activeItem.value);
      }
    }
  };

  const handleResetChecklist = () => {
    setCheckedItems({});
    setActivePhaseIndex(0);
    setCoPilotRunning(false);
    setIsListening(false);
    setTranscriptLog("");
    setCopilotState("IDLE");
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const testSelectedVoice = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    playMicClick();
    const utterance = new SpeechSynthesisUtterance("Co pilot settings updated successfully. Standby.");
    if (selectedVoiceName) {
      const voice = availableVoices.find(v => v.name === selectedVoiceName);
      if (voice) utterance.voice = voice;
    }
    utterance.rate = speechRate;
    utterance.pitch = speechPitch;
    utterance.onend = () => {
      playMicClick();
    };
    window.speechSynthesis.speak(utterance);
  };

  const units = ofpData?.params?.units || "";
  const flightNum = ofpData?.general?.icao_airline && ofpData?.general?.flight_number
    ? `${ofpData.general.icao_airline}${ofpData.general.flight_number}`
    : ofpData?.general?.flight_number || "—";

  // Calculate checklist progress percentages
  const getTotalChecklistItems = () => {
    return compiledChecklist.reduce((acc: number, sec: any) => {
      return acc + sec.items.filter((it: any) => !it.isTable).length;
    }, 0);
  };

  const getCheckedItemsCount = () => {
    let checkedCount = 0;
    compiledChecklist.forEach((sec: any) => {
      sec.items.forEach((it: any) => {
        if (!it.isTable && checkedItems[it.id]) checkedCount++;
      });
    });
    return checkedCount;
  };

  const totalItems = getTotalChecklistItems();
  const checkedItemsCount = getCheckedItemsCount();
  const checklistProgressPercent = totalItems > 0 ? Math.round((checkedItemsCount / totalItems) * 100) : 0;

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
            {activeTab === "briefing" && (
              <EFBBriefing
                ofpData={ofpData}
                units={units}
                flightNum={flightNum}
                formatTimestampToTime={formatTimestampToTime}
                formatWeight={formatWeight}
                getPdfUrl={getPdfUrl}
                handleRefreshOfp={handleRefreshOfp}
                pdfLoadError={pdfLoadError}
                setPdfLoadError={setPdfLoadError}
                handleToggleFullscreen={handleToggleFullscreen}
              />
            )}

            {activeTab === "checklist" && (
              <EFBChecklist
                compiledChecklist={compiledChecklist}
                checkedItems={checkedItems}
                checkedItemsCount={checkedItemsCount}
                totalItems={totalItems}
                checklistProgressPercent={checklistProgressPercent}
                aircraftInfo={aircraftInfo}
                activeAircraft={activeAircraft}
                activeLoad={activeLoad}
                activeDirection={activeDirection}
                aircraftCode={aircraftCode}
                setAircraftOverride={setAircraftOverride}
                coPilotRunning={coPilotRunning}
                isListening={isListening}
                transcriptLog={transcriptLog}
                triggerKeyword={triggerKeyword}
                toggleCoPilot={toggleCoPilot}
                handleResetChecklist={handleResetChecklist}
                handleCheckActiveItem={handleCheckActiveItem}
                announceChecklistItem={announceChecklistItem}
                activePhaseIndex={activePhaseIndex}
                setActivePhaseIndex={setActivePhaseIndex}
                copilotState={copilotState}
              />
            )}

            {activeTab === "weather" && (
              <EFBWeather ofpData={ofpData} />
            )}

            {activeTab === "settings" && (
              <EFBSettings
                availableVoices={availableVoices}
                selectedVoiceName={selectedVoiceName}
                setSelectedVoiceName={setSelectedVoiceName}
                speechRate={speechRate}
                setSpeechRate={setSpeechRate}
                speechPitch={speechPitch}
                setSpeechPitch={setSpeechPitch}
                triggerKeyword={triggerKeyword}
                setTriggerKeyword={setTriggerKeyword}
                playChime={playChime}
                setPlayChime={setPlayChime}
                autoAdvance={autoAdvance}
                setAutoAdvance={setAutoAdvance}
                autoCollapse={autoCollapse}
                setAutoCollapse={setAutoCollapse}
                loadOverride={loadOverride}
                setLoadOverride={setLoadOverride}
                directionOverride={directionOverride}
                setDirectionOverride={setDirectionOverride}
                aircraftOverride={aircraftOverride}
                setAircraftOverride={setAircraftOverride}
                getCalculatedLoad={getCalculatedLoad}
                getFlightDirection={getFlightDirection}
                aircraftCode={aircraftCode}
                testSelectedVoice={testSelectedVoice}
                transcriptLog={transcriptLog}
                coPilotRunning={coPilotRunning}
                updateSettings={updateSettings}
                copilotState={copilotState}
              />
            )}
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
