import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchGroupDetail } from "../store/slices/groupSlice";

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { currentGroup, loading } = useAppSelector((s) => s.group);

  useEffect(() => {
    if (id) dispatch(fetchGroupDetail(Number(id)));
  }, [id]);

  if (!currentGroup) {
    return <div className="max-w-6xl mx-auto px-6 py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link to="/groups" className="text-sm text-[--color-brand] hover:underline mb-4 inline-block">&larr; Back to Groups</Link>
      <h1 className="text-5xl font-bold text-[--color-brand] mb-2">{currentGroup.name}</h1>
      <p className="text-gray-500 mb-8">
        {currentGroup.period_start} &mdash; {currentGroup.period_end}
        {currentGroup.discord_channel_id && (
          <span className="ml-4 text-[--color-brand]">Discord: #{currentGroup.discord_channel_id}</span>
        )}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members */}
        <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm p-6">
          <h2 className="text-xl font-bold text-[--color-brand] mb-4">Members ({currentGroup.members.length})</h2>
          <div className="space-y-2">
            {currentGroup.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-[--color-brand-border] last:border-0">
                <div>
                  <p className="font-semibold text-gray-800">{m.pilot_callsign || `Pilot #${m.pilot_id}`}</p>
                  <p className="text-xs text-gray-400">{m.pilot_name}</p>
                </div>
                {m.is_group_admin && (
                  <span className="text-xs font-bold bg-[--color-brand-pale] text-[--color-brand] px-2 py-0.5 rounded-full">Admin</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Aircraft */}
        <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm p-6">
          <h2 className="text-xl font-bold text-[--color-brand] mb-4">Aircraft ({currentGroup.aircraft.length})</h2>
          <div className="space-y-3">
            {currentGroup.aircraft.map((a) => (
              <Link
                key={a.id}
                to={`/fleet/${a.aircraft_id}`}
                className="flex items-center justify-between py-2 px-3 rounded-xl border border-[--color-brand-border] hover:border-[--color-brand] transition-colors"
              >
                <div>
                  <p className="font-semibold text-gray-800">{a.registration}</p>
                  <p className="text-xs text-gray-400">{a.aircraft_type_name} &middot; {a.current_airport}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  a.status === "parked" ? "bg-green-100 text-green-700" :
                  a.status === "flying" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {a.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
