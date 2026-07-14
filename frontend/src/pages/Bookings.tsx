import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchBookings, cancelBooking, completeBooking, noShowBooking, dispatchBooking } from "../store/slices/bookingSlice";
import { api } from "../api/client";

export default function Bookings() {
  const dispatch = useAppDispatch();
  const { bookings, loading } = useAppSelector((s) => s.booking);
  const aircraftData = useAppSelector((s) => s.aircraft.specs);
  const user = useAppSelector((s) => s.auth.user);
  
  const [activeTab, setActiveTab] = useState<"bookings" | "logs">("bookings");
  const [flightTimeMinutes, setFlightTimeMinutes] = useState<Record<number, string>>({});
  const [fuelBurned, setFuelBurned] = useState<Record<number, string>>({});
  const [landingFpm, setLandingFpm] = useState<Record<number, string>>({});
  const [actualArrival, setActualArrival] = useState<Record<number, string>>({});
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);

  const refetch = () => {
    if (user) {
      if (activeTab === "bookings") {
        dispatch(fetchBookings({ pilot_id: user.id, status: "booked" }));
      } else {
        dispatch(fetchBookings({ pilot_id: user.id, status: "logs" }));
      }
    }
  };

  useEffect(() => {
    refetch();
  }, [user, activeTab]);

  const getSimbriefUrl = (b: any) => {
    const orig = b.flight_departure.toUpperCase();
    const dest = b.flight_arrival.toUpperCase();
    const type = (b.aircraft_icao || "B77W").toUpperCase();
    const callsign = (b.departure_pilot_callsign || user?.callsign || "").toUpperCase();
    const fltnum = b.flight_number || "";

    const params = new URLSearchParams({
      orig,
      dest,
      type,
      callsign,
      airline: "QRV",
    });
    if (fltnum) {
      params.set("fltnum", fltnum);
    }
    return `https://www.simbrief.com/system/dispatch.php?${params.toString()}`;
  };

  const getFlightawareUrl = (b: any) => {
    const params = new URLSearchParams({
      origin: b.flight_departure.toUpperCase(),
      destination: b.flight_arrival.toUpperCase(),
    });
    return `https://www.flightaware.com/live/findflight?${params.toString()}`;
  };

  const handleCancel = async (id: number) => {
    if (confirm("Are you sure you want to cancel this booking?")) {
      const res = await dispatch(cancelBooking(id));
      if (cancelBooking.fulfilled.match(res)) {
        refetch();
      } else {
        alert("Failed to cancel booking: " + (res.error?.message || "Unknown error"));
      }
    }
  };

  const handleDispatch = async (id: number) => {
    const res = await dispatch(dispatchBooking(id));
    if (dispatchBooking.fulfilled.match(res)) {
      refetch();
    } else {
      alert("Failed to dispatch flight: " + (res.error?.message || "Unknown error"));
    }
  };

  const handleComplete = async (id: number, scheduledArrival: string) => {
    const minutes = Number(flightTimeMinutes[id] || 0);
    const fuel = Number(fuelBurned[id] || 0);
    const fpm = Number(landingFpm[id] || 0);
    const arrival = (actualArrival[id] || "").trim().toUpperCase() || scheduledArrival.toUpperCase();

    if (minutes <= 0 || fuel < 0 || fpm < 0) {
      alert("Please fill in valid positive statistics (Flight Time, Fuel, and Landing rate).");
      return;
    }

    if (arrival.length !== 4) {
      alert("Please enter a valid 4-letter ICAO code for the Landing Airport.");
      return;
    }

    const res = await dispatch(completeBooking({
      id,
      flightTimeMinutes: minutes,
      fuelBurned: fuel,
      landingFpm: fpm,
      actualArrival: arrival
    }));
    if (completeBooking.fulfilled.match(res)) {
      alert("Flight PIREP submitted successfully! Placed in pending review.");
      refetch();
    } else {
      alert("Failed to complete flight: " + (res.error?.message || "Unknown error"));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <h1 className="text-4xl font-extrabold text-brand tracking-tight mb-2">Operations Center</h1>
      <p className="text-gray-500 text-sm mb-8">Manage active dispatches and view logs of filed career mode flights.</p>

      {/* Tab Switcher */}
      <div className="flex gap-3 mb-8 bg-brand-pale/50 border border-brand-border/40 p-1.5 rounded-2xl max-w-xs">
        <button
          onClick={() => setActiveTab("bookings")}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === "bookings"
              ? "bg-brand text-white shadow-md shadow-brand/10"
              : "text-gray-600 hover:bg-brand-hover-bg"
          }`}
        >
          📅 My Bookings
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === "logs"
              ? "bg-brand text-white shadow-md shadow-brand/10"
              : "text-gray-600 hover:bg-brand-hover-bg"
          }`}
        >
          📜 Flight Logs
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2].map((n) => (
            <div key={n} className="bg-white rounded-3xl border border-brand-border/60 p-6 space-y-4 animate-pulse">
              <div className="flex justify-between items-center">
                <div className="h-6 w-48 bg-gray-100 rounded-lg" />
                <div className="h-5 w-20 bg-gray-100 rounded-md" />
              </div>
              <div className="h-4 w-64 bg-gray-100 rounded-md" />
              <div className="flex gap-2 pt-2">
                <div className="h-5 w-24 bg-gray-100 rounded-md" />
                <div className="h-5 w-28 bg-gray-100 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === "bookings" ? (
        <div className="space-y-6">
          {bookings.map((b) => {
            const isDeparturePilot = user?.id === b.departure_pilot_id;
            const isArrivalPilot = user?.id === b.arrival_pilot_id;
            const isSolo = b.departure_pilot_id === b.arrival_pilot_id;

            return (
              <div
                key={b.id}
                className="bg-white rounded-3xl border border-brand-border shadow-sm overflow-hidden p-6 flex flex-col md:flex-row gap-6 justify-between items-start"
              >
                {/* Left side: route details */}
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-brand-dark uppercase tracking-tight">
                      {b.flight_departure} ➔ {b.flight_arrival}
                    </span>
                    {b.flight_number && (
                      <span className="text-[10px] font-extrabold text-brand bg-brand-pale border border-brand-border/60 px-2 py-0.5 rounded-md">
                        {b.flight_number}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 font-bold">
                    Aircraft: <span className="text-gray-700">{b.aircraft_registration} ({b.aircraft_icao})</span>
                  </p>

                  <div className="flex gap-2 flex-wrap">
                    {isSolo ? (
                      <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/50 border border-emerald-200/50 px-2 py-0.5 rounded-md">
                        👤 Solo Flight
                      </span>
                    ) : (
                      <>
                        <span className="text-[9px] font-bold text-sky-800 bg-sky-100/50 border border-sky-200/50 px-2 py-0.5 rounded-md">
                          🛫 Takeoff: {b.departure_pilot_callsign || "Vacant"}
                        </span>
                        <span className="text-[9px] font-bold text-purple-800 bg-purple-100/50 border border-purple-200/50 px-2 py-0.5 rounded-md">
                          🛬 Landing: {b.arrival_pilot_callsign || "Vacant"}
                        </span>
                      </>
                    )}
                    {b.pax_count !== null && (
                      <span className="text-[9px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                        👥 {b.pax_count} Pax Loaded
                      </span>
                    )}
                  </div>

                  {b.dispatched_at ? (
                    <div className="flex gap-2 pt-1.5">
                      <a
                        href={getSimbriefUrl(b)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] font-extrabold text-brand hover:bg-brand/10 bg-brand-pale border border-brand-border px-2.5 py-1.5 rounded-xl transition-colors"
                      >
                        ✈️ SimBrief OFP
                      </a>
                      <a
                        href={getFlightawareUrl(b)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] font-extrabold text-sky-700 hover:bg-sky-100 bg-sky-50 border border-sky-200 px-2.5 py-1.5 rounded-xl transition-colors"
                      >
                        🌐 Flightaware Tracker
                      </a>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic">Not dispatched. SimBrief planning requires dispatching.</p>
                  )}
                </div>

                {/* Right side: dispatch form / manual complete */}
                <div className="w-full md:w-auto flex flex-col items-end gap-3">
                  {!b.dispatched_at ? (
                    isDeparturePilot ? (
                      <div className="flex flex-col gap-2 w-full">
                        <button
                          onClick={() => handleDispatch(b.id)}
                          className="bg-brand text-white px-4 py-2 rounded-2xl hover:bg-brand-dark text-xs font-black transition-all cursor-pointer text-center"
                        >
                          🚀 Dispatch Flight
                        </button>
                        <button
                          onClick={() => handleCancel(b.id)}
                          className="text-[10px] text-red-500 font-bold hover:underline text-center cursor-pointer"
                        >
                          Cancel Booking
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic bg-gray-50 border border-gray-100 px-3 py-2 rounded-xl text-center w-full">
                        Waiting for takeoff pilot to dispatch
                      </span>
                    )
                  ) : (
                    <>
                      {/* Completed / Filing EFB Manual PIREP */}
                      {isArrivalPilot || (!b.arrival_pilot_id && isDeparturePilot) ? (
                        <div className="bg-gray-50 border border-brand-border/40 p-4 rounded-2xl w-full max-w-[280px] space-y-2.5">
                          <h4 className="text-[11px] font-black text-brand uppercase tracking-wider">File EFB Manual PIREP</h4>
                          <div className="space-y-2">
                            <input
                              type="number"
                              placeholder="Flight Duration (Minutes)"
                              value={flightTimeMinutes[b.id] || ""}
                              onChange={(e) => setFlightTimeMinutes({ ...flightTimeMinutes, [b.id]: e.target.value })}
                              className="w-full border border-brand-border/60 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-brand"
                            />
                            <input
                              type="number"
                              placeholder="Fuel Burned (kg)"
                              value={fuelBurned[b.id] || ""}
                              onChange={(e) => setFuelBurned({ ...fuelBurned, [b.id]: e.target.value })}
                              className="w-full border border-brand-border/60 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-brand"
                            />
                            <input
                              type="number"
                              placeholder="Landing Rate (FPM)"
                              value={landingFpm[b.id] || ""}
                              onChange={(e) => setLandingFpm({ ...landingFpm, [b.id]: e.target.value })}
                              className="w-full border border-brand-border/60 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-brand"
                            />
                            <input
                              type="text"
                              maxLength={4}
                              placeholder={`Landing Airport (default: ${b.flight_arrival || "OTHH"})`}
                              value={actualArrival[b.id] || ""}
                              onChange={(e) => setActualArrival({ ...actualArrival, [b.id]: e.target.value })}
                              className="w-full border border-brand-border/60 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-brand uppercase font-bold"
                            />
                          </div>
                          <button
                            onClick={() => handleComplete(b.id, b.flight_arrival || "OTHH")}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-black transition-colors cursor-pointer text-center"
                          >
                            Submit PIREP & Complete
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 italic bg-gray-50 border border-gray-100 px-3 py-2 rounded-xl text-center w-full">
                          Waiting for landing pilot to land & complete
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {bookings.length === 0 && (
            <div className="bg-white rounded-3xl border border-brand-border p-12 text-center text-gray-500">
              <p className="text-base font-bold">No active flight bookings.</p>
              <p className="text-xs mt-1">Head over to the schedule calendar page to reserve your next leg.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((b) => {
            const isSolo = b.departure_pilot_id === b.arrival_pilot_id;
            const isCancelled = b.status === "cancelled";
            const isRejected = b.status === "rejected";

            if (isCancelled || isRejected) {
              {/* Red box format */}
              return (
                <div
                  key={b.id}
                  className="border-2 border-red-500/70 bg-rose-50/20 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-black text-red-950 uppercase tracking-tight">
                        {b.flight_departure} ➔ {b.flight_arrival}
                      </span>
                      <span className="text-[9px] font-extrabold text-red-800 bg-red-100 border border-red-200 px-2 py-0.5 rounded-md">
                        {isCancelled ? "Cancelled" : "Rejected"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-bold">
                      Flight: {b.flight_number || "CM"} · Aircraft: {b.aircraft_registration} ({b.aircraft_icao})
                    </p>
                  </div>
                  <div className="text-xs text-red-700 italic font-medium bg-red-100/40 px-4 py-2.5 rounded-2xl border border-red-200/50">
                    {isCancelled 
                      ? "Flight was cancelled by dispatcher/crew before completion."
                      : "Manual PIREP was rejected by staff. Wallet payout and ledger rows were withheld."}
                  </div>
                </div>
              );
            }

            {/* Completed -> Blue box format */}
            const isPending = b.pirep_accepted === 0;

            return (
              <div
                key={b.id}
                className="border-2 border-blue-500 bg-sky-50/20 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start"
              >
                {/* Left Details */}
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-lg font-black text-blue-950 uppercase tracking-tight">
                      {b.flight_departure} ➔ {b.flight_arrival}
                    </span>
                    {b.flight_number && (
                      <span className="text-[10px] font-extrabold text-blue-800 bg-blue-100 border border-blue-200/60 px-2 py-0.5 rounded-md">
                        {b.flight_number}
                      </span>
                    )}
                    {isPending ? (
                      <span className="text-[9px] font-black text-amber-800 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-md animate-pulse">
                        ⏳ Pending Review (Estimates)
                      </span>
                    ) : (
                      <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md">
                        ✅ Approved & Paid
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 font-bold">
                    Aircraft: <span className="text-gray-700">{b.aircraft_registration} ({b.aircraft_icao})</span> · Crew: {" "}
                    {isSolo ? (
                      <span className="text-gray-700 font-bold">Solo Payout</span>
                    ) : (
                      <span className="text-gray-700 font-bold">
                        Split (Takeoff: {b.departure_pilot_callsign} / Landing: {b.arrival_pilot_callsign})
                      </span>
                    )}
                  </p>

                  {/* Operational stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white/70 border border-brand-border/40 p-3.5 rounded-2xl max-w-md">
                    <div>
                      <div className="text-[9px] font-bold text-gray-400 uppercase">Landing rate</div>
                      <div className="text-xs font-black text-gray-700 mt-0.5">{b.landing_fpm ? `${b.landing_fpm} FPM` : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-gray-400 uppercase">Reputation rating</div>
                      <div className="text-xs font-black text-gray-700 mt-0.5">{b.reputation_score ? `${b.reputation_score.toFixed(2)} / 5.0 ★` : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-gray-400 uppercase">Passengers loaded</div>
                      <div className="text-xs font-black text-gray-700 mt-0.5">{b.pax_count ?? "—"} Pax</div>
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedCardId(expandedCardId === b.id ? null : b.id)}
                    className="mt-3 text-[10px] font-black text-brand bg-brand-pale hover:bg-brand/10 border border-brand-border/60 px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 animate-fade-in"
                  >
                    {expandedCardId === b.id ? "▲ Hide Breakdown Report" : "▼ Show Breakdown Report"}
                  </button>

                  {expandedCardId === b.id && (
                    <div className="w-full mt-6 bg-gradient-to-br from-slate-50 to-brand-pale/20 border border-brand-border/80 rounded-3xl p-6 shadow-sm space-y-6 relative overflow-hidden animate-fade-in">
                      {/* Title banner */}
                      <div className="flex justify-between items-center border-b border-brand-border/40 pb-3">
                        <h4 className="font-black text-brand-dark flex items-center gap-2 text-[10px] uppercase tracking-wider">
                          📊 Leg Report Breakdown
                        </h4>
                        <span className="text-[9px] font-black text-brand bg-brand-pale border border-brand-border/40 px-2.5 py-0.5 rounded-full">
                          Flight Leg ID: #{b.id}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* 🌟 Reputation Column */}
                        <div className="space-y-4">
                          <h5 className="font-extrabold text-[10px] text-brand border-b border-brand-border/20 pb-1 flex items-center gap-1.5 uppercase tracking-wider">
                            🌟 REPUTATION PERFORMANCE
                          </h5>
                          
                          {/* Punctuality gauge */}
                          <div className="space-y-2 bg-white p-4 rounded-2xl border border-brand-border/40 shadow-xs">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-black text-gray-700 flex items-center gap-1">⏱️ Punctuality rating</span>
                              <span className="font-extrabold text-brand">
                                {(() => {
                                  if (!b.flight_time_minutes || !b.scheduled_duration_minutes) return "—";
                                  const diff = Math.abs(b.flight_time_minutes - b.scheduled_duration_minutes);
                                  if (diff <= 30) return "100.0% (On-Time)";
                                  const score = Math.max(0, 100 - (diff - 30));
                                  return `${score.toFixed(1)}%`;
                                })()}
                              </span>
                            </div>
                            
                            {/* Gauge bar */}
                            {(() => {
                              if (!b.flight_time_minutes || !b.scheduled_duration_minutes) return null;
                              const diff = Math.abs(b.flight_time_minutes - b.scheduled_duration_minutes);
                              const score = Math.max(0, 100 - (diff > 30 ? (diff - 30) : 0));
                              return (
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${score > 70 ? 'from-amber-500 to-emerald-500' : 'from-red-500 to-amber-500'}`}
                                    style={{ width: `${score}%` }}
                                  />
                                </div>
                              );
                            })()}

                            {/* Detailed breakdown list */}
                            <div className="text-[10px] text-gray-500 space-y-1 pt-2 font-medium">
                              <div className="flex justify-between">
                                <span>📅 Scheduled Duration:</span>
                                <span className="font-extrabold text-gray-700">{b.scheduled_duration_minutes ? `${Math.floor(b.scheduled_duration_minutes / 60)}h ${b.scheduled_duration_minutes % 60}m (${b.scheduled_duration_minutes} min)` : "—"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>⏱️ Actual Duration:</span>
                                <span className="font-extrabold text-gray-700">{b.flight_time_minutes ? `${Math.floor(b.flight_time_minutes / 60)}h ${b.flight_time_minutes % 60}m (${b.flight_time_minutes} min)` : "—"}</span>
                              </div>
                              {(() => {
                                if (!b.flight_time_minutes || !b.scheduled_duration_minutes) return null;
                                const diff = b.flight_time_minutes - b.scheduled_duration_minutes;
                                const absDiff = Math.abs(diff);
                                return (
                                  <>
                                    <div className="flex justify-between border-t border-gray-50 pt-1">
                                      <span>📏 Time Variance:</span>
                                      <span className={`font-extrabold ${absDiff > 30 ? 'text-amber-700' : 'text-gray-700'}`}>
                                        {diff > 0 ? `+${absDiff} min (Late)` : `-${absDiff} min (Early)`}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>🛡️ Grace Allowance:</span>
                                      <span className="font-bold">30 min</span>
                                    </div>
                                    {absDiff > 30 && (
                                      <div className="flex justify-between text-red-600 font-bold bg-red-50/50 px-2 py-0.5 rounded mt-1 text-[9.5px]">
                                        <span>📉 Variance Penalty:</span>
                                        <span>-{absDiff - 30}% (-1% per min over grace)</span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Landing performance gauge */}
                          <div className="space-y-2 bg-white p-4 rounded-2xl border border-brand-border/40 shadow-xs">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-black text-gray-700 flex items-center gap-1">🛬 Landing smoothness</span>
                              <span className="font-extrabold text-brand">
                                {(() => {
                                  if (!b.landing_fpm) return "—";
                                  if (b.landing_fpm <= 100) return "100.0% (Soft)";
                                  const score = Math.max(0, 100 - (b.landing_fpm - 100) / 4);
                                  return `${score.toFixed(1)}%`;
                                })()}
                              </span>
                            </div>

                            {/* Gauge bar */}
                            {(() => {
                              if (!b.landing_fpm) return null;
                              const score = Math.max(0, 100 - (b.landing_fpm > 100 ? (b.landing_fpm - 100) / 4 : 0));
                              return (
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${score > 70 ? 'from-amber-500 to-emerald-500' : score > 35 ? 'from-red-500 via-amber-500 to-amber-500' : 'from-red-600 to-red-500'}`}
                                    style={{ width: `${score}%` }}
                                  />
                                </div>
                              );
                            })()}

                            {/* Detailed breakdown list */}
                            <div className="text-[10px] text-gray-500 space-y-1 pt-2 font-medium">
                              <div className="flex justify-between">
                                <span>💥 Touchdown Landing Rate:</span>
                                <span className={`font-extrabold ${b.landing_fpm && b.landing_fpm > 150 ? 'text-red-700' : 'text-gray-700'}`}>
                                  {b.landing_fpm ? `${b.landing_fpm} FPM` : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>🧈 Soft Touchdown Threshold:</span>
                                <span className="font-bold">100 FPM (No Penalty)</span>
                              </div>
                              {b.landing_fpm && b.landing_fpm > 100 && (
                                <div className="flex justify-between text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded mt-1 text-[9.5px]">
                                  <span>📉 Rate Penalty:</span>
                                  <span>-{((b.landing_fpm - 100) / 4).toFixed(1)}% (-1% per 4 FPM over threshold)</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Overall Average Reputation Block */}
                          <div className="bg-brand-pale/35 border border-brand-border/50 rounded-2xl p-3.5 flex justify-between items-center text-xs">
                            <div>
                              <div className="font-black text-brand-dark">Leg Reputation Rating</div>
                              <div className="text-[9px] text-gray-400 mt-0.5">Average of Punctuality & Smoothness (scaled to 5★)</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-black text-brand">{b.reputation_score?.toFixed(2)} / 5.00 ★</div>
                              <div className="text-[8px] text-gray-400 font-bold">
                                ({(() => {
                                  if (!b.flight_time_minutes || !b.scheduled_duration_minutes) return "—";
                                  const diff = Math.abs(b.flight_time_minutes - b.scheduled_duration_minutes);
                                  const p_score = Math.max(0, 100 - (diff > 30 ? (diff - 30) : 0));
                                  const l_score = b.landing_fpm ? Math.max(0, 100 - (b.landing_fpm > 100 ? (b.landing_fpm - 100) / 4 : 0)) : 100;
                                  return `${p_score.toFixed(0)}% Punct. + ${l_score.toFixed(0)}% Smooth`;
                                })()})
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ⛽ Economics Receipt Column */}
                        <div className="space-y-4">
                          <h5 className="font-extrabold text-[10px] text-brand border-b border-brand-border/20 pb-1 flex items-center gap-1.5 uppercase tracking-wider">
                            🧾 FLIGHT REVENUE & EXPENSES
                          </h5>

                          <div className="bg-white rounded-2xl border border-brand-border/50 shadow-xs overflow-hidden">
                            {/* Receipt Header */}
                            <div className="bg-slate-50 border-b border-brand-border/40 px-4 py-2.5 flex justify-between items-center text-[9px] font-mono text-gray-400 tracking-wider">
                              <span>LEG ITEMIZATION</span>
                              <span>QRV-EFB-LOG</span>
                            </div>

                            {/* Receipt Body */}
                            <div className="p-4 space-y-3.5 text-[11px] leading-relaxed">
                              {/* Ticket Revenue */}
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-black text-gray-700">👥 Passenger Revenue</div>
                                  <div className="text-[9px] text-gray-400 mt-0.5">
                                    {b.pax_count} passengers loaded
                                  </div>
                                  <div className="text-[8.5px] text-brand-dark italic mt-0.5">
                                    Formula: Pax * (220 Base + {b.flight_time_minutes ? b.flight_time_minutes : 0} min * 1.2 Duration)
                                  </div>
                                </div>
                                <div className="font-black text-emerald-700 text-right whitespace-nowrap">
                                  +{Math.round(b.earnings || 0).toLocaleString()} QAR
                                </div>
                              </div>

                              {/* Fuel Expense */}
                              <div className="flex justify-between items-start border-t border-gray-100 pt-3">
                                <div>
                                  <div className="font-black text-gray-700">⛽ Fuel Expense</div>
                                  <div className="text-[9px] text-gray-400 mt-0.5">
                                    {(b.fuel_burned || 0).toLocaleString()} kg fuel burned
                                  </div>
                                  <div className="text-[8.5px] text-brand-dark italic mt-0.5">
                                    Formula: kg * 1.10 QAR/kg
                                  </div>
                                </div>
                                <div className="font-black text-rose-700 text-right whitespace-nowrap">
                                  -{Math.round((b.fuel_burned || 0) * 1.10).toLocaleString()} QAR
                                </div>
                              </div>

                              {/* Aircraft Operating Cost */}
                              {(() => {
                                const ac_icao = b.aircraft_icao || "A320";
                                const mapped_key = ({
                                  "A380": "A388",
                                  "B787": "B788",
                                  "B789": "B788",
                                  "B777": "B77W",
                                  "B772": "B77L",
                                  "B77F": "B77L",
                                  "A330": "A333",
                                  "A332": "A333",
                                  "A340": "A359"
                                } as Record<string, string>)[ac_icao.toUpperCase()] || ac_icao.toUpperCase();
                                
                                const capacity = (aircraftData as any)?.[mapped_key]?.properties?.capacity || 180;
                                const fixed_cost = capacity * 120;
                                const service_cost = (b.pax_count || 100) * 60;
                                const operating_cost = fixed_cost + service_cost;

                                return (
                                  <div className="flex justify-between items-start border-t border-gray-100 pt-3">
                                    <div>
                                      <div className="font-black text-gray-700">✈️ Aircraft Operating Cost ({ac_icao})</div>
                                      <div className="text-[9px] text-gray-400 mt-0.5">
                                        Fixed: {capacity} seats × 120 QAR | Service: {b.pax_count} pax × 60 QAR
                                      </div>
                                    </div>
                                    <div className="font-black text-rose-700 text-right whitespace-nowrap">
                                      -{operating_cost.toLocaleString()} QAR
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Landing Penalty */}
                              {b.landing_fpm !== null && b.landing_fpm !== undefined && (
                                <div className="flex justify-between items-start border-t border-gray-100 pt-3">
                                  <div>
                                    <div className={`font-black ${b.landing_fpm > 100 ? "text-red-700" : "text-gray-700"}`}>
                                      💥 Touchdown Landing Penalty
                                    </div>
                                    <div className="text-[9px] text-gray-400 mt-0.5">
                                      Landing rate: {b.landing_fpm} FPM
                                    </div>
                                  </div>
                                  <div className="font-black text-rose-700 text-right whitespace-nowrap">
                                    -{(() => {
                                      const fpm = b.landing_fpm;
                                      if (fpm <= 100) return 0;
                                      if (fpm <= 200) return 500;
                                      if (fpm <= 300) return 2000;
                                      if (fpm <= 400) return 6000;
                                      return 15000;
                                    })().toLocaleString()} QAR
                                  </div>
                                </div>
                              )}

                              {/* Diversion Charge */}
                              {b.diverted && (
                                <div className="flex justify-between items-start border-t border-gray-100 pt-3 bg-red-50/50 p-2 rounded-xl border-dashed border-red-200">
                                  <div>
                                    <div className="font-black text-red-800">🔀 Passenger Diversion Charge</div>
                                    <div className="text-[9px] text-red-600 mt-0.5">
                                      Diverted to {b.actual_arrival} (Formula: {b.pax_count} pax × 100 QAR)
                                    </div>
                                  </div>
                                  <div className="font-black text-red-700 text-right whitespace-nowrap">
                                    -{((b.pax_count || 100) * 100).toLocaleString()} QAR
                                  </div>
                                </div>
                              )}

                              {/* Airport Landing Fee */}
                              {(() => {
                                const fuel_exp = (b.fuel_burned || 0) * 1.10;
                                const ac_icao = b.aircraft_icao || "A320";
                                const mapped_key = ({
                                  "A380": "A388",
                                  "B787": "B788",
                                  "B789": "B788",
                                  "B777": "B77W",
                                  "B772": "B77L",
                                  "B77F": "B77L",
                                  "A330": "A333",
                                  "A332": "A333",
                                  "A340": "A359"
                                } as Record<string, string>)[ac_icao.toUpperCase()] || ac_icao.toUpperCase();
                                
                                const capacity = (aircraftData as any)?.[mapped_key]?.properties?.capacity || 180;
                                const operating_cost = (capacity * 120) + ((b.pax_count || 100) * 60);
                                const diversion_charge = b.diverted ? ((b.pax_count || 100) * 100) : 0;
                                
                                const fpm = b.landing_fpm || 100;
                                let landing_penalty = 0;
                                if (fpm > 100) {
                                  if (fpm <= 200) landing_penalty = 500;
                                  else if (fpm <= 300) landing_penalty = 2000;
                                  else if (fpm <= 400) landing_penalty = 6000;
                                  else landing_penalty = 15000;
                                }
                                
                                const total_exp = b.expenses || 0;
                                const landing_fee = Math.max(0, Math.round(total_exp - fuel_exp - landing_penalty - operating_cost - diversion_charge));
                                if (landing_fee <= 0) return null;
                                return (
                                  <div className="flex justify-between items-start border-t border-gray-100 pt-3">
                                    <div>
                                      <div className="font-black text-gray-700">
                                        🏢 {b.diverted ? "Diverted" : "Dest."} Airport Landing Fee ({b.actual_arrival || b.flight_arrival})
                                      </div>
                                      <div className="text-[9px] text-gray-400 mt-0.5">
                                        Assessed landing dispatch fee
                                      </div>
                                    </div>
                                    <div className="font-black text-rose-700 text-right whitespace-nowrap">
                                      -{landing_fee.toLocaleString()} QAR
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Net Totals */}
                              <div className="border-t-2 border-double border-brand-border/40 pt-3 mt-4 space-y-1 text-xs">
                                <div className="flex justify-between items-center font-bold">
                                  <span className="text-gray-600">Net Flight Leg Profit:</span>
                                  <span className={((b.earnings || 0) - (b.expenses || 0)) > 0 ? "text-emerald-700 font-extrabold" : "text-red-700 font-extrabold"}>
                                    {Math.round((b.earnings || 0) - (b.expenses || 0)).toLocaleString()} QAR
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-500 font-medium">
                                  <span>👤 Pilot Wallet Share:</span>
                                  <span>
                                    {isSolo ? "Solo Share (10% of profit, min 750 QAR)" : "Split Crew Share (5% of profit, min 350 QAR)"}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center font-black text-brand pt-1 text-xs border-t border-dashed border-brand-border/30">
                                  <span>💰 Wallet Salary Payout:</span>
                                  <span>
                                    {isSolo
                                      ? `${Math.round(Math.max(750, ((b.earnings || 0) - (b.expenses || 0)) * 0.10)).toLocaleString()} QAR`
                                      : `${Math.round(Math.max(350, ((b.earnings || 0) - (b.expenses || 0)) * 0.05)).toLocaleString()} QAR`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Financial box */}
                <div className="bg-white/80 border border-brand-border/60 rounded-2xl p-4 shadow-sm w-full md:w-auto md:min-w-[280px]">
                  <div className="text-[10px] font-black text-brand-dark flex justify-between items-center border-b border-brand-border/40 pb-2 mb-2">
                    <span>💳 {isPending ? "Estimated Ledger" : "Finalized Ledger"}</span>
                    <span className="text-[8px] text-gray-400 tracking-wider font-mono">QAR LAYER</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Earnings:</span>
                      <span className="font-bold text-emerald-600">+{Math.round(b.earnings || 0).toLocaleString()} QAR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Operational Expenses:</span>
                      <span className="font-bold text-red-600">-{Math.round(b.expenses || 0).toLocaleString()} QAR</span>
                    </div>
                    <div className="flex justify-between border-t border-dashed border-brand-border/50 pt-1.5 font-bold">
                      <span className="text-gray-600">Net Profit:</span>
                      <span className={((b.earnings || 0) - (b.expenses || 0)) > 0 ? "text-emerald-700" : "text-red-700"}>
                        {Math.round((b.earnings || 0) - (b.expenses || 0))?.toLocaleString()} QAR
                      </span>
                    </div>

                    {/* Salary Share Card */}
                    <div className="bg-brand-pale/50 border border-brand-border/60 p-2.5 rounded-xl mt-3 flex flex-col items-center">
                      <div className="text-[9px] font-bold text-brand uppercase tracking-wider">
                        {isPending ? "Est. Salary Wallet payout" : "Salary Paid out"}
                      </div>
                      <div className={`text-base font-extrabold mt-0.5 ${isPending ? "text-amber-700" : "text-brand"}`}>
                        {isSolo
                          ? `${Math.round(Math.max(750, ((b.earnings || 0) - (b.expenses || 0)) * 0.10))?.toLocaleString()} QAR`
                          : `${Math.round(Math.max(350, ((b.earnings || 0) - (b.expenses || 0)) * 0.05))?.toLocaleString()} QAR`}
                      </div>
                      <div className="text-[8px] text-gray-400 font-bold mt-0.5 uppercase">
                        {isSolo ? "10% Solo share" : "5% Split share"}
                      </div>
                      {isPending && (
                        <div className="text-[8px] text-amber-800 font-bold bg-amber-100 border border-amber-200/50 px-2 py-0.5 rounded mt-1.5 font-sans">
                          Funds pending review
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {bookings.length === 0 && (
            <div className="bg-white rounded-3xl border border-brand-border p-12 text-center text-gray-500">
              <p className="text-base font-bold">No flights logged yet.</p>
              <p className="text-xs mt-1">Once you complete flights and submit your PIREPs, they will appear here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
