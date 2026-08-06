import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchGroups } from "../store/slices/groupSlice";
import { fetchMyProfile } from "../store/slices/pilotSlice";
import { biddingApi } from "../api/biddingApi";
import type { BiddingSession } from "../api/biddingApi";
import { BiddingModal } from "../components/BiddingModal";

export default function Groups() {
  const dispatch = useAppDispatch();
  const { groups, loading } = useAppSelector((s) => s.group);
  const { currentPilot } = useAppSelector((s) => s.pilot);
  const user = useAppSelector((s: any) => s.auth.user);

  const [biddingSessions, setBiddingSessions] = useState<BiddingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<BiddingSession | null>(null);

  const loadBiddingSessions = async () => {
    try {
      const data = await biddingApi.getSessions();
      setBiddingSessions(data.filter((s) => s.status === "open"));
    } catch (err) {
      console.error("Failed to load bidding sessions:", err);
    }
  };

  useEffect(() => {
    dispatch(fetchGroups());
    if (!currentPilot) {
      dispatch(fetchMyProfile());
    }
    loadBiddingSessions();
  }, []);

  const myGroupId = currentPilot?.group_id || user?.flying_groupid;
  const activeGroups = groups.filter((g) => g.is_active);

  // Sort assigned group to top
  const sortedGroups = [...activeGroups].sort((a, b) => {
    if (a.id === myGroupId) return -1;
    if (b.id === myGroupId) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-brand">Flying Groups</h1>
          <p className="text-sm text-gray-500 mt-1">Operational groups for Qatar Virtual pilot assignments and scheduling</p>
        </div>
      </div>

      {/* Active Bidding Vacancy Banner */}
      {biddingSessions.length > 0 && (
        <div className="mb-8 p-5 rounded-3xl bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-brand/30 border border-blue-500/30 shadow-xl backdrop-blur-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-xl border border-blue-500/40 shrink-0">
                🗳️
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">
                  Active Fleet Vacancy Bidding Round
                </span>
                <h3 className="text-lg font-bold text-white">
                  {biddingSessions.length} {biddingSessions.length === 1 ? "Group Has" : "Groups Have"} Open Pilot Slots for Bidding!
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {biddingSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-md transition-all hover:scale-105 flex items-center gap-2"
                >
                  <span>✈️ {session.group_name}</span>
                  <span className="bg-white/20 text-white px-2 py-0.5 rounded-md text-[10px]">
                    {session.slots_offered} {session.slots_offered === 1 ? "Slot" : "Slots"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedGroups.map((group) => {
          const isMyGroup = group.id === myGroupId;
          const openSession = biddingSessions.find((s) => s.group_id === group.id);

          return (
            <div
              key={group.id}
              className={`relative bg-white rounded-3xl transition-all duration-300 p-6 block group overflow-hidden ${
                isMyGroup
                  ? "border-2 border-brand shadow-xl ring-4 ring-brand/15 bg-gradient-to-br from-brand/[0.04] via-[var(--bg-card)] to-amber-500/10"
                  : "border border-brand-border shadow-sm hover:shadow-lg"
              }`}
            >
              {/* Highlight ribbon for user's assigned group */}
              {isMyGroup && (
                <div className="mb-4 flex items-center justify-between bg-gradient-to-r from-brand to-brand-dark text-white px-3.5 py-1.5 rounded-full text-xs font-black shadow-sm">
                  <span className="flex items-center gap-1.5">
                    <span>★</span> YOUR ASSIGNED GROUP
                  </span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">PRIMARY</span>
                </div>
              )}

              <div className="flex items-start justify-between gap-2">
                <Link to={`/groups/${group.id}`} className="text-xl font-black text-brand hover:text-brand-light transition-colors">
                  {group.name}
                </Link>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {group.is_active ? (
                    <span className="text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-300">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-wide bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full border border-slate-300">
                      Inactive
                    </span>
                  )}
                  {group.is_full ? (
                    <span className="text-[9px] font-black uppercase tracking-wide bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200">
                      FULL ({group.member_count}/{group.max_slots})
                    </span>
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-wide bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200">
                      {group.available_slots} Slot{group.available_slots !== 1 ? "s" : ""} Open
                    </span>
                  )}
                </div>
              </div>

              {/* Group Statistics */}
              <div className="mt-5 grid grid-cols-2 gap-3 p-3 bg-gray-50/80 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    👥
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Pilot Slots</div>
                    <div className="text-sm font-black text-gray-800">
                      {group.member_count} <span className="text-xs font-normal text-gray-400">/ {group.max_slots || 2 + group.aircraft_count * 2}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                    ✈
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Fleet</div>
                    <div className="text-sm font-black text-gray-800">{group.aircraft_count}</div>
                  </div>
                </div>
              </div>

              {/* Capacity Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mb-1">
                  <span>Capacity Usage</span>
                  <span className={group.is_full ? "text-rose-600 font-extrabold" : "text-gray-600"}>
                    {Math.round(((group.member_count || 0) / (group.max_slots || 1)) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      group.is_full
                        ? "bg-rose-500"
                        : (group.member_count / (group.max_slots || 1)) > 0.75
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round(((group.member_count || 0) / (group.max_slots || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Action buttons: Bid for slot if open session exists */}
              <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                {openSession ? (
                  <button
                    onClick={() => setSelectedSession(openSession)}
                    className="w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>🗳️</span>
                    <span>
                      {openSession.user_applicant_status === "submitted"
                        ? "View Submitted Bid"
                        : `Bid for Vacancy (${openSession.slots_offered} ${openSession.slots_offered === 1 ? "Slot" : "Slots"})`}
                    </span>
                  </button>
                ) : (
                  <Link
                    to={`/groups/${group.id}`}
                    className="text-xs text-brand font-bold hover:underline flex items-center justify-between w-full"
                  >
                    <span>View Group Details</span>
                    <span>→</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {groups.length === 0 && !loading && (
        <div className="text-center py-16 bg-white rounded-3xl border border-brand-border p-8">
          <p className="text-lg font-bold text-brand">No Flying Groups Found</p>
          <p className="text-sm text-gray-500 mt-2">Staff members can create and manage flying groups in the Admin panel.</p>
        </div>
      )}

      {/* Bidding Modal */}
      {selectedSession && (
        <BiddingModal
          session={selectedSession}
          userBalance={user?.currency_balance || (currentPilot as any)?.currency_balance || 0}
          isOpen={!!selectedSession}
          onClose={() => setSelectedSession(null)}
          onSuccess={() => {
            dispatch(fetchMyProfile());
            loadBiddingSessions();
          }}
        />
      )}
    </div>
  );
}
