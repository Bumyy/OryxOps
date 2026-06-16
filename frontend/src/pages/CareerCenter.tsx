import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  fetchCareerPaths, fetchPilotCareers, fetchCareerProgress,
  fetchCareerPathDetail, fetchRankAircraft,
} from "../store/slices/careerSlice";
import { fetchAircraftTypes } from "../store/slices/aircraftSlice";
import { fetchMyDiscoverySummary } from "../store/slices/discoverySlice";

export default function CareerCenter() {
  const dispatch = useAppDispatch();
  const { paths, pilotCareers, progress } = useAppSelector((s) => s.career);
  const { types } = useAppSelector((s) => s.aircraft);
  const { summary: discoverySummary } = useAppSelector((s) => s.discovery);
  const user = useAppSelector((s) => s.auth.user);
  const [activePathId, setActivePathId] = useState<number | null>(null);
  const [pathDetail, setPathDetail] = useState<any>(null);
  const [rankAircraft, setRankAircraft] = useState<Record<number, any[]>>({});

  useEffect(() => {
    dispatch(fetchCareerPaths());
    dispatch(fetchAircraftTypes());
    dispatch(fetchMyDiscoverySummary());
    if (user) dispatch(fetchPilotCareers(user.id));
  }, []);

  useEffect(() => {
    if (activePathId && user) {
      dispatch(fetchCareerProgress({ pilotId: user.id, pathId: activePathId }));
      dispatch(fetchCareerPathDetail(activePathId)).then((res: any) => {
        const detail = res.payload || res;
        setPathDetail(detail);
        if (detail?.ranks) {
          detail.ranks.forEach((rank: any) => {
            dispatch(fetchRankAircraft(rank.id)).then((acRes: any) => {
              setRankAircraft(prev => ({ ...prev, [rank.id]: acRes.payload || acRes || [] }));
            });
          });
        }
      });
    }
  }, [activePathId, user]);

  const progressKey = user && activePathId ? `${user.id}_${activePathId}` : null;
  const currentProgress = progressKey ? progress[progressKey] : null;
  const activeCareer = pilotCareers.find(pc => pc.career_path_id === activePathId);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-brand mb-8">Career Center</h1>

      {pilotCareers.length === 0 && (
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-8 text-center mb-8">
          <p className="text-lg text-gray-500">You're not enrolled in any career path yet.</p>
          <p className="text-sm text-gray-400 mt-1">Staff can enroll you in Admin → Pilots.</p>
        </div>
      )}

      {/* Path cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {paths.map((path) => {
          const pc = pilotCareers.find(c => c.career_path_id === path.id);
          const disc = Array.isArray(discoverySummary) ? discoverySummary.filter(d => {
            if (!pathDetail) return false;
            const rankIds = pathDetail.ranks?.map((r: any) => r.id) || [];
            return true;
          }) : [];
          const totalDisc = Array.isArray(discoverySummary) ? discoverySummary.reduce((sum, d) => sum + d.discovered_routes, 0) : 0;
          return (
          <button
            key={path.id}
            onClick={() => setActivePathId(path.id)}
            className={`text-left bg-white rounded-2xl border shadow-sm hover:shadow-lg transition-shadow duration-300 p-6 ${
              activePathId === path.id ? "border-brand ring-2 ring-brand/20" : "border-brand-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-brand">{path.name}</h2>
              {pc ? (
                <span className="text-xs font-bold bg-brand-pale text-brand px-3 py-1 rounded-full">{pc.current_rank_name}</span>
              ) : (
                <span className="text-xs font-bold bg-gray-100 text-gray-400 px-3 py-1 rounded-full">Not enrolled</span>
              )}
            </div>
            <p className="text-gray-500 mt-1 text-sm">{path.description || `${path.name} career track`}</p>
            {pc && (
              <div className="mt-3 text-xs text-gray-400">Rank {pc.sort_order} of 4</div>
            )}
          </button>
        )})}
      </div>

      {/* Rank ladder + Progress */}
      {activePathId && pathDetail && (
        <div className="space-y-6">
          {/* Rank Ladder */}
          <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
            <h3 className="text-xl font-bold text-brand mb-6">Rank Progression — {pathDetail.name}</h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0">
              {pathDetail.ranks?.map((rank: any, i: number) => {
                const isCurrent = activeCareer?.current_rank_id === rank.id;
                const isPast = activeCareer && rank.sort_order < (activeCareer.sort_order || 0);
                const acList = rankAircraft[rank.id] || [];
                return (
                  <div key={rank.id} className="flex-1 flex sm:flex-col items-center gap-3 sm:gap-0 relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                      isCurrent ? "bg-brand text-white ring-4 ring-brand/20" :
                      isPast ? "bg-green-500 text-white" :
                      "bg-gray-100 text-gray-400"
                    }`}>
                      {rank.sort_order}
                    </div>
                    <div className="sm:text-center">
                      <p className={`font-bold text-sm ${isCurrent ? "text-brand" : isPast ? "text-green-600" : "text-gray-400"}`}>
                        {rank.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {rank.required_route_pct}% routes · {rank.required_takeoffs} T/O · {rank.required_landings} LDG
                      </p>
                      {acList.length > 0 && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          {acList.map((a: any) => a.aircraft_name).join(", ")}
                        </p>
                      )}
                    </div>
                    {i < (pathDetail.ranks?.length || 0) - 1 && (
                      <div className="hidden sm:block absolute -right-2 top-6 w-4 h-0.5 bg-gray-200" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress detail */}
          {currentProgress && (
            <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
              <h3 className="text-xl font-bold text-brand mb-6">
                {currentProgress.current_rank?.name || "Rank"} Progress
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-500">Route Discovery</p>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-black text-brand">{currentProgress.discovery_pct}%</span>
                    <span className="text-sm text-gray-400 pb-1">of {currentProgress.route_pct_required}% needed</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="bg-gradient-to-r from-brand to-brand-light h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(currentProgress.discovery_pct, 100)}%` }} />
                  </div>
                  <p className="text-sm text-gray-600">
                    {currentProgress.discovered_routes} / {currentProgress.total_routes} routes
                  </p>
                  {currentProgress.route_pct_complete && (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Complete</span>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-500">Takeoffs</p>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-black text-brand">{currentProgress.takeoffs_count}</span>
                    <span className="text-sm text-gray-400 pb-1">/ {currentProgress.takeoffs_required} required</span>
                  </div>
                  {currentProgress.takeoffs_complete && (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Complete</span>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-500">Landings</p>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-black text-brand">{currentProgress.landings_count}</span>
                    <span className="text-sm text-gray-400 pb-1">/ {currentProgress.landings_required} required</span>
                  </div>
                  {currentProgress.landings_complete && (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Complete</span>
                  )}
                </div>
              </div>

              {currentProgress.can_promote && (
                <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 font-semibold text-sm">
                  Ready for promotion to {currentProgress.next_rank?.name || "next rank"}!
                </div>
              )}

              {currentProgress.next_rank && (
                <div className="mt-6 pt-6 border-t border-brand-border">
                  <p className="text-sm font-semibold text-gray-500 mb-1">Next Rank: <span className="text-brand">{currentProgress.next_rank.name}</span></p>
                  <p className="text-sm text-gray-600">{currentProgress.next_rank.required_route_pct}% routes · {currentProgress.next_rank.required_takeoffs} T/O · {currentProgress.next_rank.required_landings} LDG</p>
                </div>
              )}
            </div>
          )}

          {/* Aircraft qualifications */}
          {pathDetail.ranks && (
            <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
              <h3 className="text-xl font-bold text-brand mb-4">Aircraft Qualifications</h3>
              <div className="space-y-3">
                {pathDetail.ranks.map((rank: any) => {
                  const acList = rankAircraft[rank.id] || [];
                  const isUnlocked = activeCareer && rank.sort_order <= (activeCareer.sort_order || 0);
                  return (
                    <div key={rank.id} className={`flex items-center justify-between py-2 px-4 rounded-xl border ${isUnlocked ? "border-green-200 bg-green-50/50" : "border-brand-border bg-gray-50"}`}>
                      <div>
                        <p className={`font-semibold text-sm ${isUnlocked ? "text-green-700" : "text-gray-400"}`}>
                          {rank.name}
                        </p>
                        <p className="text-xs text-gray-400">{isUnlocked ? "Unlocked" : "Locked"}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {acList.length > 0 ? acList.map((a: any) => {
                          const t = types.find(ty => ty.id === a.aircraft_type_id);
                          return (
                            <span key={a.id} className={`text-xs px-2 py-0.5 rounded-full ${isUnlocked ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                              {t?.name || `Type #${a.aircraft_type_id}`} ×{a.count}
                            </span>
                          );
                        }) : <span className="text-xs text-gray-300">No types assigned</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
