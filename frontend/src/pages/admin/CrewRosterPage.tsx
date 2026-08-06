import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchGroups, fetchGroupDetail } from "../../store/slices/groupSlice";
import { api } from "../../api/client";
import aircraftImages from "../../assets/aircraft_images.json";

export default function CrewRosterPage() {
  const dispatch = useAppDispatch();
  const { groups, currentGroup, loading } = useAppSelector((s) => s.group);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Draft state for assignments before committing
  const [assignments, setAssignments] = useState<{
    [aircraftId: number]: { captain_id: number | null; fo_id: number | null };
  }>({});

  useEffect(() => {
    dispatch(fetchGroups());
  }, [dispatch]);

  const activeGroups = groups.filter((g) => g.is_active);

  useEffect(() => {
    if (activeGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(activeGroups[0].id);
    }
  }, [activeGroups, selectedGroupId]);

  useEffect(() => {
    if (selectedGroupId) {
      dispatch(fetchGroupDetail(selectedGroupId));
    }
  }, [selectedGroupId, dispatch]);

  useEffect(() => {
    if (currentGroup?.aircraft) {
      const initialMap: { [aircraftId: number]: { captain_id: number | null; fo_id: number | null } } = {};
      for (const ac of currentGroup.aircraft) {
        initialMap[ac.aircraft_id] = {
          captain_id: ac.assigned_captain_id || null,
          fo_id: ac.assigned_fo_id || null,
        };
      }
      setAssignments(initialMap);
    }
  }, [currentGroup]);

  // Helper to resolve high-res aircraft photo based on aircraft_type_id or ICAO model
  const getAircraftImage = (ac: any) => {
    const typeId = ac.aircraft_type_id;
    if (typeId && aircraftImages[String(typeId) as keyof typeof aircraftImages]) {
      return aircraftImages[String(typeId) as keyof typeof aircraftImages].url;
    }
    const typeName = (ac.aircraft_type_name || "").toUpperCase();
    if (typeName.includes("A35K") || typeName.includes("350-1000")) {
      return "https://commons.wikimedia.org/wiki/Special:FilePath/A350-1041_QATAR_A7-ANL_landing_at_Berlin_Tegel.jpg";
    }
    if (typeName.includes("A359") || typeName.includes("350-900") || typeName.includes("A350")) {
      return "https://commons.wikimedia.org/wiki/Special:FilePath/Airbus_A350-900_A7-ALR_of_Qatar_Airways.jpg";
    }
    if (typeName.includes("A388") || typeName.includes("A380") || typeName.includes("380")) {
      return "https://commons.wikimedia.org/wiki/Special:FilePath/QTR_A7-APA_A380!137_EDHI_16-04-14.jpg";
    }
    if (typeName.includes("777") || typeName.includes("B77") || typeName.includes("B77W") || typeName.includes("B77L")) {
      return "https://commons.wikimedia.org/wiki/Special:FilePath/A7-BEG_Qatar_B777_(39512386675).jpg";
    }
    if (typeName.includes("787") || typeName.includes("B78")) {
      return "https://commons.wikimedia.org/wiki/Special:FilePath/Qatar_Airways_Boeing_787-8_Dreamliner_A7-BCO_MUC_2015_02.jpg";
    }
    if (typeName.includes("330") || typeName.includes("A33")) {
      return "https://commons.wikimedia.org/wiki/Special:FilePath/A7-AEI_Airbus_A330-302_Qatar_Airways.jpg";
    }
    return "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80";
  };

  // Find pilot object by id
  const getPilotObj = (pilotId: number | null) => {
    if (!pilotId || !currentGroup?.members) return null;
    const member = currentGroup.members.find((m: any) => m.pilot_id === pilotId);
    if (!member) return null;
    return {
      id: member.pilot_id,
      callsign: member.pilot_callsign || `Pilot #${member.pilot_id}`,
      name: member.pilot_name,
    };
  };

  // List assigned pilot ids across all aircraft in draft
  const getAssignedPilotIds = () => {
    const ids = new Set<number>();
    Object.values(assignments).forEach((pair) => {
      if (pair.captain_id) ids.add(pair.captain_id);
      if (pair.fo_id) ids.add(pair.fo_id);
    });
    return ids;
  };

  const assignedIds = getAssignedPilotIds();
  const unassignedPilots = (currentGroup?.members || []).filter(
    (m: any) => !assignedIds.has(m.pilot_id)
  );

  // Assign pilot to slot (Enforce strict 1-pilot 1-frame rule: auto-vacate from previous frame)
  const handleAssignPilotToSlot = async (aircraftId: number, slot: "captain" | "fo", pilotId: number | null) => {
    const updatedAssignments = { ...assignments };

    // Auto-vacate pilot from any previous aircraft frame
    if (pilotId) {
      Object.keys(updatedAssignments).forEach((acIdStr) => {
        const acId = Number(acIdStr);
        if (acId !== aircraftId) {
          const pair = updatedAssignments[acId];
          if (pair.captain_id === pilotId || pair.fo_id === pilotId) {
            updatedAssignments[acId] = {
              captain_id: pair.captain_id === pilotId ? null : pair.captain_id,
              fo_id: pair.fo_id === pilotId ? null : pair.fo_id,
            };
          }
        }
      });
    }

    const currentPair = updatedAssignments[aircraftId] || { captain_id: null, fo_id: null };
    let newCap = currentPair.captain_id;
    let newFo = currentPair.fo_id;

    if (slot === "captain") {
      newCap = pilotId;
      if (newFo === pilotId) newFo = null;
    } else {
      newFo = pilotId;
      if (newCap === pilotId) newCap = null;
    }

    updatedAssignments[aircraftId] = { captain_id: newCap, fo_id: newFo };
    setAssignments(updatedAssignments);

    // Auto-commit to server
    try {
      setSavingId(aircraftId);
      await api.post("/admin/fleet/assign", {
        aircraft_id: aircraftId,
        pilot1_id: newCap,
        pilot2_id: newFo,
      });
      if (selectedGroupId) dispatch(fetchGroupDetail(selectedGroupId));
    } catch (err: any) {
      console.error("Failed to assign pilot:", err);
    } finally {
      setSavingId(null);
    }
  };

  // Swap Captain & FO
  const handleSwapRoles = async (aircraftId: number) => {
    const pair = assignments[aircraftId];
    if (!pair) return;
    handleAssignPilotToSlot(aircraftId, "captain", pair.fo_id);
  };

  // Auto Shuffle Group
  const handleAutoShuffle = async () => {
    if (!selectedGroupId) return;
    if (!window.confirm("Auto-shuffle fleet pilot pairings for this group based on completed booking PIREP hours?")) return;
    try {
      await api.post(`/admin/fleet/auto-shuffle/${selectedGroupId}`);
      dispatch(fetchGroupDetail(selectedGroupId));
      setMessage("Fleet roster auto-shuffled successfully!");
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      alert("Failed to auto-shuffle: " + (err?.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 text-[var(--text-main)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider mb-2 border border-purple-500/20">
            <span>👨‍✈️ Admin Management</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-[var(--text-main)]">Crew Roster Manager</h1>
          <p className="text-sm text-[var(--text-sub)] mt-1">
            Rearrange pilot assignments per airframe using live booking PIREP hours ranking
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleAutoShuffle}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-brand hover:from-purple-500 hover:to-brand-light text-white font-black rounded-2xl shadow-lg transition-all hover:scale-105 flex items-center gap-2 text-sm"
          >
            <span>🔀 Auto-Shuffle Group Roster</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center gap-2">
          <span>✓</span> {message}
        </div>
      )}

      {/* Flying Group Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 border-b border-[var(--brand-border)]">
        {activeGroups.map((g) => {
          const isSelected = g.id === selectedGroupId;
          return (
            <button
              key={g.id}
              onClick={() => setSelectedGroupId(g.id)}
              className={`px-5 py-2.5 rounded-2xl font-extrabold text-sm transition-all shrink-0 flex items-center gap-2 ${
                isSelected
                  ? "bg-[var(--brand)] text-white shadow-md scale-105"
                  : "bg-[var(--bg-card)] text-[var(--text-sub)] hover:text-[var(--text-main)] border border-[var(--brand-border)]"
              }`}
            >
              <span>✈️ {g.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-[var(--bg-slate)] text-[var(--text-muted)]"}`}>
                {g.aircraft_count} frames &middot; {g.member_count} pilots
              </span>
            </button>
          );
        })}
      </div>

      {/* Unassigned Pilots Pool Bar */}
      <div className="mb-8 p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--brand-border)] shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black uppercase tracking-wider text-[var(--text-sub)]">
            Unassigned Pilots Pool ({unassignedPilots.length})
          </span>
          <span className="text-xs text-[var(--text-muted)]">Available to assign to Captain or FO slots below</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {unassignedPilots.length === 0 ? (
            <span className="text-xs text-[var(--text-muted)] italic py-1">All group pilots are currently assigned to airframes!</span>
          ) : (
            unassignedPilots.map((p: any) => (
              <div
                key={p.pilot_id}
                className="px-3.5 py-2 rounded-xl bg-[var(--bg-slate)] border border-[var(--brand-border)] text-xs font-bold flex items-center gap-2 shadow-sm hover:border-[var(--brand)] transition-colors"
              >
                <span>👨‍✈️</span>
                <span className="text-[var(--text-main)]">{p.pilot_callsign || `Pilot #${p.pilot_id}`}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-normal">({p.pilot_name})</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Airframe Roster Grid */}
      {!currentGroup || loading ? (
        <div className="py-12 text-center text-[var(--text-muted)] font-semibold animate-pulse">Loading roster details...</div>
      ) : (
        <div className="space-y-8">
          {currentGroup.aircraft.map((ac: any) => {
            const pair = assignments[ac.aircraft_id] || { captain_id: ac.assigned_captain_id, fo_id: ac.assigned_fo_id };
            const capObj = getPilotObj(pair.captain_id);
            const foObj = getPilotObj(pair.fo_id);
            const acImg = getAircraftImage(ac);
            const isSaving = savingId === ac.aircraft_id;

            return (
              <div
                key={ac.id}
                className="bg-[var(--bg-card)] rounded-3xl border border-[var(--brand-border)] shadow-md overflow-hidden transition-all"
              >
                <div className="grid grid-cols-1 md:grid-cols-12">
                  {/* LEFT COLUMN: Airframe Info */}
                  <div className="md:col-span-5 bg-[var(--bg-slate)] p-6 border-b md:border-b-0 md:border-r border-[var(--brand-border)] flex flex-col justify-between">
                    <div>
                      <div className="relative h-44 rounded-2xl overflow-hidden mb-4 border border-[var(--brand-border)] shadow-md group">
                        <img src={acImg} alt={ac.registration} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <span className="absolute top-3 right-3 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          {ac.status || "Parked"}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-3xl font-black text-amber-500 dark:text-amber-400">{ac.registration}</span>
                          <span className="text-xs font-bold px-3 py-1 rounded-lg bg-[var(--brand-pale)] text-[var(--brand)] border border-[var(--brand-border)]">
                            {ac.aircraft_type_name || "Aircraft"}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--text-sub)] flex items-center justify-between pt-2 border-t border-[var(--brand-border)]">
                          <span>📍 Location</span>
                          <strong className="text-[var(--text-main)] font-bold">{ac.current_airport || "OTHH"}</strong>
                        </div>
                      </div>
                    </div>

                    {isSaving && (
                      <div className="mt-4 text-xs font-bold text-amber-500 animate-pulse flex items-center gap-1">
                        <span>⏳</span> Saving crew assignment...
                      </div>
                    )}
                  </div>

                  {/* RIGHT COLUMN: Interactive Crew Selectors */}
                  <div className="md:col-span-7 p-6 bg-[var(--bg-card)] flex flex-col justify-between gap-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-[var(--text-sub)]">Airframe Roster Pairing</span>
                      {pair.captain_id && pair.fo_id && (
                        <button
                          onClick={() => handleSwapRoles(ac.aircraft_id)}
                          className="text-xs font-bold text-[var(--brand)] hover:underline flex items-center gap-1"
                        >
                          <span>🔄 Swap Captain & FO</span>
                        </button>
                      )}
                    </div>

                    {/* CAPTAIN SELECTOR BOX */}
                    <div className="p-5 rounded-2xl bg-[var(--bg-slate)] border border-amber-500/30 shadow-sm relative">
                      <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-950 font-black text-[10px] uppercase px-3.5 py-1 rounded-bl-xl tracking-wider">
                        CAPTAIN (PIC)
                      </div>

                      <div className="mt-2">
                        <label className="block text-xs font-bold text-[var(--text-sub)] mb-2">Select Captain:</label>
                        <select
                          value={pair.captain_id || ""}
                          onChange={(e) => handleAssignPilotToSlot(ac.aircraft_id, "captain", e.target.value ? Number(e.target.value) : null)}
                          className="select select-sm select-bordered w-full rounded-xl bg-[var(--bg-card)] text-[var(--text-main)] font-bold border-[var(--brand-border)] focus:border-[var(--brand)]"
                        >
                          <option value="">-- Vacant Captain Slot --</option>
                          {currentGroup.members.map((m: any) => (
                            <option key={m.pilot_id} value={m.pilot_id}>
                              {m.pilot_callsign || `Pilot #${m.pilot_id}`} ({m.pilot_name})
                            </option>
                          ))}
                        </select>

                        {ac.assigned_captain_id && (
                          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-[var(--brand-border)]">
                            <span className="text-[var(--text-sub)]">Booking PIREP Flight Hours</span>
                            <span className="font-black text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                              ⏱️ {ac.assigned_captain_hours || 0}h
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* FIRST OFFICER SELECTOR BOX */}
                    <div className="p-5 rounded-2xl bg-[var(--bg-slate)] border border-blue-500/30 shadow-sm relative">
                      <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black text-[10px] uppercase px-3.5 py-1 rounded-bl-xl tracking-wider">
                        FIRST OFFICER (FO)
                      </div>

                      <div className="mt-2">
                        <label className="block text-xs font-bold text-[var(--text-sub)] mb-2">Select First Officer:</label>
                        <select
                          value={pair.fo_id || ""}
                          onChange={(e) => handleAssignPilotToSlot(ac.aircraft_id, "fo", e.target.value ? Number(e.target.value) : null)}
                          className="select select-sm select-bordered w-full rounded-xl bg-[var(--bg-card)] text-[var(--text-main)] font-bold border-[var(--brand-border)] focus:border-[var(--brand)]"
                        >
                          <option value="">-- Solo Command / Vacant FO --</option>
                          {currentGroup.members.map((m: any) => (
                            <option key={m.pilot_id} value={m.pilot_id}>
                              {m.pilot_callsign || `Pilot #${m.pilot_id}`} ({m.pilot_name})
                            </option>
                          ))}
                        </select>

                        {ac.assigned_fo_id && (
                          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-[var(--brand-border)]">
                            <span className="text-[var(--text-sub)]">Booking PIREP Flight Hours</span>
                            <span className="font-black text-blue-500 bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20">
                              ⏱️ {ac.assigned_fo_hours || 0}h
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
