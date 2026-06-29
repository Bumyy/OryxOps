import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  fetchSettings, updateSetting, promotePilot,
  enrollPilot, fetchEnrolledPilots, reshuffleGroup,
} from "../store/slices/adminSlice";
import { fetchGroups, createGroup, updateGroup } from "../store/slices/groupSlice";
import { fetchPilots } from "../store/slices/pilotSlice";
import { fetchAirframes, fetchAircraftTypes, createAirframe, updateAirframe } from "../store/slices/aircraftSlice";
import { fetchTransfers, reviewTransfer } from "../store/slices/transferSlice";
import {
  fetchCareerPaths, fetchCareerPathDetail, createCareerPath, deleteCareerPath,
  createRank, updateRank, deleteRank, fetchRankAircraft, assignAircraftToRank, removeAircraftFromRank,
} from "../store/slices/careerSlice";
import { fetchWaves, createWave, deleteWave } from "../store/slices/scheduleSlice";

type Tab = "pilots" | "groups" | "aircraft" | "careers" | "transfers" | "waves" | "settings";

export default function Admin() {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector((s) => s.admin);
  const { groups } = useAppSelector((s) => s.group);
  const { pilots } = useAppSelector((s) => s.pilot);
  const { airframes, types } = useAppSelector((s) => s.aircraft);
  const { transfers } = useAppSelector((s) => s.transfer);
  const [tab, setTab] = useState<Tab>("pilots");

  const tabs: { key: Tab; label: string }[] = [
    { key: "pilots", label: "Pilots" },
    { key: "groups", label: "Groups" },
    { key: "aircraft", label: "Aircraft" },
    { key: "careers", label: "Careers" },
    { key: "transfers", label: "Transfers" },
    { key: "waves", label: "Waves" },
    { key: "settings", label: "Settings" },
  ];

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && tabs.some(t => t.key === hash)) setTab(hash as Tab);
    const onHash = () => {
      const h = window.location.hash.replace("#", "");
      if (h && tabs.some(t => t.key === h)) setTab(h as Tab);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    dispatch(fetchSettings());
    dispatch(fetchGroups());
    dispatch(fetchPilots({}));
    dispatch(fetchAirframes());
    dispatch(fetchAircraftTypes());
    dispatch(fetchTransfers());
    dispatch(fetchCareerPaths());
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-brand mb-8">Admin Panel</h1>

      <div className="flex gap-1 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); window.location.hash = t.key; }}
            className={`rounded-full text-xs font-bold border px-4 py-1.5 transition-colors duration-200 ${
              tab === t.key
                ? "bg-brand text-white border-brand"
                : "border-brand-border text-gray-500 hover:bg-brand-hover-bg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pilots" && <PilotsTab />}
      {tab === "groups" && <GroupsTab />}
      {tab === "aircraft" && <AircraftTab />}
      {tab === "careers" && <CareersTab />}
      {tab === "transfers" && <TransfersTab />}
      {tab === "waves" && <WavesTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

export function PilotsTab() {
  const dispatch = useAppDispatch();
  const { enrolled, unenrolled } = useAppSelector((s) => s.admin);
  const { paths } = useAppSelector((s) => s.career);
  const [careerPathId, setCareerPathId] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    dispatch(fetchEnrolledPilots());
  }, []);

  useEffect(() => {
    if (paths.length > 0 && careerPathId === 0) {
      setCareerPathId(paths[0].id);
    }
  }, [paths]);

  const handleEnroll = async (pilotId: number) => {
    const res = await dispatch(enrollPilot({ pilot_id: pilotId, career_path_id: careerPathId }));
    if (enrollPilot.fulfilled.match(res)) {
      alert("Pilot enrolled successfully!");
      dispatch(fetchEnrolledPilots());
    } else {
      alert("Failed to enroll pilot: " + (res.error?.message || "Unknown error"));
    }
  };

  const handlePromote = async (pilotId: number, pathId: number) => {
    const res = await dispatch(promotePilot({ pilotId, careerPathId: pathId }));
    if (promotePilot.fulfilled.match(res)) {
      alert("Pilot promoted successfully!");
      dispatch(fetchEnrolledPilots());
    } else {
      alert("Failed to promote pilot: " + (res.error?.message || "Unknown error"));
    }
  };

  const filterPilots = (list: any[]) => {
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase();
    return list.filter(
      (p) =>
        p.callsign?.toLowerCase().includes(query) ||
        p.name?.toLowerCase().includes(query)
    );
  };

  const filteredUnenrolled = filterPilots(unenrolled);
  const filteredEnrolled = filterPilots(enrolled);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-brand">Enroll Pilot</h2>
            <select
              value={careerPathId}
              onChange={(e) => setCareerPathId(Number(e.target.value))}
              className="border border-brand-border rounded-xl px-3 py-1.5 text-xs"
            >
              {paths.map(p => (
                <option key={p.id} value={p.id}>{p.name} Path</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Search pilots by callsign or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-brand-border rounded-xl px-4 py-2 text-xs w-full sm:w-64"
          />
        </div>

        {filteredUnenrolled.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">Not Enrolled ({filteredUnenrolled.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredUnenrolled.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-brand-pale rounded-xl border border-brand-border">
                  <div>
                    <p className="font-semibold text-sm">{p.callsign}</p>
                    <p className="text-xs text-gray-400">{p.name}</p>
                  </div>
                  <button
                    onClick={() => handleEnroll(p.id)}
                    className="text-xs rounded-full bg-brand text-white px-3 py-1 hover:bg-brand-light transition-colors"
                  >
                    Enroll
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Enrolled ({filteredEnrolled.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredEnrolled.map((p) => (
              <div key={p.id} className="flex flex-col p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{p.callsign}</p>
                    <p className="text-xs text-gray-400">{p.name}</p>
                  </div>
                  <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Active</span>
                </div>
                
                {p.careers && p.careers.length > 0 && (
                  <div className="space-y-2 mt-2 pt-2 border-t border-green-200/50">
                    {p.careers.map((c: any) => (
                      <div key={c.career_path_id} className="flex items-center justify-between text-xs text-brand-light">
                        <div className="truncate flex-1">
                          <span className="font-semibold">{c.career_path_name}:</span> {c.current_rank_name}
                        </div>
                        <button
                          onClick={() => handlePromote(p.id, c.career_path_id)}
                          className="text-[10px] bg-brand text-white font-semibold px-2 py-1 rounded-full hover:bg-brand-light transition-colors ml-2 flex-shrink-0"
                        >
                          Promote
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {filteredEnrolled.length === 0 && (
            <p className="text-sm text-gray-400 py-4">No matching enrolled pilots found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── GROUPS TAB ─── */

export function GroupsTab() {
  const dispatch = useAppDispatch();
  const { groups } = useAppSelector((s) => s.group);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [editId, setEditId] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!name || !periodStart || !periodEnd) return;
    await dispatch(createGroup({ name, discord_channel_id: discordId || null, period_start: periodStart, period_end: periodEnd }));
    setName(""); setDiscordId(""); setPeriodStart(""); setPeriodEnd("");
    setShowCreate(false);
    dispatch(fetchGroups());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-brand">Flying Groups</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="rounded-full bg-gradient-to-br from-brand-dark to-brand text-white font-semibold text-sm px-5 py-2 hover:-translate-y-0.5 hover:shadow-lg transition-all">
          + New Group
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <h3 className="text-lg font-bold text-brand mb-4">Create Group</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <input placeholder="Group Name" value={name} onChange={e => setName(e.target.value)} className="border border-brand-border rounded-xl px-4 py-2.5 text-sm" />
            <input placeholder="Discord Channel ID" value={discordId} onChange={e => setDiscordId(e.target.value)} className="border border-brand-border rounded-xl px-4 py-2.5 text-sm" />
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="border border-brand-border rounded-xl px-4 py-2.5 text-sm" />
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="border border-brand-border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <button onClick={handleCreate} className="rounded-full bg-brand text-white font-semibold text-sm px-5 py-2">Create</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((g) => (
          <div key={g.id} className="bg-white rounded-2xl border border-brand-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-brand">{g.name}</h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${g.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {g.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>{g.member_count} pilots · {g.aircraft_count} aircraft</p>
              <p>{g.period_start} → {g.period_end}</p>
              {g.discord_channel_id && <p>Discord: #{g.discord_channel_id}</p>}
            </div>
            <div className="mt-3 flex gap-2 flex-wrap items-center">
              <button onClick={() => setEditId(g.id)} className="text-xs text-brand hover:underline">Rename</button>
              {editId === g.id && (
                <input
                  defaultValue={g.name}
                  onBlur={async (e) => {
                    if (e.target.value !== g.name) {
                      await dispatch(updateGroup({ id: g.id, data: { name: e.target.value } }));
                      dispatch(fetchGroups());
                    }
                    setEditId(null);
                  }}
                  className="border border-brand-border rounded-lg px-2 py-1 text-xs flex-1"
                  autoFocus
                />
              )}
              {g.is_active && (
                <button
                  onClick={async () => {
                    if (confirm(`Are you sure you want to reshuffle ${g.name}?`)) {
                      const res = await dispatch(reshuffleGroup(g.id));
                      if (reshuffleGroup.fulfilled.match(res)) {
                        alert("Group reshuffled successfully!");
                        dispatch(fetchGroups());
                      } else {
                        alert("Failed to reshuffle group: " + (res.error?.message || "Unknown error"));
                      }
                    }
                  }}
                  className="text-xs rounded-full bg-orange-500 text-white px-2 py-0.5 hover:bg-orange-600 transition-colors"
                  title="Create new group period with same members/aircraft"
                >
                  Reshuffle
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── AIRCRAFT TAB ─── */

export function AircraftTab() {
  const dispatch = useAppDispatch();
  const { airframes, types } = useAppSelector((s) => s.aircraft);
  const [showCreate, setShowCreate] = useState(false);
  const [reg, setReg] = useState("");
  const [typeId, setTypeId] = useState(0);
  const [airport, setAirport] = useState("OTHH");
  const [editStatus, setEditStatus] = useState<Record<number, string>>({});

  const handleCreate = async () => {
    if (!reg || !typeId) return;
    await dispatch(createAirframe({ aircraft_type_id: typeId, registration: reg, current_airport: airport, home_base: airport }));
    setReg(""); setTypeId(0); setAirport("OTHH"); setShowCreate(false);
    dispatch(fetchAirframes());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-brand">Fleet Management</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="rounded-full bg-gradient-to-br from-brand-dark to-brand text-white font-semibold text-sm px-5 py-2 hover:-translate-y-0.5 hover:shadow-lg transition-all">+ Add Airframe</button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <h3 className="text-lg font-bold text-brand mb-4">Add Airframe</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <input placeholder="Registration (e.g. A7-BAA)" value={reg} onChange={e => setReg(e.target.value)} className="border border-brand-border rounded-xl px-4 py-2.5 text-sm" />
            <select value={typeId} onChange={e => setTypeId(Number(e.target.value))} className="border border-brand-border rounded-xl px-4 py-2.5 text-sm">
              <option value={0}>Aircraft Type</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name} ({t.icao})</option>)}
            </select>
            <input placeholder="Delivery Airport" value={airport} onChange={e => setAirport(e.target.value)} className="border border-brand-border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <button onClick={handleCreate} className="rounded-full bg-brand text-white font-semibold text-sm px-5 py-2">Create</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-pale text-left">
              <tr>
                <th className="px-5 py-3 font-semibold text-gray-600">Registration</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Type</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Location</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Hours</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {airframes.map((a) => (
                <tr key={a.id} className="border-t border-brand-border">
                  <td className="px-5 py-3 font-semibold">{a.registration}</td>
                  <td className="px-5 py-3 text-xs">{a.aircraft_type_name}</td>
                  <td className="px-5 py-3">{a.current_airport}</td>
                  <td className="px-5 py-3">
                    <select
                      value={editStatus[a.id] ?? a.status}
                      onChange={async (e) => {
                        setEditStatus({ ...editStatus, [a.id]: e.target.value });
                        await dispatch(updateAirframe({ id: a.id, data: { status: e.target.value } }));
                        dispatch(fetchAirframes());
                      }}
                      className="text-xs border border-brand-border rounded-lg px-2 py-1"
                    >
                      <option value="parked">Parked</option>
                      <option value="flying">Flying</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="in_hangar">In Hangar</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">{a.total_flight_hours}h</td>
                  <td className="px-5 py-3">
                    <input
                      placeholder="Move to ICAO"
                      onBlur={async (e) => {
                        if (e.target.value && e.target.value.length === 4) {
                          await dispatch(updateAirframe({ id: a.id, data: { current_airport: e.target.value.toUpperCase() } }));
                          dispatch(fetchAirframes());
                          e.target.value = "";
                        }
                      }}
                      className="text-xs border border-brand-border rounded-lg px-2 py-1 w-20"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



/* ─── CAREERS TAB ─── */

export function CareersTab() {
  const dispatch = useAppDispatch();
  const { paths } = useAppSelector((s) => s.career);
  const { pilots } = useAppSelector((s) => s.pilot);
  const { types } = useAppSelector((s) => s.aircraft);
  const [activePathId, setActivePathId] = useState<number | null>(null);
  const [pathDetail, setPathDetail] = useState<any>(null);
  const [rankAircraft, setRankAircraft] = useState<Record<number, any[]>>({});

  // ── Path CRUD state
  const [showCreatePath, setShowCreatePath] = useState(false);
  const [newPathName, setNewPathName] = useState("");
  const [newPathDesc, setNewPathDesc] = useState("");

  // ── Rank CRUD state
  const [showCreateRank, setShowCreateRank] = useState(false);
  const [newRankName, setNewRankName] = useState("");
  const [newRankOrder, setNewRankOrder] = useState(1);
  const [newRankPct, setNewRankPct] = useState(0);
  const [newRankTakeoffs, setNewRankTakeoffs] = useState(0);
  const [newRankLandings, setNewRankLandings] = useState(0);

  // ── Aircraft assign state
  const [assignAcRankId, setAssignAcRankId] = useState<number | null>(null);
  const [assignAcTypeId, setAssignAcTypeId] = useState(0);
  const [editRankId, setEditRankId] = useState<number | null>(null);

  // ── Promote state
  const [promotePilotId, setPromotePilotId] = useState(0);
  const [promotePathId, setPromotePathId] = useState(0);

  useEffect(() => {
    dispatch(fetchCareerPaths());
    dispatch(fetchAircraftTypes());
  }, []);

  const loadPath = async (pathId: number) => {
    setActivePathId(pathId);
    const detail: any = await dispatch(fetchCareerPathDetail(pathId)).unwrap();
    setPathDetail(detail);
    if (detail?.ranks) {
      for (const rank of detail.ranks) {
        const ac: any = await dispatch(fetchRankAircraft(rank.id)).unwrap();
        setRankAircraft(prev => ({ ...prev, [rank.id]: ac || [] }));
      }
    }
  };

  const refreshPath = () => { if (activePathId) loadPath(activePathId); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-brand">Career Management</h2>
        <button onClick={() => setShowCreatePath(!showCreatePath)} className="rounded-full bg-gradient-to-br from-brand-dark to-brand text-white font-semibold text-sm px-5 py-2 hover:-translate-y-0.5 hover:shadow-lg transition-all">+ New Path</button>
      </div>

      {/* Create Path */}
      {showCreatePath && (
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <h3 className="text-lg font-bold text-brand mb-4">Create Career Path</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <input placeholder="Name (e.g. Airbus)" value={newPathName} onChange={e => setNewPathName(e.target.value)} className="border border-brand-border rounded-xl px-4 py-2.5 text-sm" />
            <input placeholder="Description" value={newPathDesc} onChange={e => setNewPathDesc(e.target.value)} className="border border-brand-border rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <button onClick={async () => {
            await dispatch(createCareerPath({ name: newPathName, description: newPathDesc || null }));
            setNewPathName(""); setNewPathDesc(""); setShowCreatePath(false);
            dispatch(fetchCareerPaths());
          }} className="rounded-full bg-brand text-white font-semibold text-sm px-5 py-2">Create</button>
        </div>
      )}

      {/* Path List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {paths.map(p => (
          <button
            key={p.id}
            onClick={() => loadPath(p.id)}
            className={`text-left bg-white rounded-2xl border shadow-sm p-5 transition-all ${activePathId === p.id ? "border-brand ring-2 ring-brand/20" : "border-brand-border hover:shadow-lg"}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-brand text-lg">{p.name}</h3>
              <span className="text-xs text-gray-400">ID: {p.id}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{p.description || "No description"}</p>
            {p.is_active ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-2 inline-block">Active</span> : <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full mt-2 inline-block">Inactive</span>}
          </button>
        ))}
      </div>

      {/* Path Detail with Ranks */}
      {pathDetail && (
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-brand">{pathDetail.name} — Ranks</h3>
            <button onClick={() => setShowCreateRank(!showCreateRank)} className="text-xs rounded-full bg-brand text-white px-3 py-1 hover:bg-brand-light transition-colors">+ Add Rank</button>
          </div>

          {/* Create Rank Form */}
          {showCreateRank && activePathId && (
            <div className="mb-4 p-4 bg-brand-pale rounded-xl border border-brand-border">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <input placeholder="Rank Name" value={newRankName} onChange={e => setNewRankName(e.target.value)} className="border border-brand-border rounded-lg px-3 py-2 text-sm" />
                <input type="number" placeholder="Sort Order" value={newRankOrder} onChange={e => setNewRankOrder(Number(e.target.value))} className="border border-brand-border rounded-lg px-3 py-2 text-sm" />
                <input type="number" placeholder="Route % Required" value={newRankPct} onChange={e => setNewRankPct(Number(e.target.value))} className="border border-brand-border rounded-lg px-3 py-2 text-sm" />
                <input type="number" placeholder="Takeoffs Required" value={newRankTakeoffs} onChange={e => setNewRankTakeoffs(Number(e.target.value))} className="border border-brand-border rounded-lg px-3 py-2 text-sm" />
                <input type="number" placeholder="Landings Required" value={newRankLandings} onChange={e => setNewRankLandings(Number(e.target.value))} className="border border-brand-border rounded-lg px-3 py-2 text-sm" />
              </div>
              <button onClick={async () => {
                await dispatch(createRank({ pathId: activePathId, data: { name: newRankName, sort_order: newRankOrder, required_route_pct: newRankPct, required_takeoffs: newRankTakeoffs, required_landings: newRankLandings } }));
                setNewRankName(""); setShowCreateRank(false);
                refreshPath();
              }} className="text-xs bg-brand text-white px-4 py-1.5 rounded-full">Save Rank</button>
            </div>
          )}

          {/* Ranks Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-pale text-left">
                <tr>
                  <th className="px-4 py-2 font-semibold text-gray-600">#</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">Route %</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">T/O</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">LDG</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">Aircraft</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pathDetail.ranks?.map((rank: any) => (
                  <tr key={rank.id} className="border-t border-brand-border">
                    <td className="px-4 py-2 text-gray-400">{rank.sort_order}</td>
                    <td className="px-4 py-2 font-semibold">
                      {editRankId === rank.id ? (
                        <input
                          defaultValue={rank.name}
                          onBlur={async (e) => {
                            await dispatch(updateRank({ rankId: rank.id, data: { name: e.target.value } }));
                            setEditRankId(null);
                            refreshPath();
                          }}
                          className="border border-brand-border rounded-lg px-2 py-1 text-sm w-36"
                          autoFocus
                        />
                      ) : (
                        <span className="cursor-pointer" onClick={() => setEditRankId(rank.id)}>{rank.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        defaultValue={rank.required_route_pct}
                        onBlur={async (e) => {
                          const v = Number(e.target.value);
                          if (v !== rank.required_route_pct) {
                            await dispatch(updateRank({ rankId: rank.id, data: { required_route_pct: v } }));
                            refreshPath();
                          }
                        }}
                        className="border border-brand-border rounded-lg px-2 py-1 text-sm w-16"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        defaultValue={rank.required_takeoffs}
                        onBlur={async (e) => {
                          const v = Number(e.target.value);
                          if (v !== rank.required_takeoffs) {
                            await dispatch(updateRank({ rankId: rank.id, data: { required_takeoffs: v } }));
                            refreshPath();
                          }
                        }}
                        className="border border-brand-border rounded-lg px-2 py-1 text-sm w-16"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        defaultValue={rank.required_landings}
                        onBlur={async (e) => {
                          const v = Number(e.target.value);
                          if (v !== rank.required_landings) {
                            await dispatch(updateRank({ rankId: rank.id, data: { required_landings: v } }));
                            refreshPath();
                          }
                        }}
                        className="border border-brand-border rounded-lg px-2 py-1 text-sm w-16"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1 items-center">
                        {(rankAircraft[rank.id] || []).map((ra: any) => (
                          <span key={ra.id} className="text-xs bg-brand-pale text-brand border border-brand-border px-2 py-0.5 rounded-full flex items-center gap-1">
                            {ra.aircraft_name || `Type #${ra.aircraft_type_id}`} ({ra.count})
                            <button
                              onClick={async () => {
                                await dispatch(removeAircraftFromRank({ rankId: rank.id, aircraftTypeId: ra.aircraft_type_id }));
                                const ac = await dispatch(fetchRankAircraft(rank.id)).unwrap();
                                setRankAircraft(prev => ({ ...prev, [rank.id]: ac || [] }));
                              }}
                              className="text-red-400 hover:text-red-600 ml-0.5"
                            >×</button>
                          </span>
                        ))}
                        {assignAcRankId === rank.id ? (
                          <div className="flex gap-1 items-center">
                            <select
                              value={assignAcTypeId}
                              onChange={e => setAssignAcTypeId(Number(e.target.value))}
                              className="text-xs border border-brand-border rounded-lg px-1 py-0.5 w-24"
                            >
                              <option value={0}>Type</option>
                              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <button
                              onClick={async () => {
                                if (assignAcTypeId) {
                                  await dispatch(assignAircraftToRank({ rankId: rank.id, aircraftTypeId: assignAcTypeId }));
                                  const ac = await dispatch(fetchRankAircraft(rank.id)).unwrap();
                                  setRankAircraft(prev => ({ ...prev, [rank.id]: ac || [] }));
                                  setAssignAcRankId(null);
                                  setAssignAcTypeId(0);
                                }
                              }}
                              className="text-xs bg-brand text-white px-1.5 py-0.5 rounded-full"
                            >+</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssignAcRankId(rank.id)}
                            className="text-xs text-brand hover:underline"
                          >+ Add Type</button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={async () => { await dispatch(deleteRank(rank.id)); refreshPath(); }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Promote Section */}
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
        <h3 className="text-lg font-bold text-brand mb-4">Promote Pilot</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <select value={promotePilotId} onChange={e => setPromotePilotId(Number(e.target.value))} className="border border-brand-border rounded-xl px-4 py-2.5 text-sm">
            <option value={0}>Select Pilot</option>
            {pilots.map(p => <option key={p.id} value={p.id}>{p.callsign} — {p.name}</option>)}
          </select>
          <select value={promotePathId} onChange={e => setPromotePathId(Number(e.target.value))} className="border border-brand-border rounded-xl px-4 py-2.5 text-sm">
            <option value={0}>Career Path</option>
            {paths.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            onClick={async () => {
              if (promotePilotId && promotePathId) {
                const res = await dispatch(promotePilot({ pilotId: promotePilotId, careerPathId: promotePathId }));
                if (promotePilot.fulfilled.match(res)) {
                  alert("Pilot promoted successfully!");
                } else {
                  alert("Failed to promote pilot: " + (res.error?.message || "Unknown error"));
                }
              }
            }}
            className="rounded-full bg-gradient-to-br from-brand-dark to-brand text-white font-semibold text-sm py-2.5 hover:-translate-y-0.5 hover:shadow-lg transition-all"
          >Promote</button>
        </div>
      </div>
    </div>
  );
}

/* ─── TRANSFERS TAB ─── */

export function TransfersTab() {
  const dispatch = useAppDispatch();
  const { transfers } = useAppSelector((s) => s.transfer);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-brand">Transfer Requests</h2>
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-pale text-left">
              <tr>
                <th className="px-5 py-3 font-semibold text-gray-600">Pilot</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Type</th>
                <th className="px-5 py-3 font-semibold text-gray-600">To</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Date</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-t border-brand-border">
                  <td className="px-5 py-3 font-semibold">{t.pilot_callsign}</td>
                  <td className="px-5 py-3 text-xs uppercase">{t.transfer_type.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3">{t.to_value}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.status === "approved" ? "bg-green-100 text-green-700" : t.status === "denied" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{t.status}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">{new Date(t.requested_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    {t.status === "pending" && (
                      <div className="flex gap-2">
                        <button onClick={() => dispatch(reviewTransfer({ id: t.id, status: "approved" })).then(() => dispatch(fetchTransfers()))} className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700">Approve</button>
                        <button onClick={() => dispatch(reviewTransfer({ id: t.id, status: "denied" })).then(() => dispatch(fetchTransfers()))} className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600">Deny</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transfers.length === 0 && <div className="text-center py-8 text-gray-500">No transfer requests.</div>}
      </div>
    </div>
  );
}

/* ─── SETTINGS TAB ─── */

/* ─── WAVES TAB ─── */

export function WavesTab() {
  const dispatch = useAppDispatch();
  const { waves } = useAppSelector((s) => s.schedule);
  const [name, setName] = useState("");
  const [waveType, setWaveType] = useState("departure");
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("09:00");
  const [weekStart, setWeekStart] = useState("");

  useEffect(() => {
    dispatch(fetchWaves({}));
  }, []);

  const handleCreate = async () => {
    if (!name || !weekStart) return;
    await dispatch(createWave({
      name,
      wave_type: waveType,
      departure_window_start: start,
      departure_window_end: end,
      week_start: weekStart,
    }));
    setName(""); setWeekStart("");
    dispatch(fetchWaves({}));
  };

  const depWaves = waves.filter(w => w.wave_type === "departure");
  const arrWaves = waves.filter(w => w.wave_type === "arrival");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-brand">Wave Management</h2>

      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
        <h3 className="text-lg font-bold text-brand mb-4">Create Wave</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
          <input placeholder="Name (e.g. Morning Departure)" value={name} onChange={e => setName(e.target.value)} className="border border-brand-border rounded-xl px-3 py-2 text-sm" />
          <select value={waveType} onChange={e => setWaveType(e.target.value)} className="border border-brand-border rounded-xl px-3 py-2 text-sm">
            <option value="departure">Departure Wave</option>
            <option value="arrival">Arrival Wave</option>
          </select>
          <input type="time" value={start} onChange={e => setStart(e.target.value)} className="border border-brand-border rounded-xl px-3 py-2 text-sm" />
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="border border-brand-border rounded-xl px-3 py-2 text-sm" />
          <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className="border border-brand-border rounded-xl px-3 py-2 text-sm" />
        </div>
        <button onClick={handleCreate} className="rounded-full bg-brand text-white font-semibold text-sm px-5 py-2">Create</button>
        <p className="text-xs text-gray-400 mt-2">Typical DOH waves: Morning arrivals 04-07, departures 07-09; Evening arrivals 16-19, departures 19-21</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <h3 className="text-lg font-bold text-green-700 mb-3">Departure Waves</h3>
          {depWaves.map(w => (
            <div key={w.id} className="flex items-center justify-between py-2 border-b border-brand-border last:border-0">
              <div>
                <p className="font-semibold text-sm">{w.name}</p>
                <p className="text-xs text-gray-400">{w.departure_window_start} → {w.departure_window_end} · {w.week_start}</p>
              </div>
              <button onClick={() => dispatch(deleteWave(w.id)).then(() => dispatch(fetchWaves({})))} className="text-xs text-red-400 hover:text-red-600">Delete</button>
            </div>
          ))}
          {depWaves.length === 0 && <p className="text-sm text-gray-400">No departure waves.</p>}
        </div>

        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <h3 className="text-lg font-bold text-blue-700 mb-3">Arrival Waves</h3>
          {arrWaves.map(w => (
            <div key={w.id} className="flex items-center justify-between py-2 border-b border-brand-border last:border-0">
              <div>
                <p className="font-semibold text-sm">{w.name}</p>
                <p className="text-xs text-gray-400">{w.departure_window_start} → {w.departure_window_end} · {w.week_start}</p>
              </div>
              <button onClick={() => dispatch(deleteWave(w.id)).then(() => dispatch(fetchWaves({})))} className="text-xs text-red-400 hover:text-red-600">Delete</button>
            </div>
          ))}
          {arrWaves.length === 0 && <p className="text-sm text-gray-400">No arrival waves.</p>}
        </div>
      </div>
    </div>
  );
}

export function SettingsTab() {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector((s) => s.admin);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-brand">Settings</h2>
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
        <div className="space-y-3">
          {settings.map((s) => (
            <div key={s.setting_key} className="flex items-center justify-between py-2 border-b border-brand-border last:border-0">
              <div>
                <p className="font-semibold text-sm">{s.setting_key}</p>
                <p className="text-xs text-gray-400">{s.description}</p>
              </div>
              <input
                defaultValue={s.setting_value}
                onBlur={async (e) => {
                  if (e.target.value !== s.setting_value) {
                    const res = await dispatch(updateSetting({ key: s.setting_key, value: e.target.value }));
                    if (!updateSetting.fulfilled.match(res)) {
                      alert("Failed to update setting: " + (res.error?.message || "Unknown error"));
                    }
                  }
                }}
                className="border border-brand-border rounded-lg px-3 py-1.5 text-sm w-40"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
