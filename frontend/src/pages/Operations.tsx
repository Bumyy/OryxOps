import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchBookings, dispatchBooking, cancelBooking, completeBooking } from "../store/slices/bookingSlice";
import type { FlightProgress } from "../store/slices/bookingSlice";
import PaxBoardingModal from "../components/efb/briefing/PaxBoardingModal";
import { api } from "../api/client";
import { getSimBriefAircraftType } from "../components/efb/briefing/EFBBriefing";

// Aircraft fuel burn rates (kg per hour)
const FUEL_BURN_RATES: Record<string, number> = {
  "A319": 2200,
  "A320": 2450,
  "A321": 2700,
  "A330": 5500,
  "A332": 5500,
  "A333": 5500,
  "A340": 5800,
  "A359": 5800,
  "A35K": 5800,
  "B777": 6800,
  "B772": 6800,
  "B77W": 6800,
  "B77L": 6800,
  "B77F": 6800,
  "A380": 11500,
  "A388": 11500,
};

export default function Operations() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { bookings, loading } = useAppSelector((s) => s.booking);
  const aircraftData = useAppSelector((s) => s.aircraft.specs);
  const user = useAppSelector((s) => s.auth.user);

  const activeBooking = bookings.find((b) => b.status === "booked");
  const isDeparturePilot = user?.id === activeBooking?.departure_pilot_id;
  const isArrivalPilot = user?.id === activeBooking?.arrival_pilot_id;
  const isDispatched = !!activeBooking?.dispatched_at;
  const canFile = isArrivalPilot || (!activeBooking?.arrival_pilot_id && isDeparturePilot);

  // Operations state
  const [dispatching, setDispatching] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [announced, setAnnounced] = useState(false);
  const [paxModalOpen, setPaxModalOpen] = useState(false);
  const [paxModalCount, setPaxModalCount] = useState<number | null>(null);

  const handleAnnounceStatus = async () => {
    if (!activeBooking) return;
    setAnnouncing(true);
    try {
      await api.post(`/bookings/${activeBooking.id}/announce-status`);
      setAnnounced(true);
      setTimeout(() => setAnnounced(false), 5000);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to post webhook status.");
    } finally {
      setAnnouncing(false);
    }
  };




  // Calculator state
  const [calcHours, setCalcHours] = useState("");
  const [calcMinutes, setCalcMinutes] = useState("");
  const [estimatedBurn, setEstimatedBurn] = useState<number | null>(null);

  // PIREP form state
  const [pirepHours, setPirepHours] = useState("");
  const [pirepMinutes, setPirepMinutes] = useState("");
  const [pirepFuel, setPirepFuel] = useState("");
  const [pirepFpm, setPirepFpm] = useState("");
  const [isDiverted, setIsDiverted] = useState(false);
  const [pirepArrival, setPirepArrival] = useState("");
  const [submittingPirep, setSubmittingPirep] = useState(false);

  const [opProgress, setOpProgress] = useState<FlightProgress | null>(null);
  const opProgressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchBookings({ pilot_id: user.id, status: "booked" }));
    }
  }, [user, dispatch]);

  useEffect(() => {
    if (!activeBooking || !isDispatched) return;
    const poll = () => {
      api.get<FlightProgress>(`/bookings/${activeBooking.id}/progress`).then(setOpProgress).catch(() => {});
    };
    poll();
    opProgressTimer.current = setInterval(poll, 15000);
    return () => { if (opProgressTimer.current) clearInterval(opProgressTimer.current); };
  }, [activeBooking?.id, isDispatched]);

  useEffect(() => {
    if (activeBooking?.auto_flight_time_minutes) {
      const mins = activeBooking.auto_flight_time_minutes;
      setPirepHours(String(Math.floor(mins / 60)));
      setPirepMinutes(String(mins % 60));
    }
  }, [activeBooking?.auto_flight_time_minutes]);

  const refetchBookings = () => {
    if (user?.id) dispatch(fetchBookings({ pilot_id: user.id, status: "booked" }));
  };

  // Fuel usage calculator engine
  const handleCalculateFuel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking) return;
    const hours = parseFloat(calcHours) || 0;
    const mins = parseFloat(calcMinutes) || 0;
    const totalHours = hours + (mins / 60);

    if (totalHours <= 0) {
      alert("Please enter a valid flight duration.");
      return;
    }

    const icao = (activeBooking.aircraft_icao || "A320").toUpperCase();
    const hourlyRate = FUEL_BURN_RATES[icao] || 2400; // default standard narrowbody hourly burn
    const tripBurn = totalHours * hourlyRate;
    const totalBurnWithReserves = Math.round(tripBurn);
    setEstimatedBurn(totalBurnWithReserves);
  };

  const handleCopyFuel = () => {
    if (estimatedBurn !== null) {
      setPirepFuel(String(estimatedBurn));
    }
  };

  const handleDispatchFlight = async () => {
    if (!activeBooking) return;
    setDispatching(true);
    const res = await dispatch(dispatchBooking(activeBooking.id));
    setDispatching(false);
    if (dispatchBooking.fulfilled.match(res)) {
      await dispatch(fetchBookings({ pilot_id: user!.id, status: "booked" }));
      const updatedBooking = (res.payload as any);
      const pax = updatedBooking?.pax_count ?? activeBooking.pax_count ?? 150;
      setPaxModalCount(pax);
      setPaxModalOpen(true);
    } else {
      alert("Failed to dispatch flight: " + (res.error?.message || "Unknown error"));
    }
  };

  const handleCancelFlight = async () => {
    if (!activeBooking) return;
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    const res = await dispatch(cancelBooking(activeBooking.id));
    if (cancelBooking.fulfilled.match(res)) {
      refetchBookings();
    } else {
      alert("Failed to cancel booking: " + (res.error?.message || "Unknown error"));
    }
  };

  const handleFilePirep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking) return;

    const hours = Number(pirepHours) || 0;
    const minutes = Number(pirepMinutes) || 0;
    const totalMinutes = (hours * 60) + minutes;

    const fuel = Number(pirepFuel);
    const fpm = Number(pirepFpm);
    const arrival = isDiverted
      ? pirepArrival.trim().toUpperCase()
      : activeBooking.flight_arrival?.toUpperCase() || "";

    if (totalMinutes <= 0) {
      alert("Please fill in a valid positive flight duration.");
      return;
    }
    if (fuel < 0 || fpm < 0) {
      alert("Please fill in valid positive stats for Fuel and Landing Rate.");
      return;
    }
    if (isDiverted && arrival.length !== 4) {
      alert("Please enter a valid 4-letter landing airport ICAO code.");
      return;
    }

    setSubmittingPirep(true);
    const res = await dispatch(completeBooking({
      id: activeBooking.id,
      flightTimeMinutes: totalMinutes,
      fuelBurned: fuel,
      landingFpm: fpm,
      actualArrival: arrival,
    }));
    setSubmittingPirep(false);

    if (completeBooking.fulfilled.match(res)) {
      alert("Manual PIREP filed successfully! Pending staff review.");
      setPirepHours("");
      setPirepMinutes("");
      setPirepFuel("");
      setPirepFpm("");
      setIsDiverted(false);
      setPirepArrival("");
      refetchBookings();
    } else {
      alert("Failed to file PIREP: " + (res.error?.message || "Unknown error"));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <h1 className="text-4xl font-extrabold text-brand tracking-tight mb-2">Flight Operations</h1>
      <p className="text-gray-500 text-sm mb-8">Manage dispatches, calculate fuel stats, and file pilot logbook reports.</p>

      {loading ? (
        <div className="bg-white rounded-3xl border border-brand-border/60 p-6 space-y-4 animate-pulse">
          <div className="h-6 w-48 bg-gray-100 rounded-lg" />
          <div className="h-4 w-64 bg-gray-100 rounded-md" />
        </div>
      ) : activeBooking ? (
        <div className="space-y-6">
          {/* Booking Overview Card */}
          <div className="bg-white rounded-3xl border border-brand-border/80 p-6 shadow-sm">
            <div className="flex justify-between items-center border-b border-brand-border/30 pb-4 mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Current Booking Flight</span>
                <h3 className="text-2xl font-black text-brand-dark uppercase tracking-tight">
                  {activeBooking.flight_departure} ➔ {activeBooking.flight_arrival}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-brand bg-brand-pale border border-brand-border/50 px-3 py-1.5 rounded-xl">
                  {activeBooking.flight_number || "QR-OPS"}
                </span>
                {(isDeparturePilot || isArrivalPilot) && (
                  <button
                    onClick={handleCancelFlight}
                    className="text-xs font-bold text-red-600 hover:text-white hover:bg-red-600 border border-red-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel Booking
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-gray-400 font-medium">Aircraft:</span>
                <p className="font-extrabold text-gray-800 mt-0.5">
                  {activeBooking.aircraft_registration} ({activeBooking.aircraft_icao})
                </p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Crew Layout:</span>
                <p className="font-extrabold text-gray-800 mt-0.5">
                  {activeBooking.departure_pilot_id === activeBooking.arrival_pilot_id ? "Solo Flight" : "Split Crew"}
                </p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Pre-fill Pax count:</span>
                <p className="font-extrabold text-gray-800 mt-0.5">
                  {activeBooking.pax_count ?? "Not generated"} Pax
                </p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Status:</span>
                <p className={`font-black uppercase mt-0.5 ${isDispatched ? "text-emerald-600" : "text-amber-600"}`}>
                  {isDispatched ? "🟢 Dispatched" : "⏳ Pre-flight"}
                </p>
              </div>
            </div>
          </div>

          {!isDispatched ? (
            /* 🚀 DISPATCH CARD */
            <div
              className="rounded-3xl p-6 shadow-xs flex flex-col md:flex-row gap-6 justify-between items-start md:items-center"
              style={{
                background: "var(--status-warn-bg)",
                border: "1px solid var(--status-warn-border)",
              }}
            >
              <div className="space-y-1">
                <h4 className="font-black text-lg" style={{ color: "var(--status-warn-text)" }}>Departure Dispatch Deck</h4>
                <p className="text-xs max-w-md leading-relaxed opacity-90" style={{ color: "var(--status-warn-text)" }}>
                  Dispatching the flight generates the dynamic passenger manifest layout and activates planning telemetry links.
                </p>
              </div>
              <div className="w-full md:w-auto flex flex-col gap-2 min-w-[200px]">
                {isDeparturePilot ? (
                  <button
                    onClick={handleDispatchFlight}
                    disabled={dispatching}
                    className="btn btn-warning btn-wide text-white"
                  >
                    {dispatching ? "Dispatching..." : "🚀 Dispatch Flight"}
                  </button>
                ) : (
                  <div className="text-xs text-gray-500 bg-[var(--bg-card)] border border-[var(--border-main)] px-4 py-3 rounded-2xl text-center italic">
                    Waiting for takeoff pilot to dispatch
                  </div>
                )}
                {(isDeparturePilot || isArrivalPilot) && (
                  <button
                    onClick={handleCancelFlight}
                    className="btn btn-ghost btn-xs text-error"
                  >
                    Cancel Booking
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* 📝 ACTIVE OPERATIONS DASHBOARD */
            <div className="space-y-6">
              {/* Broadcast Fleet Movement Webhook Card */}
              <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-5 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 border border-purple-700/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-xl shrink-0">
                    📡
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">Fleet Movement Broadcast</h4>
                    <p className="text-xs text-purple-200/80 mt-0.5">Publish live enroute status & pilot ping to #fleet-logs</p>
                  </div>
                </div>
                <button
                  onClick={handleAnnounceStatus}
                  disabled={announcing}
                  className="btn btn-secondary btn-sm"
                >
                  {announcing ? "Broadcasting..." : announced ? "✓ Status Posted to #fleet-logs" : "📢 Send Webhook Status"}
                </button>
              </div>

              {/* Live Tracking Card */}
              {opProgress && (
                <div className="card border border-success/30 ring-1 ring-success/20 shadow-sm">
                  <div className="card-title px-6 py-3 bg-gradient-to-r from-success/10 to-info/10 border-b border-success/20 flex items-center justify-between m-0">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${opProgress.active_on_server ? "badge-success" : "badge-warning"} badge-sm gap-1 font-bold uppercase`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${opProgress.active_on_server ? "bg-success animate-pulse" : "bg-warning"}`} />
                        {opProgress.active_on_server ? "Live Tracking Active" : "Aircraft Offline"}
                      </span>
                    </div>
                    {opProgress.callsign && (
                      <span className="badge badge-ghost font-mono text-xs">{opProgress.callsign}</span>
                    )}
                  </div>
                  <div className="card-body p-6 space-y-4">
                    {opProgress.progress_pct !== null && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-gray-500">Flight Progress</span>
                          <span className="text-success">{opProgress.progress_pct}%</span>
                        </div>
                        <progress className="progress progress-success w-full h-3" value={opProgress.progress_pct} max="100" />
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      <div className="stat bg-info/5 rounded-xl p-3">
                        <div className="stat-title text-[9px]">Ground Speed</div>
                        <div className="stat-value text-lg">{opProgress.speed ?? "—"} <span className="text-[11px] font-normal">kt</span></div>
                      </div>
                      <div className="stat bg-info/5 rounded-xl p-3">
                        <div className="stat-title text-[9px]">Altitude</div>
                        <div className="stat-value text-lg">{opProgress.altitude?.toLocaleString() ?? "—"} <span className="text-[11px] font-normal">ft</span></div>
                      </div>
                      <div className="stat bg-info/5 rounded-xl p-3">
                        <div className="stat-title text-[9px]">Heading</div>
                        <div className="stat-value text-lg">{opProgress.heading ?? "—"}°</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="stat bg-warning/10 rounded-xl p-3">
                        <div className="stat-title text-[9px]">Distance Left</div>
                        <div className="stat-value text-lg text-warning">{opProgress.distance_remaining_nm ?? "—"} <span className="text-[11px] font-normal">nm</span></div>
                      </div>
                      <div className="stat bg-success/10 rounded-xl p-3">
                        <div className="stat-title text-[9px]">ETA</div>
                        <div className="stat-value text-lg text-success">{opProgress.eta_minutes ?? "—"} <span className="text-[11px] font-normal">min</span></div>
                      </div>
                      <div className={`stat rounded-xl p-3 ${opProgress.on_ground ? "bg-error/10" : "bg-base-200"}`}>
                        <div className="stat-title text-[9px]">On Ground</div>
                        <div className={`stat-value text-lg ${opProgress.on_ground ? "text-error" : "text-base-content/50"}`}>{opProgress.on_ground ? "YES" : "NO"}</div>
                      </div>
                    </div>

                    {opProgress.total_distance_nm && (
                      <p className="text-[10px] text-gray-400 text-center">
                        Total route: {opProgress.total_distance_nm} nm · {opProgress.distance_remaining_nm !== null ? `${opProgress.distance_remaining_nm} nm remaining` : ""}
                      </p>
                    )}

                    {opProgress.last_report && (
                      <p className="text-[9px] text-gray-400 text-center">
                        Last data: {opProgress.last_report}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Left Column: Calculator & Links */}
              <div className="space-y-6">
                {/* External Planning Card */}
                <div className="bg-white rounded-3xl border border-brand-border/60 p-6 shadow-sm space-y-4">
                  <h4 className="font-black text-brand text-sm">Aviation Flight Planning</h4>
                  <p className="text-xs text-gray-500">Use standard flight dispatching templates for Infinite Flight plans.</p>
                  
                  <div className="flex flex-col gap-3">
                    <a
                      href={`https://www.simbrief.com/system/dispatch.php?orig=${activeBooking.flight_departure}&dest=${activeBooking.flight_arrival}&pax=${activeBooking.pax_count || 150}&type=${getSimBriefAircraftType(activeBooking.aircraft_icao)}&flt=${activeBooking.flight_number?.replace(/\D/g, "") || "100"}&airline=${activeBooking.flight_number?.replace(/\d/g, "") || "QR"}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-error btn-wide"
                    >
                      🔗 SimBrief Dispatch
                    </a>
                    <a
                      href={`https://www.flightaware.com/live/findflight?origin=${activeBooking.flight_departure}&destination=${activeBooking.flight_arrival}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-info btn-wide text-white"
                    >
                      🌐 FlightAware Tracker
                    </a>
                  </div>
                </div>

                {/* Fuel Usage Calculator */}
                <div className="bg-white rounded-3xl border border-brand-border/60 p-6 shadow-sm space-y-4">
                  <h4 className="font-black text-brand text-sm flex items-center gap-1.5">
                    <span>⛽</span> Fuel Burn Estimator
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Estimate standard fuel usage for your **{activeBooking.aircraft_icao}** (Average hourly burn: **{FUEL_BURN_RATES[(activeBooking.aircraft_icao || "A320").toUpperCase()] || 2400} kg/hr**).
                  </p>

                  <form onSubmit={handleCalculateFuel} className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Hours (HH)</label>
                      <input
                        type="number"
                        placeholder="e.g. 6"
                        value={calcHours}
                        onChange={(e) => setCalcHours(e.target.value)}
                        className="mt-1 w-full border border-brand-border/60 rounded-xl px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Minutes (MM)</label>
                      <input
                        type="number"
                        placeholder="e.g. 22"
                        value={calcMinutes}
                        onChange={(e) => setCalcMinutes(e.target.value)}
                        className="mt-1 w-full border border-brand-border/60 rounded-xl px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-ghost btn-sm col-span-2"
                    >
                      Calculate Estimate
                    </button>
                  </form>

                  {estimatedBurn !== null && (
                    <div className="bg-slate-50 border border-brand-border/40 p-4 rounded-2xl flex justify-between items-center">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-400">Estimated Burn</span>
                        <p className="text-lg font-black text-brand">{estimatedBurn.toLocaleString()} kg</p>
                      </div>
                      <button
                        onClick={handleCopyFuel}
                        className="btn btn-primary btn-xs"
                      >
                        Copy to PIREP
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: PIREP Filing Form */}
              <div className="bg-white rounded-3xl border border-brand-border/60 p-6 shadow-sm space-y-4">
                <h4 className="font-black text-brand text-sm flex items-center gap-1.5">
                  <span>📝</span> File Manual PIREP
                </h4>
                <p className="text-xs text-gray-500">File your flight specs to complete the leg booking and process balances.</p>

                {canFile ? (
                  <form onSubmit={handleFilePirep} className="space-y-4">
                    {/* Separate HH / MM Boxes */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Flight Duration</label>
                      <div className="grid grid-cols-2 gap-3 mt-1">
                        <div>
                          <input
                            type="number"
                            placeholder="Hours (HH)"
                            value={pirepHours}
                            onChange={(e) => setPirepHours(e.target.value)}
                            className="w-full border border-brand-border/60 rounded-xl px-3 py-2 text-xs focus:outline-none font-semibold"
                            required
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            placeholder="Minutes (MM)"
                            value={pirepMinutes}
                            onChange={(e) => setPirepMinutes(e.target.value)}
                            className="w-full border border-brand-border/60 rounded-xl px-3 py-2 text-xs focus:outline-none font-semibold"
                            required
                          />
                        </div>
                      </div>
                      {activeBooking?.auto_flight_time_minutes && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="badge badge-success badge-xs gap-1">
                            Auto-tracked
                          </span>
                          <span className="text-[9px] text-gray-400">
                            Detected from IF: {Math.floor(activeBooking.auto_flight_time_minutes / 60)}h {activeBooking.auto_flight_time_minutes % 60}m
                            {activeBooking.actual_departure && <> · Departed {new Date(activeBooking.actual_departure).toLocaleTimeString("en-GB", { timeZone: "UTC" })} UTC</>}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Fuel Burned (kg)</label>
                      <input
                        type="number"
                        placeholder="e.g. 42000"
                        value={pirepFuel}
                        onChange={(e) => setPirepFuel(e.target.value)}
                        className="mt-1 w-full border border-brand-border/60 rounded-xl px-3 py-2 text-xs focus:outline-none font-semibold"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Landing Smoothness (FPM)</label>
                      <input
                        type="number"
                        placeholder="e.g. 120"
                        value={pirepFpm}
                        onChange={(e) => setPirepFpm(e.target.value)}
                        className="mt-1 w-full border border-brand-border/60 rounded-xl px-3 py-2 text-xs focus:outline-none font-semibold"
                        required
                      />
                    </div>

                    {/* Diverted Button / Toggle */}
                    <div className="flex items-center justify-between bg-slate-50 border border-brand-border/40 p-3 rounded-2xl">
                      <div>
                        <span className="text-xs font-bold text-gray-700">Flight Diverted?</span>
                        <p className="text-[9px] text-gray-400 mt-0.5">Toggle to log landing at alternate ICAO</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={isDiverted}
                        onChange={(e) => {
                          setIsDiverted(e.target.checked);
                          if (!e.target.checked) setPirepArrival("");
                        }}
                        className="toggle toggle-primary cursor-pointer"
                      />
                    </div>

                    {/* Slide down alternate landing airport box */}
                    {isDiverted && (
                      <div className="animate-fade-in">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Actual alternate Landing Airport (ICAO)</label>
                        <input
                          type="text"
                          maxLength={4}
                          placeholder="e.g. EGLL"
                          value={pirepArrival}
                          onChange={(e) => setPirepArrival(e.target.value.toUpperCase())}
                          className="mt-1 w-full border border-brand-border/60 rounded-xl px-3 py-2 text-xs focus:outline-none font-black uppercase"
                          required={isDiverted}
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submittingPirep}
                      className="btn btn-success btn-wide text-white"
                    >
                      {submittingPirep ? "Submitting PIREP..." : "✅ File PIREP & Finish Leg"}
                    </button>
                  </form>
                ) : (
                  <div className="text-xs text-gray-500 italic bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl text-center">
                    Only the assigned landing pilot can file the flight completion PIREP.
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-brand-border p-12 text-center text-gray-500">
          <p className="text-base font-bold">No active flight booking found.</p>
          <p className="text-xs mt-1">Book a calendar schedule leg to access the Flight Operations Center.</p>
        </div>
      )}


      {/* Pax Boarding Animation Modal */}
      <PaxBoardingModal
        isOpen={paxModalOpen}
        finalPaxCount={paxModalCount}
        aircraftIcao={activeBooking?.aircraft_icao}
        flightNumber={activeBooking?.flight_number}
        origin={activeBooking?.flight_departure}
        destination={activeBooking?.flight_arrival}
        seatCapacity={(() => {
          const code = activeBooking?.aircraft_icao?.toUpperCase() || "";
          return (aircraftsDb as any)?.[code]?.properties?.capacity || 300;
        })()}
        onComplete={() => setPaxModalOpen(false)}
      />
    </div>
  );
}

// Mock database to pass checks, we will resolve dynamically or read inside layout
const aircraftsDb = {
  "A319": { properties: { capacity: 150 } },
  "A320": { properties: { capacity: 180 } },
  "A321": { properties: { capacity: 220 } },
  "A330": { properties: { capacity: 300 } },
  "A332": { properties: { capacity: 300 } },
  "A333": { properties: { capacity: 300 } },
  "A340": { properties: { capacity: 350 } },
  "A359": { properties: { capacity: 325 } },
  "A35K": { properties: { capacity: 395 } },
  "B777": { properties: { capacity: 396 } },
  "B772": { properties: { capacity: 312 } },
  "B77W": { properties: { capacity: 396 } },
  "B77L": { properties: { capacity: 312 } },
  "B77F": { properties: { capacity: 312 } },
  "A380": { properties: { capacity: 517 } },
  "A388": { properties: { capacity: 517 } },
};
