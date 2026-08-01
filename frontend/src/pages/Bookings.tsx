import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchBookings, cancelBooking } from "../store/slices/bookingSlice";
import { api, BASE_URL } from "../api/client";
import { useCurrency } from "../hooks/useCurrency";

export default function Bookings() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currency, formatAmount } = useCurrency();
  const { bookings, loading } = useAppSelector((s) => s.booking);
  const user = useAppSelector((s) => s.auth.user);

  const [activeTab, setActiveTab] = useState<"bookings" | "logs">("bookings");
  const [selectedPaySlipBooking, setSelectedPaySlipBooking] = useState<any | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedPaySlipBooking) {
      if (pdfBlobUrl) {
        window.URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      return;
    }

    setPdfLoading(true);
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    if (token && token !== "undefined" && token !== "null") {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const pdfUrl = `${BASE_URL}/bookings/${selectedPaySlipBooking.id}/pdf${user?.id ? `?pilot_id=${user.id}` : ''}`;

    fetch(pdfUrl, { headers })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load PDF");
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        setPdfLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setPdfLoading(false);
      });

    return () => {
      if (pdfBlobUrl) {
        window.URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [selectedPaySlipBooking, user?.id]);

  const [rates, setRates] = useState<Record<string, number>>({
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

  const calculatePilotSalary = (b: any) => {
    const isSolo = b.departure_pilot_id === b.arrival_pilot_id || !b.arrival_pilot_id;
    const netProfit = (b.earnings || 0) - (b.expenses || 0);
    if (isSolo) {
      return Math.max(rates.econ_min_payout_solo, netProfit * rates.econ_payout_share_solo);
    } else {
      return Math.max(rates.econ_min_payout_split, netProfit * rates.econ_payout_share_split);
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
                    <button
                      onClick={() => navigate("/operations")}
                      className="flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-3 rounded-2xl text-sm font-black transition-all shadow-md shadow-brand/20 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3l6 9-6 9" />
                      </svg>
                      {isDispatched ? "Open Flight Ops → File PIREP" : "Open Flight Ops → Dispatch"}
                    </button>

                    {(user?.id === b.departure_pilot_id || user?.id === b.arrival_pilot_id) && (
                      <button
                        onClick={() => handleCancel(b.id)}
                        className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline text-center cursor-pointer py-1"
                      >
                        ❌ Cancel Booking
                      </button>
                    )}

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
        /* FLIGHT LOGS TAB (Simplified Clean Cards) */
        <div className="space-y-4">
          {bookings.map((b) => {
            const isCancelled = b.status === "cancelled";
            const isRejected = b.status === "rejected";

            if (isCancelled || isRejected) {
              return (
                <div
                  key={b.id}
                  className="border border-red-200 bg-rose-50/20 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
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
                  <div className="text-xs text-red-700 italic font-medium bg-red-100/40 px-4 py-2 rounded-2xl border border-red-200/50">
                    {isCancelled
                      ? "Flight was cancelled before completion."
                      : "PIREP rejected by staff. Wallet payout withheld."}
                  </div>
                </div>
              );
            }

            const isPending = b.pirep_accepted === 0;
            const salary = calculatePilotSalary(b);

            return (
              <div
                key={b.id}
                className="bg-white border border-brand-border/70 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center transition-all hover:border-brand-border"
              >
                {/* Left Flight Header Details */}
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xl font-black text-brand-dark uppercase tracking-tight">
                      {b.flight_departure} ➔ {b.flight_arrival}
                    </span>
                    {b.flight_number && (
                      <span className="text-[10px] font-extrabold text-brand bg-brand-pale border border-brand-border/60 px-2 py-0.5 rounded-md">
                        {b.flight_number}
                      </span>
                    )}
                    {isPending ? (
                      <span className="text-[9px] font-black text-amber-800 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-md animate-pulse">
                        ⏳ Pending Review
                      </span>
                    ) : (
                      <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md">
                        ✅ Approved & Paid
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 font-bold">
                    Aircraft: <span className="text-gray-700">{b.aircraft_registration} ({b.aircraft_icao})</span>
                    {b.dispatched_at && (
                      <span className="text-gray-400 ml-2">
                        · Dispatched: {new Date(b.dispatched_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </p>

                  <div className="flex gap-3 items-center pt-1 text-xs">
                    <div className="bg-brand-pale/40 border border-brand-border/40 px-3 py-1 rounded-xl font-bold text-gray-700">
                      🛬 {b.landing_fpm ? `${b.landing_fpm} FPM` : "—"}
                    </div>
                    <div className="bg-brand-pale/40 border border-brand-border/40 px-3 py-1 rounded-xl font-bold text-gray-700">
                      ⭐ {b.reputation_score ? `${b.reputation_score.toFixed(2)} / 5.0` : "—"}
                    </div>
                  </div>
                </div>

                {/* Right Action & Salary Box */}
                <div className="flex flex-col md:items-end gap-3 w-full md:w-auto min-w-[200px]">
                  <div className="bg-emerald-50 border border-emerald-200/80 p-3.5 rounded-2xl w-full text-center md:text-right">
                    <div className="text-[9px] font-black text-emerald-900 uppercase tracking-wider">
                      {isPending ? "Estimated Salary" : "Pilot Salary Earned"}
                    </div>
                    <div className="text-xl font-black text-emerald-700 mt-0.5">
                      +{formatAmount(salary)}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedPaySlipBooking(b)}
                    className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-md shadow-brand/10 cursor-pointer"
                  >
                    📄 View Pilot Pay Slip
                  </button>
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

      {/* PAY SLIP MODAL */}
      {selectedPaySlipBooking && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-brand-border shadow-2xl max-w-4xl w-full p-4 md:p-6 space-y-4 relative max-h-[95vh] flex flex-col">
            {/* Header Banner */}
            <div className="flex justify-between items-center border-b border-brand-border/60 pb-3">
              <div className="flex items-center gap-3">
                <img src="/oryxops_logo_colored.webp" alt="OryxOps Logo" className="h-9 w-auto object-contain" />
                <div>
                  <h3 className="font-extrabold text-base text-brand-dark tracking-tight">PILOT FLIGHT PAY SLIP</h3>
                  <p className="text-[10px] font-mono text-gray-400">
                    Ref: #PS-{String(selectedPaySlipBooking.id).padStart(4, '0')}-{selectedPaySlipBooking.departure_pilot_callsign || "QRV"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pdfBlobUrl && (
                  <a
                    href={pdfBlobUrl}
                    download={`PaySlip_Leg_${selectedPaySlipBooking.id}.pdf`}
                    className="flex items-center gap-1.5 text-xs font-black text-white bg-brand hover:bg-brand-dark px-3.5 py-2 rounded-xl transition-all shadow-md shadow-brand/20 cursor-pointer"
                  >
                    📥 Download PDF
                  </a>
                )}
                <button
                  onClick={() => setSelectedPaySlipBooking(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full cursor-pointer text-lg font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Embedded Live PDF Canvas */}
            <div className="w-full h-[680px] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 relative flex-grow">
              {pdfLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-xs space-y-3">
                  <span className="loading loading-spinner loading-lg text-brand"></span>
                  <p className="text-xs font-extrabold text-brand-dark animate-pulse">Compiling Official Pay Slip PDF...</p>
                  <p className="text-[10px] text-gray-400">Rendering high-fidelity layout & metrics</p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  className="w-full h-full border-0 bg-white"
                  title="Pay Slip PDF Preview"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
                  <p className="text-sm font-bold text-rose-600">Failed to load PDF preview.</p>
                  <button
                    onClick={() => setSelectedPaySlipBooking({ ...selectedPaySlipBooking })}
                    className="text-xs text-brand font-bold underline cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            <div className="text-center text-[9.5px] text-brand-dark font-bold">
              Thank you for flying with Qatari Virtual ✈
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
