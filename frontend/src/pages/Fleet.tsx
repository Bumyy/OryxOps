import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchAirframes, fetchAircraftTypes } from "../store/slices/aircraftSlice";
import { fetchGroups } from "../store/slices/groupSlice";
import { fetchMyProfile } from "../store/slices/pilotSlice";
import { api } from "../api/client";

interface IfFleetEntry {
  local_id: number;
  local_registration: string;
  if_aircraft_id: string;
  if_aircraft_content_id: string;
  if_registration: string;
  if_organization_id: string;
  if_organization_name: string;
  if_status: number;
  if_visibility: number;
  if_created_at: string;
}

const visibilityLabel: Record<number, string> = { 0: "Unknown", 1: "Visible", 2: "Hangared" };
const visibilityColor: Record<number, string> = {
  0: "bg-gray-100 text-gray-500",
  1: "bg-green-100 text-green-700",
  2: "bg-yellow-100 text-yellow-700",
};

export default function Fleet() {
  const dispatch = useAppDispatch();
  const { airframes, types } = useAppSelector((s) => s.aircraft);
  const { groups } = useAppSelector((s) => s.group);
  const { currentPilot } = useAppSelector((s) => s.pilot);
  const user = useAppSelector((s: any) => s.auth.user);

  const [ifData, setIfData] = useState<Map<number, IfFleetEntry>>(new Map());
  const [ifError, setIfError] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchAirframes());
    dispatch(fetchAircraftTypes());
    dispatch(fetchGroups());
    if (!currentPilot) {
      dispatch(fetchMyProfile());
    }
    fetchIfStatus();
  }, []);

  const myGroupId = currentPilot?.group_id || user?.flying_groupid;

  const fetchIfStatus = async () => {
    try {
      const res = await api.get<{ aircraft: IfFleetEntry[]; error: string | null }>(
        "/infinite-flight/aircraft/fleet-status"
      );
      if (res.error) {
        setIfError(res.error);
        return;
      }
      const map = new Map<number, IfFleetEntry>();
      res.aircraft.forEach((a) => map.set(a.local_id, a));
      setIfData(map);
    } catch {
      // IF live data not connected
    }
  };

  // Group airframes by group_id
  const groupedFleet = useMemo(() => {
    const map: Record<string, { group: any; aircraft: typeof airframes }> = {};

    // Initialize all active groups
    for (const g of groups) {
      map[g.id] = { group: g, aircraft: [] };
    }
    map["unassigned"] = { group: { id: 0, name: "Unassigned Fleet", is_active: true }, aircraft: [] };

    for (const a of airframes) {
      const gid = a.group_id && map[a.group_id] ? a.group_id : "unassigned";
      map[gid].aircraft.push(a);
    }

    // Convert to array and sort so pilot's group is first
    const sections = Object.values(map).filter(s => s.aircraft.length > 0 || s.group.id !== 0);

    return sections.sort((a, b) => {
      if (a.group.id === myGroupId) return -1;
      if (b.group.id === myGroupId) return 1;
      if (a.group.id === 0) return 1;
      if (b.group.id === 0) return -1;
      return a.group.name.localeCompare(b.group.name);
    });
  }, [airframes, groups, myGroupId]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-brand">Fleet Registry</h1>
          <p className="text-sm text-gray-500 mt-1">Qatar Virtual aircraft fleet organized by Flying Groups</p>
        </div>
      </div>

      {ifError && (
        <div className="mb-6 text-sm text-yellow-700 bg-yellow-50 border border-yellow-300 rounded-2xl p-4 shadow-sm">
          {ifError}
        </div>
      )}

      {groupedFleet.map(({ group, aircraft }) => {
        const isMyGroup = group.id === myGroupId;

        return (
          <div
            key={group.id}
            className={`rounded-3xl border p-6 md:p-8 mb-8 transition-all duration-300 ${
              isMyGroup
                ? "bg-gradient-to-br from-[var(--bg-card)] via-brand/[0.02] to-amber-500/5 border-2 border-brand ring-4 ring-brand/10 shadow-xl"
                : "bg-white border-brand-border shadow-sm"
            }`}
          >
            {/* Group Box Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black ${
                  isMyGroup ? "bg-brand text-white shadow-md" : "bg-brand-pale text-brand"
                }`}>
                  ✈
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-brand">{group.name}</h2>
                    {isMyGroup && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-brand text-white px-2.5 py-0.5 rounded-full shadow-sm">
                        ★ Your Group
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-medium">
                    {aircraft.length} Airframe{aircraft.length !== 1 ? "s" : ""} assigned to this group
                  </p>
                </div>
              </div>

              {group.id > 0 && (
                <Link
                  to={`/groups/${group.id}`}
                  className="text-xs font-bold text-brand hover:underline self-start sm:self-auto bg-brand/5 hover:bg-brand/10 px-3.5 py-1.5 rounded-full transition-colors"
                >
                  Group Schedule &amp; Pilots →
                </Link>
              )}
            </div>

            {/* Aircraft Cards inside Group Box */}
            {aircraft.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs font-semibold bg-gray-50/60 rounded-2xl border border-dashed border-gray-200">
                No airframes currently assigned to this group.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {aircraft.map((a) => {
                  const t = types.find(ty => ty.id === a.aircraft_type_id);
                  const ifEntry = ifData.get(a.id);
                  const isLinked = !!a.if_organization_aircraft_id;

                  return (
                    <Link
                      key={a.id}
                      to={`/fleet/${a.id}`}
                      className="bg-white rounded-2xl border border-brand-border/70 shadow-sm hover:shadow-lg hover:scale-[1.015] transition-all duration-300 p-5 block group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xl font-black text-brand group-hover:text-brand-light transition-colors">
                            {a.registration}
                          </p>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">
                            {a.aircraft_type_name}{t?.liveryname ? ` · ${t.liveryname}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                            a.status === "parked" ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                            a.status === "flying" ? "bg-sky-100 text-sky-700 border-sky-300" :
                            a.status === "maintenance" ? "bg-amber-100 text-amber-700 border-amber-300" :
                            "bg-slate-100 text-slate-500 border-slate-300"
                          }`}>
                            {a.status}
                          </span>
                          {isLinked && (
                            <span className="text-[9px] font-black text-white bg-brand px-2 py-0.5 rounded-full shadow-xs">
                              IF Live
                            </span>
                          )}
                        </div>
                      </div>

                      {ifEntry && (
                        <div className="mt-3 p-2.5 bg-brand-pale/60 rounded-xl border border-brand-border/40">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            {ifEntry.if_organization_name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-gray-700 font-bold text-[11px]">
                              {ifEntry.if_registration}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-full font-bold text-[9px] ${visibilityColor[ifEntry.if_visibility] || visibilityColor[0]}`}>
                              {visibilityLabel[ifEntry.if_visibility] || "Unknown"}
                            </span>
                          </div>
                        </div>
                      )}

                      {isLinked && !ifEntry && (
                        <div className="mt-2 text-[10px] text-gray-400 italic">
                          Linked to IF · no live data
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 font-medium">
                        <span>📍 {a.current_airport}</span>
                        <span>🕐 {a.total_flight_hours}h</span>
                        <span>✈ {a.total_flights || 0} leg{a.total_flights !== 1 ? "s" : ""}</span>
                      </div>

                      {a.current_pilot_name && (
                        <div className="mt-2 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                          <span>✈</span> Pilot: {a.current_pilot_name}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {airframes.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-brand-border p-8 text-gray-500">
          No aircraft in fleet yet.
        </div>
      )}
    </div>
  );
}
