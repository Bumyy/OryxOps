import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchBookings, cancelBooking } from "../store/slices/bookingSlice";
import { api } from "../api/client";

export default function Bookings() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { bookings, loading } = useAppSelector((s) => s.booking);
  const aircraftData = useAppSelector((s) => s.aircraft.specs);
  const user = useAppSelector((s) => s.auth.user);

  const [activeTab, setActiveTab] = useState<"bookings" | "logs">("bookings");
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  
  const [rates, setRates] = useState<Record<string, number>>({
    econ_fuel_price_rate: 1.10,
    econ_ticket_base_price: 150.0,
    econ_ticket_duration_rate: 2.00,
    econ_fixed_rate_per_seat: 120.0,
    econ_service_rate_per_pax: 60.0,
    econ_diversion_charge_per_pax: 100.0,
    econ_payout_share_solo: 0.10,
    econ_payout_share_split: 0.05,
    econ_min_payout_solo: 750.0,
    econ_min_payout_split: 350.0,
  });

  useEffect(() => {
    api.get("/settings").then((res: any) => {
      const data = res.data;
      if (Array.isArray(data)) {
        const mapped: Record<string, number> = {};
        data.forEach((s: any) => {
          mapped[s.setting_key] = parseFloat(s.setting_value) || 0;
        });
        setRates((prev) => ({ ...prev, ...mapped }));
      }
    }).catch((err) => console.error("Failed to load settings:", err));
  }, []);

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
        <div className="space-y-5">
          {bookings.map((b) => {
            const isDeparturePilot = user?.id === b.departure_pilot_id;
            const isSolo = b.departure_pilot_id === b.arrival_pilot_id;
            const isDispatched = !!b.dispatched_at;

            return (
              <div
                key={b.id}
                className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all ${
                  isDispatched
                    ? "border-emerald-300 ring-1 ring-emerald-200/60"
                    : "border-brand-border"
                }`}
              >
                {/* Status ribbon */}
                <div className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                  isDispatched
                    ? "bg-emerald-50 text-emerald-700 border-b border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-b border-amber-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isDispatched ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
                  {isDispatched ? "✈️ Dispatched — Flight in Progress" : "⏳ Awaiting Dispatch"}
                </div>

                <div className="p-6 flex flex-col md:flex-row gap-6 justify-between items-start">
                  {/* Left side: route details */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl font-black text-brand-dark uppercase tracking-tight">
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
                      {b.pax_count !== null && b.pax_count !== undefined && (
                        <span className="text-[9px] font-bold text-violet-800 bg-violet-100/60 border border-violet-200/60 px-2 py-0.5 rounded-md">
                          👥 {b.pax_count} Pax Manifest
                        </span>
                      )}
                    </div>

                    {b.flight_scheduled_dep && (
                      <p className="text-[10px] text-gray-400">
                        Scheduled: {new Date(b.flight_scheduled_dep).toLocaleString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} UTC
                      </p>
                    )}
                  </div>

                  {/* Right side: EFB CTA */}
                  <div className="w-full md:w-auto flex flex-col items-stretch md:items-end gap-3 min-w-[220px]">
                    {/* Primary: Go to EFB */}
                    <button
                      onClick={() => navigate("/operations")}
                      className="flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-3 rounded-2xl text-sm font-black transition-all shadow-md shadow-brand/20 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3l6 9-6 9" />
                      </svg>
                      {isDispatched ? "Open Flight Ops → File PIREP" : "Open Flight Ops → Dispatch"}
                    </button>

                    {/* Secondary: Cancel (assigned pilots) */}
                    {(user?.id === b.departure_pilot_id || user?.id === b.arrival_pilot_id) && (
                      <button
                        onClick={() => handleCancel(b.id)}
                        className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline text-center cursor-pointer py-1"
                      >
                        ❌ Cancel Booking
                      </button>
                    )}

                    {/* Info blurb */}
                    <p className="text-[9px] text-gray-400 text-center leading-relaxed">
                      {isDispatched
                        ? "Dispatch, fuel calculations & PIREP filing now live in Flight Operations."
                        : "All flight operations including dispatching are in the Flight Operations center."}
                    </p>
                  </div>
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
                      Flight: {b.flight_number || "—"} · Aircraft: {b.aircraft_registration} ({b.aircraft_icao})
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

                            <div className="text-[10px] text-gray-500 space-y-1 pt-2 font-medium">
                              <div className="flex justify-between">
                                <span>💥 Touchdown Landing Rate:</span>
                                <span className={`font-extrabold ${b.landing_fpm && b.landing_fpm > 150 ? 'text-red-700' : 'text-gray-700'}`}>
                                  {b.landing_fpm ? `${b.landing_fpm} FPM` : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>🧈 Soft Touchdown Threshold:</span>
                                <span className="font-bold">150 FPM (No Penalty)</span>
                              </div>
                              {b.landing_fpm && b.landing_fpm > 150 && (
                                <div className="flex justify-between text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded mt-1 text-[9.5px]">
                                  <span>📉 Rate Penalty:</span>
                                  <span>-{((b.landing_fpm - 150) / 4).toFixed(1)}% (-1% per 4 FPM over threshold)</span>
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
                            <div className="bg-slate-50 border-b border-brand-border/40 px-4 py-2.5 flex justify-between items-center text-[9px] font-mono text-gray-400 tracking-wider">
                              <span>LEG ITEMIZATION</span>
                              <span>QRV-EFB-LOG</span>
                            </div>

                            <div className="p-4 space-y-3.5 text-[11px] leading-relaxed">
                              {/* Ticket Revenue */}
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-black text-gray-700">👥 Passenger Revenue</div>
                                  <div className="text-[9px] text-gray-400 mt-0.5">
                                    {b.pax_count} passengers loaded
                                  </div>
                                  <div className="text-[8.5px] text-brand-dark italic mt-0.5">
                                    Formula: Pax ({b.pax_count}) × Mins ({b.flight_time_minutes || 0}) × Rate ({rates.econ_ticket_base_price} QAR/pax·m)
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
                                    Formula: kg * {rates.econ_fuel_price_rate.toFixed(2)} QAR/kg
                                  </div>
                                </div>
                                <div className="font-black text-rose-700 text-right whitespace-nowrap">
                                  -{Math.round((b.fuel_burned || 0) * rates.econ_fuel_price_rate).toLocaleString()} QAR
                                </div>
                              </div>

                              {/* Aircraft Operating Cost */}
                              {(() => {
                                const ac_icao = b.aircraft_icao || "A320";
                                const operating_cost = Math.round((b.earnings || 0) * 0.70 * 1.05);
                                return (
                                  <div className="flex justify-between items-start border-t border-gray-100 pt-3">
                                    <div>
                                      <div className="font-black text-gray-700">✈️ Aircraft Operating Cost ({ac_icao})</div>
                                      <div className="text-[9px] text-gray-400 mt-0.5">
                                        70% Gross Revenue (covers airport fees & route maintenance)
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
                                    <div className={`font-black ${b.landing_fpm > 150 ? "text-red-700" : "text-gray-700"}`}>
                                      💥 Touchdown Landing Penalty
                                    </div>
                                    <div className="text-[9px] text-gray-400 mt-0.5">Landing rate: {b.landing_fpm} FPM</div>
                                  </div>
                                  <div className="font-black text-rose-700 text-right whitespace-nowrap">
                                    -{(() => {
                                      const fpm = b.landing_fpm;
                                      if (fpm <= 150) return 0;
                                      if (fpm <= 250) return 500;
                                      if (fpm <= 350) return 2000;
                                      if (fpm <= 450) return 6000;
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
                                      Diverted to {b.actual_arrival} (Formula: {b.pax_count} pax × {rates.econ_diversion_charge_per_pax} QAR)
                                    </div>
                                  </div>
                                  <div className="font-black text-red-700 text-right whitespace-nowrap">
                                    -{((b.pax_count || 100) * rates.econ_diversion_charge_per_pax).toLocaleString()} QAR
                                  </div>
                                </div>
                              )}

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
                                    {isSolo 
                                      ? `Solo Share (${(rates.econ_payout_share_solo * 100).toFixed(0)}% of profit, min ${rates.econ_min_payout_solo} QAR)` 
                                      : `Split Crew Share (${(rates.econ_payout_share_split * 100).toFixed(0)}% of profit, min ${rates.econ_min_payout_split} QAR)`
                                    }
                                  </span>
                                </div>
                                <div className="flex justify-between items-center font-black text-brand pt-1 text-xs border-t border-dashed border-brand-border/30">
                                  <span>💰 Wallet Salary Payout:</span>
                                  <span>
                                    {isSolo
                                      ? `${Math.round(Math.max(rates.econ_min_payout_solo, ((b.earnings || 0) - (b.expenses || 0)) * rates.econ_payout_share_solo)).toLocaleString()} QAR`
                                      : `${Math.round(Math.max(rates.econ_min_payout_split, ((b.earnings || 0) - (b.expenses || 0)) * rates.econ_payout_share_split)).toLocaleString()} QAR`}
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
                          ? `${Math.round(Math.max(rates.econ_min_payout_solo, ((b.earnings || 0) - (b.expenses || 0)) * rates.econ_payout_share_solo))?.toLocaleString()} QAR`
                          : `${Math.round(Math.max(rates.econ_min_payout_split, ((b.earnings || 0) - (b.expenses || 0)) * rates.econ_payout_share_split))?.toLocaleString()} QAR`}
                      </div>
                      <div className="text-[8px] text-gray-400 font-bold mt-0.5 uppercase">
                        {isSolo ? `${(rates.econ_payout_share_solo * 100).toFixed(0)}% Solo share` : `${(rates.econ_payout_share_split * 100).toFixed(0)}% Split share`}
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
