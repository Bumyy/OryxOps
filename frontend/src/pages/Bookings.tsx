import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchBookings, createBooking, cancelBooking, completeBooking, noShowBooking } from "../store/slices/bookingSlice";

export default function Bookings() {
  const dispatch = useAppDispatch();
  const { bookings } = useAppSelector((s) => s.booking);
  const user = useAppSelector((s) => s.auth.user);
  const [pirepId, setPirepId] = useState<Record<number, string>>({});

  useEffect(() => {
    if (user) dispatch(fetchBookings({ pilot_id: user.id }));
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-brand mb-8">My Bookings</h1>

      <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left bg-brand-pale">
              <tr>
                <th className="px-5 py-3 font-semibold text-gray-600">Aircraft</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Route</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Departure</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-brand-border">
                  <td className="px-5 py-3">{b.aircraft_registration}</td>
                  <td className="px-5 py-3 font-semibold">
                    <div>{b.flight_departure} &rarr; {b.flight_arrival}</div>
                    <div className="text-[9px] font-bold text-gray-500 uppercase mt-0.5 bg-gray-100 px-1.5 py-0.5 rounded-full inline-block">
                      {b.booking_type === "departure" ? "Departure Only" : b.booking_type === "arrival" ? "Arrival Only" : "Full Flight"}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs">{b.flight_scheduled_dep ? new Date(b.flight_scheduled_dep).toLocaleString() : "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      b.status === "completed" ? "bg-green-100 text-green-700" :
                      b.status === "booked" ? "bg-blue-100 text-blue-700" :
                      b.status === "no_show" ? "bg-red-100 text-red-700" :
                      b.status === "cancelled" ? "bg-gray-100 text-gray-500" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{b.status}</span>
                    {b.taken_over_by_name && <span className="text-xs text-gray-400 ml-2">by {b.taken_over_by_name}</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 flex-wrap">
                      {b.status === "booked" && (
                        <>
                          <button onClick={() => dispatch(cancelBooking(b.id))} className="text-xs text-red-500 hover:underline">Cancel</button>
                          <button onClick={() => dispatch(noShowBooking(b.id))} className="text-xs text-orange-500 hover:underline">No-Show</button>
                          <div className="flex items-center gap-1">
                            <input
                              placeholder="PIREP ID"
                              value={pirepId[b.id] || ""}
                              onChange={(e) => setPirepId({ ...pirepId, [b.id]: e.target.value })}
                              className="border border-brand-border rounded-lg px-2 py-1 text-xs w-20"
                            />
                            <button
                              onClick={() => {
                                if (pirepId[b.id]) dispatch(completeBooking({ id: b.id, pirepId: Number(pirepId[b.id]) }));
                              }}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700"
                            >
                              Complete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {bookings.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No bookings yet.</p>
            <p className="text-sm mt-2">Visit the Calendar to book approved flights.</p>
          </div>
        )}
      </div>
    </div>
  );
}
