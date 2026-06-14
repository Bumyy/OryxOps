import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchAirframes, fetchAircraftTypes } from "../store/slices/aircraftSlice";

export default function Fleet() {
  const dispatch = useAppDispatch();
  const { airframes, types } = useAppSelector((s) => s.aircraft);

  useEffect(() => {
    dispatch(fetchAirframes());
    dispatch(fetchAircraftTypes());
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-brand mb-8">Fleet</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {airframes.map((a) => (
          <Link
            key={a.id}
            to={`/fleet/${a.id}`}
            className="bg-white rounded-2xl border border-brand-border shadow-sm hover:shadow-lg transition-shadow duration-300 p-5 block group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-bold text-brand group-hover:text-brand-light transition-colors">
                  {a.registration}
                </p>
                <p className="text-sm text-gray-500">{a.aircraft_type_name}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                a.status === "parked" ? "bg-green-100 text-green-700" :
                a.status === "flying" ? "bg-blue-100 text-blue-700" :
                a.status === "maintenance" ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-500"
              }`}>
                {a.status}
              </span>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-gray-400">
              <span>📍 {a.current_airport}</span>
              <span>🕐 {a.total_flight_hours}h</span>
            </div>
            {a.current_pilot_name && (
              <p className="mt-1 text-xs text-gray-400">Flying: {a.current_pilot_name}</p>
            )}
          </Link>
        ))}
      </div>

      {airframes.length === 0 && (
        <div className="text-center py-12 text-gray-500">No aircraft in fleet yet.</div>
      )}
    </div>
  );
}
