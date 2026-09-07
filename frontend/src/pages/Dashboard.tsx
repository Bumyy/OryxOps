import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrency } from "../hooks/useCurrency";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchMyProfile } from "../store/slices/pilotSlice";
import { fetchBookings } from "../store/slices/bookingSlice";
import { api } from "../api/client";

// ── Zulu Clock ─────────────────────────────────────────────
function ZuluClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(d.toISOString().slice(11, 19) + "Z");
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-sm font-bold tracking-widest text-brand">
      {time}
    </span>
  );
}

// ── Greeting helper ─────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// ── Derive title from grade / callsign ───────────────────────────
function getPilotTitle(grade: number | null | undefined): string {
  if (grade && grade >= 4) return "Captain";
  if (grade && grade >= 2) return "First Officer";
  return "Pilot";
}

// ── Animated count-up ───────────────────────────────────────
function CountUp({ to, prefix = "", suffix = "", decimals = 0 }: { to: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!to) return;
    let start = 0;
    const duration = 900;
    const step = 16;
    const increment = to / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= to) { setVal(to); clearInterval(timer); }
      else setVal(start);
    }, step);
    return () => clearInterval(timer);
  }, [to]);
  return <>{prefix}{decimals > 0 ? val.toFixed(decimals) : Math.floor(val)}{suffix}</>;
}

