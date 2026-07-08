import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchAirframes, fetchAircraftTypes } from "../store/slices/aircraftSlice";
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
  const [ifData, setIfData] = useState<Map<number, IfFleetEntry>>(new Map());
  const [ifError, setIfError] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchAirframes());
    dispatch(fetchAircraftTypes());
    fetchIfStatus();
  }, []);

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
      // IF not connected — that's fine
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-brand mb-8">Fleet</h1>

      {ifError && (
        <div className="mb-4 text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          {ifError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {airframes.map((a) => {
          const t = types.find(ty => ty.id === a.aircraft_type_id);
          const ifEntry = ifData.get(a.id);
          const isLinked = !!a.if_organization_aircraft_id;

          return (
          <Link
            key={a.id}
            to={`/fleet/${a.id}`}
            className="bg-white rounded-2xl border border-brand-border shadow-sm hover:shadow-lg transition-shadow duration-300 p-5 block"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-bold text-brand">
                  {a.registration}
                </p>
                <p className="text-sm text-gray-500">{a.aircraft_type_name}{t?.liveryname ? ` · ${t.liveryname}` : ""}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  a.status === "parked" ? "bg-green-100 text-green-700" :
                  a.status === "flying" ? "bg-blue-100 text-blue-700" :
                  a.status === "maintenance" ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {a.status}
                </span>
                {isLinked && (
                  <span className="text-[10px] font-bold text-white bg-brand px-2 py-0.5 rounded-full">
                    IF Live
                  </span>
                )}
              </div>
            </div>

            {ifEntry && (
              <div className="mt-3 p-3 bg-brand-pale rounded-xl border border-brand-border/50">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  {ifEntry.if_organization_name}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="text-gray-600">
                    Reg: <span className="font-medium">{ifEntry.if_registration}</span>
                  </span>
                  <span className={`px-1.5 py-0.5 rounded-full font-medium text-[10px] ${visibilityColor[ifEntry.if_visibility] || visibilityColor[0]}`}>
                    {visibilityLabel[ifEntry.if_visibility] || "Unknown"}
                  </span>
                </div>
              </div>
            )}

            {isLinked && !ifEntry && (
              <div className="mt-3 text-[10px] text-gray-400 italic">
                Linked to IF · no live data
              </div>
            )}

            <div className="mt-3 flex gap-4 text-xs text-gray-400">
              <span>📍 {a.current_airport}</span>
              <span>🕐 {a.total_flight_hours}h</span>
            </div>
            {a.current_pilot_name && (
              <p className="mt-1 text-xs text-gray-400">Flying: {a.current_pilot_name}</p>
            )}
          </Link>
          );
        })}
      </div>

      {airframes.length === 0 && (
        <div className="text-center py-12 text-gray-500">No aircraft in fleet yet.</div>
      )}
    </div>
  );
}
