import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  fetchGroupDetail,
  assignPilots,
  assignAircraft,
  removePilot,
  removeAircraft,
  toggleAdmin,
} from "../store/slices/groupSlice";
import { fetchPilots } from "../store/slices/pilotSlice";
import { fetchAirframes } from "../store/slices/aircraftSlice";
import { useAppSelector as useAuth } from "../store/hooks";

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { currentGroup } = useAppSelector((s) => s.group);
  const { pilots } = useAppSelector((s) => s.pilot);
  const { airframes } = useAppSelector((s) => s.aircraft);
  const user = useAuth((s) => s.auth.user);

  const [showAddPilots, setShowAddPilots] = useState(false);
  const [showAddAircraft, setShowAddAircraft] = useState(false);
  const [selectedPilots, setSelectedPilots] = useState<number[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<number[]>([]);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);

  useEffect(() => {
    if (id) dispatch(fetchGroupDetail(Number(id)));
    dispatch(fetchPilots({}));
    dispatch(fetchAirframes());
  }, [id]);

  if (!currentGroup) {
    return <div className="max-w-6xl mx-auto px-6 py-8 text-gray-500">Loading...</div>;
  }

  const refresh = () => { if (id) dispatch(fetchGroupDetail(Number(id))); };

  const handleAssignPilots = async () => {
    if (!id || selectedPilots.length === 0) return;
    await dispatch(assignPilots({ groupId: Number(id), pilotIds: selectedPilots, isGroupAdmin }));
    setSelectedPilots([]);
    setShowAddPilots(false);
    refresh();
  };

  const handleAssignAircraft = async () => {
    if (!id || selectedAircraft.length === 0) return;
    await dispatch(assignAircraft({ groupId: Number(id), aircraftIds: selectedAircraft }));
    setSelectedAircraft([]);
    setShowAddAircraft(false);
    refresh();
  };

  const assignedPilotIds = currentGroup.members.map((m: any) => m.pilot_id);
  const assignedAircraftIds = currentGroup.aircraft.map((a: any) => a.aircraft_id);
  const availablePilots = pilots.filter(p => !assignedPilotIds.includes(p.id));
  const availableAircraft = airframes.filter(a => !assignedAircraftIds.includes(a.id));

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link to="/groups" className="text-sm text-brand hover:underline mb-4 inline-block">&larr; Back to Groups</Link>
      <h1 className="text-5xl font-bold text-brand mb-2">{currentGroup.name}</h1>
      <p className="text-gray-500 mb-8">
        {currentGroup.period_start} &mdash; {currentGroup.period_end}
        {currentGroup.discord_channel_id && <span className="ml-4 text-brand">Discord: #{currentGroup.discord_channel_id}</span>}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members */}
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-brand">Members ({currentGroup.members.length})</h2>
            {(
              <button onClick={() => setShowAddPilots(!showAddPilots)} className="text-xs rounded-full bg-brand text-white px-3 py-1 hover:bg-brand-light transition-colors">
                + Add
              </button>
            )}
          </div>

          {showAddPilots && (
            <div className="mb-4 p-3 bg-brand-pale rounded-xl">
              <select
                multiple
                value={selectedPilots.map(String)}
                onChange={e => setSelectedPilots(Array.from(e.target.selectedOptions, o => Number(o.value)))}
                className="w-full border border-brand-border rounded-lg p-2 text-sm h-32"
              >
                {availablePilots.map(p => (
                  <option key={p.id} value={p.id}>{p.callsign} — {p.name}</option>
                ))}
              </select>
              <div className="flex gap-2 mt-2">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={isGroupAdmin} onChange={e => setIsGroupAdmin(e.target.checked)} />
                  Group Admin
                </label>
                <button onClick={handleAssignPilots} className="text-xs bg-brand text-white px-3 py-1 rounded-full">Assign</button>
                <button onClick={() => setShowAddPilots(false)} className="text-xs text-gray-500">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {currentGroup.members.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-brand-border last:border-0">
                <div>
                  <p className="font-semibold text-gray-800">{m.pilot_callsign || `Pilot #${m.pilot_id}`}</p>
                  <p className="text-xs text-gray-400">{m.pilot_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {m.is_group_admin && <span className="text-xs font-bold bg-brand-pale text-brand px-2 py-0.5 rounded-full">Admin</span>}
                  {(
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          dispatch(toggleAdmin({ groupId: Number(id), pilotId: m.pilot_id, isGroupAdmin: !m.is_group_admin }));
                          refresh();
                        }}
                        className="text-xs text-gray-400 hover:text-brand"
                        title={m.is_group_admin ? "Remove admin" : "Make admin"}
                      >
                        {m.is_group_admin ? "↓" : "↑"}
                      </button>
                      <button
                        onClick={async () => {
                          await dispatch(removePilot({ groupId: Number(id), pilotId: m.pilot_id }));
                          refresh();
                        }}
                        className="text-xs text-red-400 hover:text-red-600"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Aircraft */}
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-brand">Aircraft ({currentGroup.aircraft.length})</h2>
            {(
              <button onClick={() => setShowAddAircraft(!showAddAircraft)} className="text-xs rounded-full bg-brand text-white px-3 py-1 hover:bg-brand-light transition-colors">
                + Add
              </button>
            )}
          </div>

          {showAddAircraft && (
            <div className="mb-4 p-3 bg-brand-pale rounded-xl">
              <select
                multiple
                value={selectedAircraft.map(String)}
                onChange={e => setSelectedAircraft(Array.from(e.target.selectedOptions, o => Number(o.value)))}
                className="w-full border border-brand-border rounded-lg p-2 text-sm h-32"
              >
                {availableAircraft.map(a => (
                  <option key={a.id} value={a.id}>{a.registration} — {a.aircraft_type_name} ({a.current_airport})</option>
                ))}
              </select>
              <div className="flex gap-2 mt-2">
                <button onClick={handleAssignAircraft} className="text-xs bg-brand text-white px-3 py-1 rounded-full">Assign</button>
                <button onClick={() => setShowAddAircraft(false)} className="text-xs text-gray-500">Cancel</button>
              </div>
            </div>
          )}

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
                  {(
                    <button
                      onClick={async () => {
                        await dispatch(removeAircraft({ groupId: Number(id), aircraftId: a.aircraft_id }));
                        refresh();
                      }}
                      className="text-xs text-red-400 hover:text-red-600"
                      title="Remove"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