export default function Dashboard() {
  const dispatch = useAppDispatch();
  const { formatAmount } = useCurrency();
  const { user } = useAppSelector((s) => s.auth);
  const { currentPilot } = useAppSelector((s) => s.pilot);
  const { bookings } = useAppSelector((s) => s.booking);

  const [globalReputation, setGlobalReputation] = useState<number | null>(null);
  const [completedFlightsCount, setCompletedFlightsCount] = useState<number>(0);
  const [quota, setQuota] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const pilot = currentPilot || user;
  const activeBooking = bookings.find((b) => b.status === "booked");

  const fetchData = async () => {
    try {
      const today = new Date();
      const monday = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))).toISOString().split("T")[0];
      const quotaData = await api.get<any>(`/schedules/proposal-quota?week_start=${monday}`);
      if (quotaData) setQuota(quotaData);
      const logsData = await api.get<any[]>("/pilots/me/proposal-transactions");
      if (logsData) setLogs(logsData);
    } catch {}

    try {
      const bookingsData = await api.get<any[]>("/bookings?status=completed");
      if (bookingsData) {
        setCompletedFlightsCount(bookingsData.length);
        if (bookingsData.length > 0) {
          const sum = bookingsData.reduce((acc, b) => acc + (b.reputation_score || 0), 0);
          setGlobalReputation(sum / bookingsData.length);
        } else {
          setGlobalReputation(4.0);
        }
      }
    } catch {}
  };

  useEffect(() => {
    dispatch(fetchMyProfile());
    dispatch(fetchBookings({ pilot_id: user?.id, status: "booked" }));
    fetchData();
  }, []);

  const quotaPercent = quota ? Math.round((quota.proposals_used / quota.weekly_limit) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-5 py-8 space-y-6">

      {/* ─── SECTION 1: HERO BANNER ─────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-brand-border bg-white shadow-sm p-7">
        {/* decorative glow blobs */}
        <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-brand/8 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-20 w-48 h-32 rounded-full bg-brand/5 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Left: Greeting */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">{getGreeting()}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <ZuluClock />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
              <span className="text-gray-400 font-semibold text-2xl sm:text-3xl">{getPilotTitle(pilot?.grade)}</span>{" "}
              <span className="text-brand">{pilot?.name || pilot?.callsign || "—"}</span>
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {/* Callsign badge */}
              <span className="inline-flex items-center gap-1.5 bg-brand text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {pilot?.callsign || "—"}
              </span>
              {/* Grade badge */}
              {pilot?.grade != null && (
                <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
                  ✦ Grade {pilot.grade}
                </span>
              )}
            </div>
          </div>

          {/* Right: Wallet */}
          <div className="flex-shrink-0 bg-brand-pale border border-brand-border rounded-2xl px-6 py-4 text-right space-y-0.5 min-w-[160px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pilot Wallet</p>
            <p className="text-2xl font-extrabold text-brand-dark tabular-nums">
              {pilot?.token_balance != null ? formatAmount(pilot.token_balance) : formatAmount(0)}
            </p>
            <p className="text-[10px] text-gray-400 font-medium">Token balance</p>
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: ACTIVE BOOKING ALERT ───────────────── */}
      {activeBooking ? (
        <div className="flex items-center gap-4 bg-brand text-white rounded-2xl px-5 py-4 shadow-md shadow-brand/20">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black uppercase tracking-wider text-white/70">Active Flight Booked</p>
            <p className="text-sm font-bold truncate">
              {activeBooking.flight_number && <span className="mr-2 opacity-80">{activeBooking.flight_number}</span>}
              {activeBooking.flight_departure} → {activeBooking.flight_arrival}
              {activeBooking.aircraft_registration && (
                <span className="ml-2 text-white/70 font-mono text-xs">({activeBooking.aircraft_registration})</span>
              )}
            </p>
          </div>
          <Link
            to="/efb"
            className="flex-shrink-0 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
          >
            Open EFB
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-4 bg-gray-50 border border-brand-border rounded-2xl px-5 py-4">
          <div className="w-9 h-9 rounded-xl bg-brand-pale border border-brand-border flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-700">No active flight booked</p>
            <p className="text-xs text-gray-400">Browse the schedule to pick up your next leg.</p>
          </div>
          <Link
            to="/calendar"
            className="flex-shrink-0 bg-brand hover:bg-brand-dark text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
          >
            Browse Schedule
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      )}

      {/* ─── SECTION 3: STAT CARDS (3 cards) ────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Card 1: Fleet Registry */}
        <Link to="/fleet" className="group bg-white rounded-2xl border border-brand-border shadow-sm p-5 hover:shadow-md hover:border-brand/40 transition-all duration-200 block">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-brand-pale border border-brand-border flex items-center justify-center">
              <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <svg className="w-4 h-4 text-gray-300 group-hover:text-brand transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Fleet Registry</p>
          <p className="text-xl font-extrabold text-gray-900 leading-tight truncate">Official Fleet</p>
          <p className="text-xs text-gray-400 mt-1 font-semibold truncate">
            25 Active Airframes
          </p>
        </Link>

        {/* Card 2: Weekly Proposals */}
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-brand-pale border border-brand-border flex items-center justify-center">
              <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <Link to="/shop" className="text-[10px] font-black uppercase tracking-wider text-brand hover:underline">Shop →</Link>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Weekly Proposals</p>
          <p className="text-xl font-extrabold text-gray-900">
            {quota ? `${quota.proposals_used} / ${quota.weekly_limit}` : "—"}
          </p>
          {quota && (
            <>
              <div className="mt-3 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${quotaPercent >= 80 ? "bg-rose-500" : "bg-brand"}`}
                  style={{ width: `${Math.min(100, quotaPercent)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 font-semibold">
                {quota.remaining_free_slots ?? 0} free slots left
              </p>
            </>
          )}
        </div>

        {/* Card 3: Pilot Wallet */}
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Balance</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Pilot Wallet</p>
          <p className="text-xl font-extrabold text-gray-900 tabular-nums">
            {pilot?.token_balance != null ? formatAmount(pilot.token_balance) : formatAmount(0)}
          </p>
          <div className="mt-3 flex gap-2 text-[10px] font-bold text-gray-400">
            <span className="bg-gray-100 rounded-lg px-2 py-0.5">Short: {quota?.purchased_short_slots ?? 0} tkn</span>
            <span className="bg-gray-100 rounded-lg px-2 py-0.5">Long: {quota?.purchased_long_slots ?? 0} tkn</span>
          </div>
        </div>
      </div>

      {/* ─── SECTION 4: AIRLINE METRICS STRIP ───────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark via-brand to-brand-light border border-brand/30 shadow-xl p-7 text-white">
        {/* texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "24px 24px"
        }} />
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />

        <p className="relative text-[10px] font-black uppercase tracking-widest text-white/50 mb-6">Qatari Virtual — Airline Operations</p>

        <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-8">
          {/* Global Reputation */}
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Global Airline Rating</p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-extrabold tabular-nums">
                {globalReputation !== null
                  ? <CountUp to={globalReputation} decimals={2} />
                  : "4.00"}
              </span>
              <div className="flex gap-0.5 mb-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg key={i} className={`w-4 h-4 ${(globalReputation ?? 4) >= i ? "text-amber-400" : "text-white/20"}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-white/40">Average of all completed flight reputation scores</p>
          </div>

          {/* Completed Flights */}
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Completed Flights</p>
            <p className="text-4xl font-extrabold tabular-nums">
              <CountUp to={completedFlightsCount} suffix=" Legs" />
            </p>
            <p className="text-[10px] text-white/40">Total revenue legs filed across all pilots</p>
          </div>
        </div>
      </div>

      {/* ─── SECTION 5: SPLIT BOTTOM ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Left: Proposal Transaction Log */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-brand-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-extrabold text-gray-800">Proposal Transactions</h2>
              <p className="text-xs text-gray-400 mt-0.5">Slot purchases and proposal token usage</p>
            </div>
            <Link
              to="/shop"
              className="bg-brand hover:bg-brand-dark text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5"
            >
              Shop
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-brand-border rounded-2xl space-y-2">
              <div className="text-3xl">📋</div>
              <p className="text-sm font-bold text-gray-400">No transactions yet</p>
              <p className="text-xs text-gray-300">Proposal purchases and usage will appear here.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.slice(0, 8).map((log) => {
                const isPurchase = log.amount < 0 && log.description.includes("Pre-purchased");
                const isConsumed = log.amount === 0;
                return (
                  <div key={log.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-pale transition-colors group">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black ${
                      isPurchase ? "bg-blue-50 text-blue-600 border border-blue-100"
                        : isConsumed ? "bg-purple-50 text-purple-600 border border-purple-100"
                        : "bg-amber-50 text-amber-600 border border-amber-100"
                    }`}>
                      {isPurchase ? "🛒" : isConsumed ? "✓" : "⚡"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{log.description}</p>
                      {log.flight_detail && (
                        <p className="text-[10px] text-brand font-bold">
                          ✈ {log.flight_detail.flight_number} · {log.flight_detail.departure} → {log.flight_detail.arrival}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-extrabold ${log.amount < 0 ? "text-rose-500" : "text-gray-400"}`}>
                        {log.amount === 0 ? "Free" : formatAmount(log.amount)}
                      </p>
                      <p className="text-[10px] text-gray-300">{new Date(log.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Quick Actions */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3 content-start">
          {[
            {
              to: "/bookings",
              icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
              label: "Bookings",
              desc: "Active & past flights",
              color: "text-sky-600",
              bg: "bg-sky-50 border-sky-100",
            },
            {
              to: "/operations",
              icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
              label: "Operations",
              desc: "Active flight dispatch",
              color: "text-violet-600",
              bg: "bg-violet-50 border-violet-100",
            },
            {
              to: "/calendar",
              icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
              label: "Schedule",
              desc: "Waves & flight plans",
              color: "text-emerald-600",
              bg: "bg-emerald-50 border-emerald-100",
            },
            {
              to: "/efb",
              icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
              label: "EFB",
              desc: "Briefing & checklist",
              color: "text-brand",
              bg: "bg-brand-pale border-brand-border",
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group bg-white rounded-2xl border border-brand-border shadow-sm p-4 hover:shadow-md hover:border-opacity-80 transition-all duration-200 flex flex-col gap-3"
            >
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${item.bg} transition-transform group-hover:scale-110 duration-200`}>
                <svg className={`w-4 h-4 ${item.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
              </div>
              <div>
                <p className="text-sm font-extrabold text-gray-800 group-hover:text-brand transition-colors">{item.label}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
