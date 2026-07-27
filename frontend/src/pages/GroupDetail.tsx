import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchGroupDetail } from "../store/slices/groupSlice";

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { currentGroup } = useAppSelector((s) => s.group);

  useEffect(() => {
    if (id) dispatch(fetchGroupDetail(Number(id)));
  }, [id]);

  if (!currentGroup) {
    return <div className="max-w-6xl mx-auto px-6 py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link to="/groups" className="text-sm text-brand hover:underline mb-4 inline-block">&larr; Back to Groups</Link>
      <h1 className="text-5xl font-bold text-brand mb-2">{currentGroup.name}</h1>
      <p className="text-gray-500 mb-6">
        {currentGroup.period_start} &mdash; {currentGroup.period_end}
        {currentGroup.discord_channel_id && <span className="ml-4 text-brand">Discord: #{currentGroup.discord_channel_id}</span>}
      </p>

      {/* Group Capacity Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-brand-border p-4 shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase">Assigned Aircraft</div>
          <div className="text-2xl font-extrabold text-brand mt-1">{currentGroup.aircraft_count}</div>
          <div className="text-[10px] text-gray-400 mt-1">Active fleet in group</div>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border p-4 shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase">Max Pilot Capacity</div>
          <div className="text-2xl font-extrabold text-blue-600 mt-1">
            {currentGroup.max_slots || (2 + (currentGroup.aircraft_count * 2))}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Formula: 2 + ({currentGroup.aircraft_count} × 2)</div>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border p-4 shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase">Active Pilots</div>
          <div className="text-2xl font-extrabold text-gray-800 mt-1">{currentGroup.member_count}</div>
          <div className="text-[10px] text-gray-400 mt-1">Current members</div>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border p-4 shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase">Available Slots</div>
          <div className={`text-2xl font-extrabold mt-1 ${currentGroup.is_full ? 'text-rose-600' : 'text-emerald-600'}`}>
            {currentGroup.is_full ? 'FULL (0)' : currentGroup.available_slots}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {currentGroup.is_full ? 'Capacity ceiling reached' : 'Open pilot slots'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members */}
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-brand">Members ({currentGroup.members.length})</h2>
          </div>

          <div className="space-y-2">
            {currentGroup.members.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-brand-border last:border-0">
                <div>
                  <p className="font-semibold text-gray-800">{m.pilot_callsign || `Pilot #${m.pilot_id}`}</p>
                  <p className="text-xs text-gray-400">{m.pilot_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {m.is_group_admin && <span className="text-xs font-bold bg-brand-pale text-brand px-2 py-0.5 rounded-full">Admin</span>}
                </div>
              </div>
            ))}
            {currentGroup.members.length === 0 && (
              <p className="text-sm text-gray-400 py-4">No members assigned to this group.</p>
            )}
          </div>
        </div>

        {/* Aircraft */}
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-brand">Aircraft ({currentGroup.aircraft.length})</h2>
          </div>

          <div className="space-y-3">
            {currentGroup.aircraft.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-xl border border-brand-border">
                <div>
                  <p className="font-semibold text-gray-800">{a.registration}</p>
                  <p className="text-xs text-gray-400">{a.aircraft_type_name} &middot; {a.current_airport}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    a.status === "parked" ? "bg-green-100 text-green-700" :
                    a.status === "flying" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>{a.status}</span>
                </div>
              </div>
            ))}
            {currentGroup.aircraft.length === 0 && (
              <p className="text-sm text-gray-400 py-4">No aircraft assigned to this group.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
