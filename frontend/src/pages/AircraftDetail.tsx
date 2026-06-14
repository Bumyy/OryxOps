import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchAirframeDetail, fetchAirframeHistory, fetchAircraftTypes } from "../store/slices/aircraftSlice";

export default function AircraftDetail() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { currentAirframe, types } = useAppSelector((s) => s.aircraft);

  useEffect(() => {
    if (id) {
      dispatch(fetchAirframeDetail(Number(id)));
      dispatch(fetchAirframeHistory(Number(id)));
      dispatch(fetchAircraftTypes());
    }
  }, [id]);

  if (!currentAirframe) {
    return <div className="max-w-6xl mx-auto px-6 py-8 text-gray-500">Loading...</div>;
  }

  const a = currentAirframe;
  const t = types.find(ty => ty.id === a.aircraft_type_id);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link to="/fleet" className="text-sm text-brand hover:underline mb-4 inline-block">&larr; Back to Fleet</Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-5xl font-bold text-brand">{a.registration}</h1>
          <p className="text-lg text-gray-500">{a.aircraft_type_name}{t?.liveryname ? ` · ${t.liveryname}` : ""}</p>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${
          a.status === "parked" ? "bg-green-100 text-green-700" :
          a.status === "flying" ? "bg-blue-100 text-blue-700" :
          a.status === "maintenance" ? "bg-yellow-100 text-yellow-700" :
          "bg-gray-100 text-gray-500"
        }`}>{a.status}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        {[
          { label: "Current Airport", value: a.current_airport },
          { label: "Home Base", value: a.home_base },
          { label: "Total Hours", value: `${a.total_flight_hours}h` },
          { label: "Total Flights", value: a.total_flights },
          { label: "Current Pilot", value: a.current_pilot_name || "—" },
          { label: "Last Pilot", value: (a as any).last_pilot_name || "—" },
          { label: "Group", value: (a as any).group_name || "—" },
          { label: "Last Flight", value: a.last_flight_at ? new Date(a.last_flight_at).toLocaleDateString() : "—" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-brand-border shadow-sm p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{s.label}</p>
            <p className="text-lg font-bold text-brand mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Flight History */}
      {a.history && a.history.length > 0 && (
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden">
          <h2 className="text-xl font-bold text-brand p-6 pb-4">Flight History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-brand-pale">
                <tr>
                  <th className="px-5 py-3 font-semibold text-gray-600">Flight</th>
                  <th className="px-5 py-3 font-semibold text-gray-600">Route</th>
                  <th className="px-5 py-3 font-semibold text-gray-600">Pilot</th>
                  <th className="px-5 py-3 font-semibold text-gray-600">Duration</th>
                  <th className="px-5 py-3 font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {a.history.map((h: any) => (
                  <tr key={h.id} className="border-t border-brand-border">
                    <td className="px-5 py-3 font-mono text-xs">{h.flightnum || `#${h.id}`}</td>
                    <td className="px-5 py-3 font-semibold">{h.departure} &rarr; {h.arrival}</td>
                    <td className="px-5 py-3">{h.pilot_name || "—"}</td>
                    <td className="px-5 py-3">{Math.floor(h.flighttime / 60)}h {h.flighttime % 60}m</td>
                    <td className="px-5 py-3 text-xs text-gray-400">{h.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
