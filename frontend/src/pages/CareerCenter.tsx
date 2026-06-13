import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  fetchCareerPaths,
  fetchPilotCareers,
  fetchCareerProgress,
} from "../store/slices/careerSlice";
import { useAppSelector as useAuth } from "../store/hooks";

export default function CareerCenter() {
  const dispatch = useAppDispatch();
  const { paths, pilotCareers, progress } = useAppSelector((s) => s.career);
  const user = useAuth((s) => s.auth.user);
  const [activePathId, setActivePathId] = useState<number | null>(null);

  useEffect(() => {
    dispatch(fetchCareerPaths());
    if (user) {
      dispatch(fetchPilotCareers(user.id));
    }
  }, []);

  useEffect(() => {
    if (activePathId && user) {
      dispatch(fetchCareerProgress({ pilotId: user.id, pathId: activePathId }));
    }
  }, [activePathId, user]);

  const progressKey = user && activePathId ? `${user.id}_${activePathId}` : null;
  const currentProgress = progressKey ? progress[progressKey] : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-[--color-brand] mb-8">Career Center</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {paths.map((path) => (
          <button
            key={path.id}
            onClick={() => setActivePathId(path.id)}
            className={`text-left bg-white rounded-2xl border shadow-sm hover:shadow-lg transition-shadow duration-300 p-6 ${
              activePathId === path.id
                ? "border-[--color-brand] ring-2 ring-[--color-brand]/20"
                : "border-[--color-brand-border]"
            }`}
          >
            <h2 className="text-2xl font-bold text-[--color-brand]">{path.name}</h2>
            <p className="text-gray-500 mt-1">{path.description || `${path.name} career track`}</p>

            {/* Current rank */}
            {pilotCareers
              .filter((pc) => pc.career_path_id === path.id)
              .map((pc) => (
                <div key={pc.id} className="mt-4 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider bg-[--color-brand-pale] text-[--color-brand] px-3 py-1 rounded-full">
                    {pc.current_rank_name}
                  </span>
                  <span className="text-xs text-gray-400">Rank {pc.sort_order}/4</span>
                </div>
              ))}
          </button>
        ))}
      </div>

      {/* Progress Detail */}
      {currentProgress && (
        <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm p-6">
          <h3 className="text-2xl font-bold text-[--color-brand] mb-6">
            {currentProgress.current_rank?.name || "Rank"} Progress
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-500">Route Discovery</p>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-[--color-brand] to-[--color-brand-light] h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(currentProgress.discovery_pct, 100)}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {currentProgress.discovered_routes} / {currentProgress.total_routes} routes ({currentProgress.discovery_pct}%)
                <span className="text-xs text-gray-400 ml-2">({currentProgress.route_pct_required}% required)</span>
              </p>
              {currentProgress.route_pct_complete && (
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Complete</span>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-500">Takeoffs</p>
              <p className="text-2xl font-bold text-[--color-brand]">
                {currentProgress.takeoffs_count} <span className="text-sm font-normal text-gray-400">/ {currentProgress.takeoffs_required}</span>
              </p>
              {currentProgress.takeoffs_complete && (
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Complete</span>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-500">Landings</p>
              <p className="text-2xl font-bold text-[--color-brand]">
                {currentProgress.landings_count} <span className="text-sm font-normal text-gray-400">/ {currentProgress.landings_required}</span>
              </p>
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
            <div className="mt-6 pt-6 border-t border-[--color-brand-border]">
              <p className="text-sm font-semibold text-gray-500 mb-2">Next Rank: {currentProgress.next_rank.name}</p>
              <p className="text-sm text-gray-600">Requires {currentProgress.next_rank.required_route_pct}% route discovery, {currentProgress.next_rank.required_takeoffs} takeoffs, {currentProgress.next_rank.required_landings} landings</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
