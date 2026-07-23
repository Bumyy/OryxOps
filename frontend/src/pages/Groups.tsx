import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchGroups } from "../store/slices/groupSlice";
import { fetchMyProfile } from "../store/slices/pilotSlice";

export default function Groups() {
  const dispatch = useAppDispatch();
  const { groups, loading } = useAppSelector((s) => s.group);
  const { currentPilot } = useAppSelector((s) => s.pilot);
  const user = useAppSelector((s: any) => s.auth.user);

  useEffect(() => {
    dispatch(fetchGroups());
    if (!currentPilot) {
      dispatch(fetchMyProfile());
    }
  }, []);

  const myGroupId = currentPilot?.group_id || user?.flying_groupid;

  // Sort assigned group to top
  const sortedGroups = [...groups].sort((a, b) => {
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedGroups.map((group) => {
          const isMyGroup = group.id === myGroupId;

          return (
            <Link
              key={group.id}
              to={`/groups/${group.id}`}
              className={`relative bg-white rounded-3xl transition-all duration-300 p-6 block group overflow-hidden ${
                isMyGroup
                  ? "border-2 border-brand shadow-xl ring-4 ring-brand/15 bg-gradient-to-br from-brand/[0.04] via-[var(--bg-card)] to-amber-500/10 hover:scale-[1.02]"
                  : "border border-brand-border shadow-sm hover:shadow-lg hover:scale-[1.01]"
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
                <h3 className="text-xl font-black text-brand group-hover:text-brand-light transition-colors">
                  {group.name}
                </h3>
                {group.is_active ? (
                  <span className="text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full shrink-0 border border-emerald-300">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-wide bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full shrink-0 border border-slate-300">
                    Inactive
                  </span>
                )}
              </div>

              {/* Group Statistics */}
              <div className="mt-5 grid grid-cols-2 gap-3 p-3 bg-gray-50/80 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    👥
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Pilots</div>
                    <div className="text-sm font-black text-gray-800">{group.member_count}</div>
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

              <div className="mt-4 flex items-center justify-between text-xs text-gray-400 font-medium">
                <span>Period: {group.period_start} &mdash; {group.period_end}</span>
                <span className="text-brand font-bold group-hover:translate-x-1 transition-transform inline-block">
                  View →
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {groups.length === 0 && !loading && (
        <div className="text-center py-16 bg-white rounded-3xl border border-brand-border p-8">
          <p className="text-lg font-bold text-brand">No Flying Groups Found</p>
          <p className="text-sm text-gray-500 mt-2">Staff members can create and manage flying groups in the Admin panel.</p>
        </div>
      )}
    </div>
  );
}
