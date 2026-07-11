import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchGroups } from "../../store/slices/groupSlice";
import { api } from "../../api/client";

export default function AutoSchedulerPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  const { groups } = useAppSelector((s) => s.group);

  const [groupId, setGroupId] = useState<number>(0);
  const [aircraftId, setAircraftId] = useState<number>(0);
  const [numRoundtrips, setNumRoundtrips] = useState<number>(3);
  const [haulPreference, setHaulPreference] = useState<"short" | "long" | "mixed">("mixed");
  const [minHours, setMinHours] = useState<number>(0);
  const [maxHours, setMaxHours] = useState<number>(0);
  
  // Format default start time to upcoming Monday at 08:00 UTC
  const [startTime, setStartTime] = useState<string>(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    if (d < new Date()) {
      // If Monday has passed in UTC, shift to next Monday
      d.setUTCDate(d.getUTCDate() + 7);
    }
    d.setUTCHours(8, 0, 0, 0);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  const [groupAircraft, setGroupAircraft] = useState<any[]>([]);
  const [loadingAircraft, setLoadingAircraft] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch groups on mount
  useEffect(() => {
    dispatch(fetchGroups());
  }, [dispatch]);

  // Fetch aircraft assigned to selected group directly from the group details API
  useEffect(() => {
    setAircraftId(0);
    if (groupId > 0) {
      setLoadingAircraft(true);
      api.get<any>(`/groups/${groupId}`)
        .then((res) => {
          setGroupAircraft(res.aircraft || []);
        })
        .catch(() => {
          setGroupAircraft([]);
        })
        .finally(() => {
          setLoadingAircraft(false);
        });
    } else {
      setGroupAircraft([]);
    }
  }, [groupId]);

  const selectedAircraft = useMemo(() => {
    return groupAircraft.find(a => a.aircraft_id === aircraftId);
  }, [aircraftId, groupAircraft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !aircraftId || !startTime) return;

    setGenerating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.post<{ proposed_count: number }>("/schedules/auto-generate", {
        group_id: groupId,
        aircraft_id: aircraftId,
        num_roundtrips: numRoundtrips,
        haul_preference: haulPreference,
        start_time: startTime,
        min_hours: minHours > 0 ? minHours : null,
        max_hours: maxHours > 0 ? maxHours : null,
      });

      setSuccessMsg(
        `Successfully generated ${res.proposed_count} proposed flight legs (outbound & return return flights) for aircraft ${selectedAircraft?.registration}! Redirecting to calendar...`
      );
      
      // Redirect to calendar after 3 seconds
      setTimeout(() => {
        navigate("/calendar");
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate schedule. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-brand-pale rounded-xl flex items-center justify-center border border-brand-border">
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-brand">Auto Route Scheduler</h1>
          <p className="text-xs text-gray-500">Automatically generate balanced proposed routes for a selected group airframe</p>
        </div>
      </div>

      <div className="mt-8 bg-white border border-brand-border rounded-2xl p-6 shadow-sm">
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-semibold flex items-center gap-2.5">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm font-semibold flex items-center gap-2.5">
            <span>✅</span>
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Group & Aircraft selection */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Select Flying Group
                </label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(Number(e.target.value))}
                  required
                  className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm bg-white font-semibold text-gray-700 focus:outline-none focus:border-brand"
                >
                  <option value={0}>Choose a group...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {groupId > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Select Aircraft (Airframe)
                  </label>
                  <select
                    value={aircraftId}
                    onChange={(e) => setAircraftId(Number(e.target.value))}
                    required
                    disabled={loadingAircraft}
                    className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm bg-white font-semibold text-gray-700 focus:outline-none focus:border-brand disabled:opacity-50"
                  >
                    {loadingAircraft ? (
                      <option value={0}>Loading aircraft list...</option>
                    ) : (
                      <>
                        <option value={0}>Choose an aircraft...</option>
                        {groupAircraft.map((a) => (
                          <option key={a.aircraft_id} value={a.aircraft_id}>
                            {a.registration} ({a.aircraft_type_name || "Unknown Model"})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              )}

              {selectedAircraft && (
                <div className="bg-gray-50/50 rounded-2xl border border-brand-border p-5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Selected Fleet Aircraft Summary
                  </h3>
                  <div className="bg-white border border-brand-border/60 rounded-xl p-3 flex flex-col gap-1 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-brand text-sm">{selectedAircraft.registration}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        selectedAircraft.status === "parked" ? "bg-green-100 text-green-700" :
                        selectedAircraft.status === "flying" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>{selectedAircraft.status}</span>
                    </div>
                    <span className="text-[11px] text-gray-600 font-medium leading-relaxed">
                      Type: {selectedAircraft.aircraft_type_name}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      Location: {selectedAircraft.current_airport}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Generation Settings */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Number of Round-Trips
                </label>
                <select
                  value={numRoundtrips}
                  onChange={(e) => setNumRoundtrips(Number(e.target.value))}
                  required
                  className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm bg-white font-semibold text-gray-700 focus:outline-none focus:border-brand"
                >
                  {[1, 2, 3, 4, 5].map((num) => (
                    <option key={num} value={num}>
                      {num} Round-trip{num > 1 ? "s" : ""} ({num * 2} flight legs)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-amber-600 font-medium mt-2 bg-amber-50 border border-amber-100 rounded-lg p-2.5 leading-relaxed">
                  ⚠️ Note: Generating {numRoundtrips} round-trip schedule(s) will automatically create {numRoundtrips * 2} separate flight legs (outbound flight to destination + inbound flight return) for the selected aircraft.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Flight Length Preference
                </label>
                <div className="grid grid-cols-3 gap-2 bg-brand-pale border border-brand-border/40 rounded-xl p-1">
                  {(["mixed", "short", "long"] as const).map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => setHaulPreference(pref)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all capitalize ${
                        haulPreference === pref
                          ? "bg-brand text-white shadow-sm"
                          : "text-gray-500 hover:text-brand"
                      }`}
                    >
                      {pref === "mixed" ? "Balanced Mix" : `${pref} Haul`}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 px-1">
                  Short haul is under 3 hours; Long haul is 3 hours or more.
                </p>
              </div>

              {/* Custom Hour Selectors */}
              <div className="bg-brand-pale/40 border border-brand-border/40 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-brand uppercase tracking-wider">
                  Custom Route Duration Filters (Optional)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">
                      Min Duration (Hours)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={minHours || ""}
                      onChange={(e) => setMinHours(Number(e.target.value))}
                      placeholder="e.g. 6"
                      className="w-full border border-brand-border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-brand bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">
                      Max Duration (Hours)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={maxHours || ""}
                      onChange={(e) => setMaxHours(Number(e.target.value))}
                      placeholder="e.g. 12"
                      className="w-full border border-brand-border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-brand bg-white"
                    />
                  </div>
                </div>
                <p className="text-[9px] text-gray-400 leading-normal">
                  If set, routes will be filtered strictly by hours (e.g. Min 6 hours will only schedule flights ≥ 6h). Leave at 0 to use presets.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  First Flight Start Date & Time (UTC)
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full border border-brand-border rounded-xl px-4 py-2 text-sm bg-white font-semibold text-gray-700 focus:outline-none focus:border-brand"
                />
                <p className="text-[10px] text-gray-400 mt-1.5 px-1">
                  Subsequent round-trips will be spaced out automatically 2 days apart starting from this date and time.
                </p>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="border-t border-brand-border pt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="rounded-full border border-brand-border text-gray-500 font-semibold text-sm px-6 py-2.5 hover:bg-brand-hover-bg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating || !groupId || !aircraftId}
              className="rounded-full bg-brand text-white font-semibold text-sm px-8 py-2.5 hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Schedule Proposal"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
