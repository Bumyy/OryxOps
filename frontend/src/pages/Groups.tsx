import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchGroups } from "../store/slices/groupSlice";

export default function Groups() {
  const dispatch = useAppDispatch();
  const { groups, loading } = useAppSelector((s) => s.group);

  useEffect(() => {
    dispatch(fetchGroups());
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-brand mb-8">Flying Groups</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {groups.map((group) => (
          <a
            key={group.id}
            href={`/groups/${group.id}`}
            onClick={(e) => { e.preventDefault(); window.location.href = `/groups/${group.id}`; }}
            className="cursor-pointer bg-white rounded-2xl border border-brand-border shadow-sm hover:shadow-lg transition-shadow duration-300 p-6 no-underline"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold text-brand">
                {group.name}
              </h3>
              {group.is_active ? (
                <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
              ) : (
                <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
              )}
            </div>

            <div className="mt-4 flex gap-4 text-sm text-gray-500">
              <span>{group.member_count} pilots</span>
              <span>{group.aircraft_count} aircraft</span>
            </div>

            <div className="mt-3 text-xs text-gray-400">
              {group.period_start} &mdash; {group.period_end}
            </div>
          </a>
        ))}
      </div>

      {groups.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No groups yet.</p>
          <p className="text-sm mt-2">Staff can create groups in the Admin panel.</p>
        </div>
      )}
    </div>
  );
}
