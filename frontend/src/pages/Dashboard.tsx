import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchMyProfile } from "../store/slices/pilotSlice";
import { fetchMyDiscoverySummary } from "../store/slices/discoverySlice";
import useReveal from "../hooks/useReveal";

export default function Dashboard() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { currentPilot } = useAppSelector((s) => s.pilot);
  const { summary } = useAppSelector((s) => s.discovery);
  const revealRef = useReveal();

  useEffect(() => {
    dispatch(fetchMyProfile());
    dispatch(fetchMyDiscoverySummary());
  }, []);

  const pilot = currentPilot || user;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8" ref={revealRef}>
      <h1 className="text-5xl font-bold text-brand mb-8">Dashboard</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Rank</p>
          <p className="text-2xl font-bold text-brand mt-1">
            {pilot?.callsign || "—"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {pilot?.careers?.map((c: any) => c.rank).join(", ") || "No path"}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Group</p>
          <p className="text-2xl font-bold text-brand mt-1">
            {pilot?.group_name || "Not assigned"}
          </p>
          <Link to="/groups" className="text-xs text-brand hover:underline">View groups</Link>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Transfer Stats</p>
          <p className="text-2xl font-bold text-brand mt-1">
            {pilot?.transhours ?? 0}h
          </p>
          <p className="text-xs text-gray-450 mt-1 font-semibold text-gray-500">
            {pilot?.transflights ?? 0} flights
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Routes Discovered</p>
          <p className="text-2xl font-bold text-brand mt-1">
            {Array.isArray(summary) ? summary.reduce((a, b) => a + b.discovered_routes, 0) : 0}
          </p>
          <Link to="/careers" className="text-xs text-brand hover:underline">View progress</Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link to="/careers" className="bg-white rounded-2xl border border-brand-border shadow-sm hover:shadow-lg transition-shadow duration-300 p-6 block group">
          <h3 className="text-lg font-bold text-brand group-hover:text-brand-light transition-colors">Career Center</h3>
          <p className="text-sm text-gray-500 mt-2">Check your Airbus &amp; Boeing career progress and rank requirements.</p>
        </Link>

        <Link to="/groups" className="bg-white rounded-2xl border border-brand-border shadow-sm hover:shadow-lg transition-shadow duration-300 p-6 block group">
          <h3 className="text-lg font-bold text-brand group-hover:text-brand-light transition-colors">Flying Groups</h3>
          <p className="text-sm text-gray-500 mt-2">View your group, assigned aircraft, and Discord channel.</p>
        </Link>

        <Link to="/calendar" className="bg-white rounded-2xl border border-brand-border shadow-sm hover:shadow-lg transition-shadow duration-300 p-6 block group">
          <h3 className="text-lg font-bold text-brand group-hover:text-brand-light transition-colors">Schedule Calendar</h3>
          <p className="text-sm text-gray-500 mt-2">Weekly flight plans, wave scheduling, and aircraft availability.</p>
        </Link>

        <Link to="/bookings" className="bg-white rounded-2xl border border-brand-border shadow-sm hover:shadow-lg transition-shadow duration-300 p-6 block group">
          <h3 className="text-lg font-bold text-brand group-hover:text-brand-light transition-colors">My Bookings</h3>
          <p className="text-sm text-gray-500 mt-2">Your reserved flights and upcoming departures.</p>
        </Link>
      </div>
    </div>
  );
}
