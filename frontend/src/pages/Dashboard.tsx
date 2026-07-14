import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchMyProfile } from "../store/slices/pilotSlice";
import { fetchMyDiscoverySummary } from "../store/slices/discoverySlice";
import { api } from "../api/client";
import useReveal from "../hooks/useReveal";

export default function Dashboard() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { currentPilot } = useAppSelector((s) => s.pilot);
  const { summary } = useAppSelector((s) => s.discovery);
  const revealRef = useReveal();

  const [airlineBalance, setAirlineBalance] = useState<number | null>(null);
  const [globalReputation, setGlobalReputation] = useState<number | null>(null);
  const [completedFlightsCount, setCompletedFlightsCount] = useState<number>(0);

  const pilot = currentPilot || user;

  const fetchGlobalStats = async () => {
    try {
      // 1. Fetch Airline Treasury Balance
      const balanceData = await api.get<{ setting_key: string; setting_value: string }>(
        "/settings/airline_balance"
      );
      if (balanceData && balanceData.setting_value) {
        setAirlineBalance(Number(balanceData.setting_value));
      }
    } catch (e) {
      console.log("Error loading treasury setting:", e);
    }

    try {
      // 2. Fetch completed bookings to calculate global reputation and flight counts
      const bookingsData = await api.get<any[]>("/bookings?status=completed");
      if (bookingsData) {
        setCompletedFlightsCount(bookingsData.length);
        if (bookingsData.length > 0) {
          const sum = bookingsData.reduce((acc, b) => acc + (b.reputation_score || 0), 0);
          setGlobalReputation(sum / bookingsData.length);
        } else {
          setGlobalReputation(4.0); // Default if empty
        }
      }
    } catch (e) {
      console.log("Error loading global reputation:", e);
    }
  };

  useEffect(() => {
    dispatch(fetchMyProfile());
    dispatch(fetchMyDiscoverySummary());
    fetchGlobalStats();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8" ref={revealRef}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h1 className="text-5xl font-bold text-brand">Dashboard</h1>
        <div className="bg-brand-pale border border-brand-border px-4 py-2 rounded-2xl flex items-center gap-3">
          <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Pilot Wallet Balance:</div>
          <div className="text-xl font-extrabold text-brand-dark">
            {pilot?.token_balance ? `${pilot.token_balance.toLocaleString()} QAR` : "0 QAR"}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5 hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Rank</p>
          <p className="text-2xl font-bold text-brand mt-1">
            {pilot?.callsign || "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1.5 font-medium">
            {pilot?.careers?.map((c: any) => c.rank).join(", ") || "No path selected"}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5 hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Group</p>
          <p className="text-2xl font-bold text-brand mt-1">
            {pilot?.group_name || "Not assigned"}
          </p>
          <Link to="/groups" className="text-xs text-brand hover:underline mt-1.5 inline-block font-semibold">View groups</Link>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5 hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Transfer Stats</p>
          <p className="text-2xl font-bold text-brand mt-1">
            {pilot?.transhours ?? 0}h
          </p>
          <p className="text-xs text-gray-400 mt-1.5 font-medium">
            {pilot?.transflights ?? 0} flights logged
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5 hover:shadow-md transition-shadow">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Routes Discovered</p>
          <p className="text-2xl font-bold text-brand mt-1">
            {Array.isArray(summary) ? summary.reduce((a, b) => a + b.discovered_routes, 0) : 0}
          </p>
          <Link to="/careers" className="text-xs text-brand hover:underline mt-1.5 inline-block font-semibold">View progress</Link>
        </div>
      </div>

      {/* Airline Corporate Treasury & Reputation Layer (Premium Section) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-dark to-brand rounded-3xl border border-brand-border shadow-xl p-8 mb-8 text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
        
        <h2 className="text-xl font-bold uppercase tracking-wider text-brand-pale/80 mb-6">
          Qatari Virtual Corporate Operations
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Treasury Balance */}
          <div className="flex flex-col">
            <span className="text-xs font-bold text-brand-pale/70 uppercase tracking-widest">Airline Treasury Balance</span>
            <span className="text-4xl font-extrabold mt-1">
              {airlineBalance !== null ? `${airlineBalance.toLocaleString()} QAR` : "5,000,000 QAR"}
            </span>
            <span className="text-[10px] text-brand-pale/60 mt-1">Updated in real-time from active PIREPs</span>
          </div>

          {/* Global Reputation */}
          <div className="flex flex-col">
            <span className="text-xs font-bold text-brand-pale/70 uppercase tracking-widest">Global Airline Rating</span>
            <span className="text-4xl font-extrabold mt-1">
              {globalReputation !== null ? `${globalReputation.toFixed(2)} ★` : "4.00 ★"}
            </span>
            <span className="text-[10px] text-brand-pale/60 mt-1">Calculated as average of performance ratings</span>
          </div>

          {/* Total Career Completed Flights */}
          <div className="flex flex-col">
            <span className="text-xs font-bold text-brand-pale/70 uppercase tracking-widest">Completed Flights</span>
            <span className="text-4xl font-extrabold mt-1">
              {completedFlightsCount} Flight{completedFlightsCount !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] text-brand-pale/60 mt-1">Total revenue legs filed in EFB</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link to="/careers" className="bg-white rounded-2xl border border-brand-border shadow-sm hover:shadow-lg transition-all duration-300 p-6 block group">
          <h3 className="text-lg font-bold text-brand group-hover:text-brand-light transition-colors">Career Center</h3>
          <p className="text-sm text-gray-500 mt-2">Check your Airbus &amp; Boeing career progress and rank requirements.</p>
        </Link>

        <Link to="/groups" className="bg-white rounded-2xl border border-brand-border shadow-sm hover:shadow-lg transition-all duration-300 p-6 block group">
          <h3 className="text-lg font-bold text-brand group-hover:text-brand-light transition-colors">Flying Groups</h3>
          <p className="text-sm text-gray-500 mt-2">View your group, assigned aircraft, and Discord channel.</p>
        </Link>

        <Link to="/calendar" className="bg-white rounded-2xl border border-brand-border shadow-sm hover:shadow-lg transition-all duration-300 p-6 block group">
          <h3 className="text-lg font-bold text-brand group-hover:text-brand-light transition-colors">Schedule Calendar</h3>
          <p className="text-sm text-gray-500 mt-2">Weekly flight plans, wave scheduling, and aircraft availability.</p>
        </Link>

        <Link to="/bookings" className="bg-white rounded-2xl border border-brand-border shadow-sm hover:shadow-lg transition-all duration-300 p-6 block group">
          <h3 className="text-lg font-bold text-brand group-hover:text-brand-light transition-colors">My Bookings</h3>
          <p className="text-sm text-gray-500 mt-2">Your reserved flights and upcoming departures.</p>
        </Link>
      </div>
    </div>
  );
}
