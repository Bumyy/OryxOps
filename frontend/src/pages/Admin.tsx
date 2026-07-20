import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { api } from "../api/client";
import { GroupsTab } from "./admin/GroupsPage";
import PaxBoardingModal from "../components/efb/briefing/PaxBoardingModal";
import {
  fetchSettings,
  updateSetting,
  promotePilot,
  enrollPilot,
  fetchEnrolledPilots,
  reshuffleGroup,
  updateSimbriefId,
} from "../store/slices/adminSlice";
import {
  fetchGroups,
  createGroup,
  updateGroup,
} from "../store/slices/groupSlice";
import { fetchPilots } from "../store/slices/pilotSlice";
import {
  fetchAirframes,
  fetchAircraftTypes,
  createAirframe,
  updateAirframe,
} from "../store/slices/aircraftSlice";
import { fetchTransfers, reviewTransfer } from "../store/slices/transferSlice";
import {
  fetchCareerPaths,
  fetchCareerPathDetail,
  createCareerPath,
  deleteCareerPath,
  createRank,
  updateRank,
  deleteRank,
  fetchRankAircraft,
  assignAircraftToRank,
  removeAircraftFromRank,
} from "../store/slices/careerSlice";
import {
  fetchWaves,
  createWave,
  deleteWave,
} from "../store/slices/scheduleSlice";

type Tab =
  | "pilots"
  | "groups"
  | "aircraft"
  | "careers"
  | "transfers"
  | "waves"
  | "settings"
  | "rates";

export const FUEL_BURN_RATES: Record<string, number> = {
  "A319": 2200,
  "A320": 2500,
  "A321": 2800,
  "A330": 6000,
  "A332": 5700,
  "A333": 6000,
  "A340": 7000,
  "A359": 5800,
  "B772": 6800,
  "B77W": 7200,
  "B77L": 7000,
  "B77F": 7600,
  "A388": 10800,
};

export const MASTER_AIRCRAFT_LIST = [
  { icao: "A319", name: "Airbus A319", rate: 2200 },
  { icao: "A320", name: "Airbus A320-200", rate: 2500 },
  { icao: "A321", name: "Airbus A321-200", rate: 2800 },
  { icao: "A330", name: "Airbus A330", rate: 6000 },
  { icao: "A332", name: "Airbus A330-200", rate: 5700 },
  { icao: "A333", name: "Airbus A330-300", rate: 6000 },
  { icao: "A340", name: "Airbus A340", rate: 7000 },
  { icao: "A359", name: "Airbus A350-900", rate: 5800 },
  { icao: "B772", name: "Boeing 777-200ER", rate: 6800 },
  { icao: "B77W", name: "Boeing 777-300ER", rate: 7200 },
  { icao: "B77L", name: "Boeing 777-200LR", rate: 7000 },
  { icao: "B77F", name: "Boeing 777F (Freighter)", rate: 7600 },
  { icao: "A388", name: "Airbus A380-800", rate: 10800 },
];

export default function Admin() {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector((s) => s.admin);
  const { groups } = useAppSelector((s) => s.group);
  const { pilots } = useAppSelector((s) => s.pilot);
  const { airframes, types } = useAppSelector((s) => s.aircraft);
  const { transfers } = useAppSelector((s) => s.transfer);
  const user = useAppSelector((s) => s.auth.user);
  const [tab, setTab] = useState<Tab>("pilots");

  const isEligibleForRates = user && user.callsign && ["QRV001", "QRV002", "QRV003", "QRV004"].includes(user.callsign.toUpperCase());

  const tabs: { key: Tab; label: string }[] = [
    { key: "pilots", label: "Pilots" },
    { key: "groups", label: "Groups" },
    { key: "aircraft", label: "Aircraft" },
    { key: "careers", label: "Careers" },
    { key: "transfers", label: "Transfers" },
    { key: "waves", label: "Waves" },
    { key: "settings", label: "Settings" },
  ];

  if (isEligibleForRates) {
    tabs.push({ key: "rates", label: "Rate Changer" });
  }

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && tabs.some((t) => t.key === hash)) setTab(hash as Tab);
    const onHash = () => {
      const h = window.location.hash.replace("#", "");
      if (h && tabs.some((t) => t.key === h)) setTab(h as Tab);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [user]);

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
            onClick={() => {
              setTab(t.key);
              window.location.hash = t.key;
            }}
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
      {tab === "rates" && isEligibleForRates && <RatesTab />}
    </div>
  );
}

export function PilotsTab() {
  const dispatch = useAppDispatch();
  const { enrolled, unenrolled } = useAppSelector((s) => s.admin);
  const { paths } = useAppSelector((s) => s.career);
  const [careerPathId, setCareerPathId] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [pilotSimbriefIds, setPilotSimbriefIds] = useState<Record<number, string>>({});

  useEffect(() => {
    dispatch(fetchEnrolledPilots());
  }, []);

  useEffect(() => {
    if (paths.length > 0 && careerPathId === 0) {
      setCareerPathId(paths[0].id);
    }
  }, [paths]);

  const handleEnroll = async (pilotId: number, simbriefIdStr?: string) => {
    const sId = simbriefIdStr !== undefined ? simbriefIdStr : "";
    const parsedSimbrief = sId.trim() ? parseInt(sId.trim(), 10) : null;

    const res = await dispatch(
      enrollPilot({
        pilot_id: pilotId,
        career_path_id: careerPathId,
        simbrief_id: parsedSimbrief,
      })
    );
    if (enrollPilot.fulfilled.match(res)) {
      alert("Pilot enrolled successfully!");
      dispatch(fetchEnrolledPilots());
    } else {
      alert(
        "Failed to enroll pilot: " + (res.error?.message || "Unknown error")
      );
    }
  };

  const handleUpdateSimbrief = async (pilotId: number, simbriefIdStr: string) => {
    const parsedSimbrief = simbriefIdStr.trim() ? parseInt(simbriefIdStr.trim(), 10) : null;
    const res = await dispatch(
      updateSimbriefId({ pilot_id: pilotId, simbrief_id: parsedSimbrief })
    );
    if (updateSimbriefId.fulfilled.match(res)) {
      alert("SimBrief ID updated successfully!");
      dispatch(fetchEnrolledPilots());
    } else {
      alert(
        "Failed to update SimBrief ID: " + (res.error?.message || "Unknown error")
      );
    }
  };

  const handlePromote = async (pilotId: number, pathId: number) => {
    const res = await dispatch(promotePilot({ pilotId, careerPathId: pathId }));
    if (promotePilot.fulfilled.match(res)) {
      alert("Pilot promoted successfully!");
      dispatch(fetchEnrolledPilots());
    } else {
      alert(
        "Failed to promote pilot: " + (res.error?.message || "Unknown error")
      );
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
              {paths.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} Path
                </option>
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
            <h3 className="text-sm font-semibold text-gray-500 mb-3">
              Not Enrolled ({filteredUnenrolled.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredUnenrolled.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col p-3 bg-brand-pale rounded-xl border border-brand-border gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{p.callsign}</p>
                      <p className="text-xs text-gray-400">{p.name}</p>
                    </div>
                    <button
                      onClick={() => handleEnroll(p.id, pilotSimbriefIds[p.id])}
                      className="text-xs rounded-full bg-brand text-white px-3 py-1 hover:bg-brand-light transition-colors"
                    >
                      Enroll
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 border-t border-brand-border/40 pt-2 justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">SimBrief ID:</span>
                      <input
                        type="text"
                        placeholder="Not set"
                        value={pilotSimbriefIds[p.id] !== undefined ? pilotSimbriefIds[p.id] : (p.simbrief_id || "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPilotSimbriefIds(prev => ({ ...prev, [p.id]: val }));
                        }}
                        className="border border-brand-border rounded px-2 py-0.5 text-[10px] w-24 font-mono bg-white focus:outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            Enrolled ({filteredEnrolled.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredEnrolled.map((p) => {
              const currentSimbrief = pilotSimbriefIds[p.id] !== undefined ? pilotSimbriefIds[p.id] : (p.simbrief_id || "");
              const isChanged = String(p.simbrief_id || "") !== String(currentSimbrief);

              return (
                <div
                  key={p.id}
                  className="flex flex-col p-4 bg-green-50 rounded-xl border border-green-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{p.callsign}</p>
                      <p className="text-xs text-gray-400">{p.name}</p>
                    </div>
                    <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-green-200/50 pt-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">SimBrief ID:</span>
                      <input
                        type="text"
                        placeholder="Not set"
                        value={currentSimbrief}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPilotSimbriefIds(prev => ({ ...prev, [p.id]: val }));
                        }}
                        className="border border-green-200 rounded px-2 py-0.5 text-[10px] w-24 font-mono bg-white focus:outline-none focus:border-brand"
                      />
                    </div>
                    {isChanged && (
                      <button
                        onClick={() => handleUpdateSimbrief(p.id, currentSimbrief)}
                        className="text-[9px] font-black uppercase tracking-wider bg-brand text-white px-2.5 py-1 rounded-lg hover:bg-brand-light transition-all"
                      >
                        Save
                      </button>
                    )}
                  </div>

                  {p.careers && p.careers.length > 0 && (
                    <div className="space-y-2 mt-2 pt-2 border-t border-green-200/50">
                      {p.careers.map((c: any) => (
                        <div
                          key={c.career_path_id}
                          className="flex items-center justify-between text-xs text-brand-light"
                        >
                          <div className="truncate flex-1">
                            <span className="font-semibold">
                              {c.career_path_name}:
                            </span>{" "}
                            {c.current_rank_name}
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
              );
            })}
          </div>
          {filteredEnrolled.length === 0 && (
            <p className="text-sm text-gray-400 py-4">
              No matching enrolled pilots found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── GROUPS TAB ─── */
// GroupsTab is imported from ./admin/GroupsPage

/* ─── AIRCRAFT TAB ─── */

export function AircraftTab() {
  const dispatch = useAppDispatch();
  const { airframes, types } = useAppSelector((s) => s.aircraft);
  const [showCreate, setShowCreate] = useState(false);
  const [reg, setReg] = useState("");
  const [typeId, setTypeId] = useState(0);
  const [airport, setAirport] = useState("OTHH");
  const [ifOrgId, setIfOrgId] = useState("");
  const [editStatus, setEditStatus] = useState<Record<number, string>>({});

  useEffect(() => {
    dispatch(fetchAirframes());
    dispatch(fetchAircraftTypes());
  }, [dispatch]);

  const handleCreate = async () => {
    if (!reg || !typeId) return;
    await dispatch(
      createAirframe({
        aircraft_type_id: typeId,
        registration: reg,
        current_airport: airport,
        home_base: airport,
        if_organization_aircraft_id: ifOrgId || null,
      })
    );
    setReg("");
    setTypeId(0);
    setAirport("OTHH");
    setIfOrgId("");
    setShowCreate(false);
    dispatch(fetchAirframes());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-brand">Fleet Management</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-full bg-gradient-to-br from-brand-dark to-brand text-white font-semibold text-sm px-5 py-2 hover:-translate-y-0.5 hover:shadow-lg transition-all"
        >
          + Add Airframe
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <h3 className="text-lg font-bold text-brand mb-4">Add Airframe</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
            <input
              placeholder="Registration (e.g. A7-BAA)"
              value={reg}
              onChange={(e) => setReg(e.target.value)}
              className="border border-brand-border rounded-xl px-4 py-2.5 text-sm"
            />
            <select
              value={typeId}
              onChange={(e) => setTypeId(Number(e.target.value))}
              className="border border-brand-border rounded-xl px-4 py-2.5 text-sm"
            >
              <option value={0}>Aircraft Type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.icao})
                </option>
              ))}
            </select>
            <input
              placeholder="Delivery Airport"
              value={airport}
              onChange={(e) => setAirport(e.target.value)}
              className="border border-brand-border rounded-xl px-4 py-2.5 text-sm"
            />
            <input
              placeholder="IF Org Aircraft ID (Optional)"
              value={ifOrgId}
              onChange={(e) => setIfOrgId(e.target.value)}
              className="border border-brand-border rounded-xl px-4 py-2.5 text-sm"
            />
          </div>
          <button
            onClick={handleCreate}
            className="rounded-full bg-brand text-white font-semibold text-sm px-5 py-2"
          >
            Create
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-pale text-left">
              <tr>
                <th className="px-5 py-3 font-semibold text-gray-600">
                  Registration
                </th>
                <th className="px-5 py-3 font-semibold text-gray-600">Type</th>
                <th className="px-5 py-3 font-semibold text-gray-600">
                  Location
                </th>
                <th className="px-5 py-3 font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-5 py-3 font-semibold text-gray-600">Hours</th>
                <th className="px-5 py-3 font-semibold text-gray-600">
                  IF Org ID
                </th>
                <th className="px-5 py-3 font-semibold text-gray-600">
                  Actions
                </th>
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
                        setEditStatus({
                          ...editStatus,
                          [a.id]: e.target.value,
                        });
                        await dispatch(
                          updateAirframe({
                            id: a.id,
                            data: { status: e.target.value },
                          })
                        );
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
                      defaultValue={a.if_organization_aircraft_id || ""}
                      placeholder="IF Org ID"
                      onBlur={async (e) => {
                        if (e.target.value !== (a.if_organization_aircraft_id || "")) {
                          await dispatch(
                            updateAirframe({
                              id: a.id,
                              data: {
                                if_organization_aircraft_id: e.target.value || null,
                              },
                            })
                          );
                          dispatch(fetchAirframes());
                        }
                      }}
                      className="text-xs border border-brand-border rounded-lg px-2 py-1 w-40"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <input
                      placeholder="Move to ICAO"
                      onBlur={async (e) => {
                        if (e.target.value && e.target.value.length === 4) {
                          await dispatch(
                            updateAirframe({
                              id: a.id,
                              data: {
                                current_airport: e.target.value.toUpperCase(),
                              },
                            })
                          );
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
        setRankAircraft((prev) => ({ ...prev, [rank.id]: ac || [] }));
      }
    }
  };

  const refreshPath = () => {
    if (activePathId) loadPath(activePathId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-brand">Career Management</h2>
        <button
          onClick={() => setShowCreatePath(!showCreatePath)}
          className="rounded-full bg-gradient-to-br from-brand-dark to-brand text-white font-semibold text-sm px-5 py-2 hover:-translate-y-0.5 hover:shadow-lg transition-all"
        >
          + New Path
        </button>
      </div>

      {/* Create Path */}
      {showCreatePath && (
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <h3 className="text-lg font-bold text-brand mb-4">
            Create Career Path
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <input
              placeholder="Name (e.g. Airbus)"
              value={newPathName}
              onChange={(e) => setNewPathName(e.target.value)}
              className="border border-brand-border rounded-xl px-4 py-2.5 text-sm"
            />
            <input
              placeholder="Description"
              value={newPathDesc}
              onChange={(e) => setNewPathDesc(e.target.value)}
              className="border border-brand-border rounded-xl px-4 py-2.5 text-sm"
            />
          </div>
          <button
            onClick={async () => {
              await dispatch(
                createCareerPath({
                  name: newPathName,
                  description: newPathDesc || null,
                })
              );
              setNewPathName("");
              setNewPathDesc("");
              setShowCreatePath(false);
              dispatch(fetchCareerPaths());
            }}
            className="rounded-full bg-brand text-white font-semibold text-sm px-5 py-2"
          >
            Create
          </button>
        </div>
      )}

      {/* Path List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {paths.map((p) => (
          <button
            key={p.id}
            onClick={() => loadPath(p.id)}
            className={`text-left bg-white rounded-2xl border shadow-sm p-5 transition-all ${
              activePathId === p.id
                ? "border-brand ring-2 ring-brand/20"
                : "border-brand-border hover:shadow-lg"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-brand text-lg">{p.name}</h3>
              <span className="text-xs text-gray-400">ID: {p.id}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {p.description || "No description"}
            </p>
            {p.is_active ? (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-2 inline-block">
                Active
              </span>
            ) : (
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full mt-2 inline-block">
                Inactive
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Path Detail with Ranks */}
      {pathDetail && (
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-brand">
              {pathDetail.name} — Ranks
            </h3>
            <button
              onClick={() => setShowCreateRank(!showCreateRank)}
              className="text-xs rounded-full bg-brand text-white px-3 py-1 hover:bg-brand-light transition-colors"
            >
              + Add Rank
            </button>
          </div>

          {/* Create Rank Form */}
          {showCreateRank && activePathId && (
            <div className="mb-4 p-4 bg-brand-pale rounded-xl border border-brand-border">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <input
                  placeholder="Rank Name"
                  value={newRankName}
                  onChange={(e) => setNewRankName(e.target.value)}
                  className="border border-brand-border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Sort Order"
                  value={newRankOrder}
                  onChange={(e) => setNewRankOrder(Number(e.target.value))}
                  className="border border-brand-border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Route % Required"
                  value={newRankPct}
                  onChange={(e) => setNewRankPct(Number(e.target.value))}
                  className="border border-brand-border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Takeoffs Required"
                  value={newRankTakeoffs}
                  onChange={(e) => setNewRankTakeoffs(Number(e.target.value))}
                  className="border border-brand-border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Landings Required"
                  value={newRankLandings}
                  onChange={(e) => setNewRankLandings(Number(e.target.value))}
                  className="border border-brand-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={async () => {
                  await dispatch(
                    createRank({
                      pathId: activePathId,
                      data: {
                        name: newRankName,
                        sort_order: newRankOrder,
                        required_route_pct: newRankPct,
                        required_takeoffs: newRankTakeoffs,
                        required_landings: newRankLandings,
                      },
                    })
                  );
                  setNewRankName("");
                  setShowCreateRank(false);
                  refreshPath();
                }}
                className="text-xs bg-brand text-white px-4 py-1.5 rounded-full"
              >
                Save Rank
              </button>
            </div>
          )}

          {/* Ranks Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-pale text-left">
                <tr>
                  <th className="px-4 py-2 font-semibold text-gray-600">#</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">
                    Name
                  </th>
                  <th className="px-4 py-2 font-semibold text-gray-600">
                    Route %
                  </th>
                  <th className="px-4 py-2 font-semibold text-gray-600">T/O</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">LDG</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">
                    Aircraft
                  </th>
                  <th className="px-4 py-2 font-semibold text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pathDetail.ranks?.map((rank: any) => (
                  <tr key={rank.id} className="border-t border-brand-border">
                    <td className="px-4 py-2 text-gray-400">
                      {rank.sort_order}
                    </td>
                    <td className="px-4 py-2 font-semibold">
                      {editRankId === rank.id ? (
                        <input
                          defaultValue={rank.name}
                          onBlur={async (e) => {
                            await dispatch(
                              updateRank({
                                rankId: rank.id,
                                data: { name: e.target.value },
                              })
                            );
                            setEditRankId(null);
                            refreshPath();
                          }}
                          className="border border-brand-border rounded-lg px-2 py-1 text-sm w-36"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer"
                          onClick={() => setEditRankId(rank.id)}
                        >
                          {rank.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        defaultValue={rank.required_route_pct}
                        onBlur={async (e) => {
                          const v = Number(e.target.value);
                          if (v !== rank.required_route_pct) {
                            await dispatch(
                              updateRank({
                                rankId: rank.id,
                                data: { required_route_pct: v },
                              })
                            );
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
                            await dispatch(
                              updateRank({
                                rankId: rank.id,
                                data: { required_takeoffs: v },
                              })
                            );
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
                            await dispatch(
                              updateRank({
                                rankId: rank.id,
                                data: { required_landings: v },
                              })
                            );
                            refreshPath();
                          }
                        }}
                        className="border border-brand-border rounded-lg px-2 py-1 text-sm w-16"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1 items-center">
                        {(rankAircraft[rank.id] || []).map((ra: any) => (
                          <span
                            key={ra.id}
                            className="text-xs bg-brand-pale text-brand border border-brand-border px-2 py-0.5 rounded-full flex items-center gap-1"
                          >
                            {ra.aircraft_name || `Type #${ra.aircraft_type_id}`}{" "}
                            ({ra.count})
                            <button
                              onClick={async () => {
                                await dispatch(
                                  removeAircraftFromRank({
                                    rankId: rank.id,
                                    aircraftTypeId: ra.aircraft_type_id,
                                  })
                                );
                                const ac = await dispatch(
                                  fetchRankAircraft(rank.id)
                                ).unwrap();
                                setRankAircraft((prev) => ({
                                  ...prev,
                                  [rank.id]: ac || [],
                                }));
                              }}
                              className="text-red-400 hover:text-red-600 ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {assignAcRankId === rank.id ? (
                          <div className="flex gap-1 items-center">
                            <select
                              value={assignAcTypeId}
                              onChange={(e) =>
                                setAssignAcTypeId(Number(e.target.value))
                              }
                              className="text-xs border border-brand-border rounded-lg px-1 py-0.5 w-24"
                            >
                              <option value={0}>Type</option>
                              {types.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={async () => {
                                if (assignAcTypeId) {
                                  await dispatch(
                                    assignAircraftToRank({
                                      rankId: rank.id,
                                      aircraftTypeId: assignAcTypeId,
                                    })
                                  );
                                  const ac = await dispatch(
                                    fetchRankAircraft(rank.id)
                                  ).unwrap();
                                  setRankAircraft((prev) => ({
                                    ...prev,
                                    [rank.id]: ac || [],
                                  }));
                                  setAssignAcRankId(null);
                                  setAssignAcTypeId(0);
                                }
                              }}
                              className="text-xs bg-brand text-white px-1.5 py-0.5 rounded-full"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssignAcRankId(rank.id)}
                            className="text-xs text-brand hover:underline"
                          >
                            + Add Type
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={async () => {
                          await dispatch(deleteRank(rank.id));
                          refreshPath();
                        }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
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
          <select
            value={promotePilotId}
            onChange={(e) => setPromotePilotId(Number(e.target.value))}
            className="border border-brand-border rounded-xl px-4 py-2.5 text-sm"
          >
            <option value={0}>Select Pilot</option>
            {pilots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.callsign} — {p.name}
              </option>
            ))}
          </select>
          <select
            value={promotePathId}
            onChange={(e) => setPromotePathId(Number(e.target.value))}
            className="border border-brand-border rounded-xl px-4 py-2.5 text-sm"
          >
            <option value={0}>Career Path</option>
            {paths.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              if (promotePilotId && promotePathId) {
                const res = await dispatch(
                  promotePilot({
                    pilotId: promotePilotId,
                    careerPathId: promotePathId,
                  })
                );
                if (promotePilot.fulfilled.match(res)) {
                  alert("Pilot promoted successfully!");
                } else {
                  alert(
                    "Failed to promote pilot: " +
                      (res.error?.message || "Unknown error")
                  );
                }
              }
            }}
            className="rounded-full bg-gradient-to-br from-brand-dark to-brand text-white font-semibold text-sm py-2.5 hover:-translate-y-0.5 hover:shadow-lg transition-all"
          >
            Promote
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── TRANSFERS TAB ─── */

export function TransfersTab() {
  const dispatch = useAppDispatch();
  const { transfers } = useAppSelector((s) => s.transfer);

  useEffect(() => {
    dispatch(fetchTransfers());
  }, [dispatch]);

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
                <th className="px-5 py-3 font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-5 py-3 font-semibold text-gray-600">Date</th>
                <th className="px-5 py-3 font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-t border-brand-border">
                  <td className="px-5 py-3 font-semibold">
                    {t.pilot_callsign}
                  </td>
                  <td className="px-5 py-3 text-xs uppercase">
                    {t.transfer_type.replace(/_/g, " ")}
                  </td>
                  <td className="px-5 py-3">{t.to_value}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        t.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : t.status === "denied"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {new Date(t.requested_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    {t.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            dispatch(
                              reviewTransfer({ id: t.id, status: "approved" })
                            ).then(() => dispatch(fetchTransfers()))
                          }
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            dispatch(
                              reviewTransfer({ id: t.id, status: "denied" })
                            ).then(() => dispatch(fetchTransfers()))
                          }
                          className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transfers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No transfer requests.
          </div>
        )}
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
    await dispatch(
      createWave({
        name,
        wave_type: waveType,
        departure_window_start: start,
        departure_window_end: end,
        week_start: weekStart,
      })
    );
    setName("");
    setWeekStart("");
    dispatch(fetchWaves({}));
  };

  const depWaves = waves.filter((w) => w.wave_type === "departure");
  const arrWaves = waves.filter((w) => w.wave_type === "arrival");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-brand">Wave Management</h2>

      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
        <h3 className="text-lg font-bold text-brand mb-4">Create Wave</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
          <input
            placeholder="Name (e.g. Morning Departure)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-brand-border rounded-xl px-3 py-2 text-sm"
          />
          <select
            value={waveType}
            onChange={(e) => setWaveType(e.target.value)}
            className="border border-brand-border rounded-xl px-3 py-2 text-sm"
          >
            <option value="departure">Departure Wave</option>
            <option value="arrival">Arrival Wave</option>
          </select>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="border border-brand-border rounded-xl px-3 py-2 text-sm"
          />
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="border border-brand-border rounded-xl px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="border border-brand-border rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleCreate}
          className="rounded-full bg-brand text-white font-semibold text-sm px-5 py-2"
        >
          Create
        </button>
        <p className="text-xs text-gray-400 mt-2">
          Typical DOH waves: Morning arrivals 04-07, departures 07-09; Evening
          arrivals 16-19, departures 19-21
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <h3 className="text-lg font-bold text-green-700 mb-3">
            Departure Waves
          </h3>
          {depWaves.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between py-2 border-b border-brand-border last:border-0"
            >
              <div>
                <p className="font-semibold text-sm">{w.name}</p>
                <p className="text-xs text-gray-400">
                  {w.departure_window_start} → {w.departure_window_end} ·{" "}
                  {w.week_start}
                </p>
              </div>
              <button
                onClick={() =>
                  dispatch(deleteWave(w.id)).then(() =>
                    dispatch(fetchWaves({}))
                  )
                }
                className="text-xs text-red-400 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          ))}
          {depWaves.length === 0 && (
            <p className="text-sm text-gray-400">No departure waves.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
          <h3 className="text-lg font-bold text-blue-700 mb-3">
            Arrival Waves
          </h3>
          {arrWaves.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between py-2 border-b border-brand-border last:border-0"
            >
              <div>
                <p className="font-semibold text-sm">{w.name}</p>
                <p className="text-xs text-gray-400">
                  {w.departure_window_start} → {w.departure_window_end} ·{" "}
                  {w.week_start}
                </p>
              </div>
              <button
                onClick={() =>
                  dispatch(deleteWave(w.id)).then(() =>
                    dispatch(fetchWaves({}))
                  )
                }
                className="text-xs text-red-400 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          ))}
          {arrWaves.length === 0 && (
            <p className="text-sm text-gray-400">No arrival waves.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SettingsTab() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { settings } = useAppSelector((s) => s.admin);
  const [ifStatus, setIfStatus] = useState<{ connected: boolean; scopes?: string } | null>(null);
  const [ifMatches, setIfMatches] = useState<any>(null);
  const [ifLoading, setIfLoading] = useState(false);
  const [ifMsg, setIfMsg] = useState("");

  const checkIfStatus = async () => {
    try {
      const res = await api.get<any>("/infinite-flight/auth/status");
      setIfStatus(res);
    } catch {
      setIfStatus(null);
    }
  };

  useEffect(() => {
    checkIfStatus();
    dispatch(fetchSettings());
  }, [dispatch]);

  const handleConnect = async () => {
    setIfLoading(true);
    try {
      const res = await api.get<{ authorize_url: string }>("/infinite-flight/auth/authorize");
      window.location.href = res.authorize_url;
    } catch (e: any) {
      setIfMsg(e.message || "Failed to start auth flow");
    }
    setIfLoading(false);
  };

  const handleDisconnect = async () => {
    setIfLoading(true);
    try {
      await api.post("/infinite-flight/auth/revoke");
      setIfStatus(null);
      setIfMsg("Disconnected from Infinite Flight.");
    } catch (e: any) {
      setIfMsg(e.message || "Failed to revoke");
    }
    setIfLoading(false);
  };

  const handleSyncAircraft = async () => {
    setIfLoading(true);
    setIfMsg("");
    try {
      const res = await api.post<any>("/infinite-flight/aircraft/sync-all");
      setIfMsg(`Linked ${res.linked} aircraft. ${res.already_linked} already linked, ${res.unmatched} unmatched.`);
      await checkIfStatus();
    } catch (e: any) {
      setIfMsg(e.message || "Sync failed");
    }
    setIfLoading(false);
  };

  const handleCheckMatches = async () => {
    setIfLoading(true);
    try {
      const res = await api.get<any>("/infinite-flight/aircraft/matches");
      setIfMatches(res);
    } catch (e: any) {
      setIfMsg(e.message || "Failed to load matches");
    }
    setIfLoading(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-brand">Settings</h2>

      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
        <div className="space-y-3">
          {settings.map((s) => {
            const isRateSetting = s.setting_key.startsWith("econ_") || s.setting_key.startsWith("repu_");
            const isDisabled = isRateSetting && !user?.is_executive;

            return (
              <div
                key={s.setting_key}
                className="flex items-center justify-between py-2 border-b border-brand-border last:border-0"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{s.setting_key}</p>
                    {isRateSetting && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          user?.is_executive
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-gray-100 text-gray-500 border border-gray-200"
                        }`}
                      >
                        {user?.is_executive ? "👑 Executive Rate" : "🔒 Executive Only (QRV001-004)"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{s.description}</p>
                </div>
                <input
                  defaultValue={s.setting_value}
                  disabled={isDisabled}
                  title={isDisabled ? "Rate settings can only be modified by QRV001 to QRV004" : undefined}
                  onBlur={async (e) => {
                    if (e.target.value !== s.setting_value) {
                      const res = await dispatch(
                        updateSetting({
                          key: s.setting_key,
                          value: e.target.value,
                        })
                      );
                      if (!updateSetting.fulfilled.match(res)) {
                        alert(
                          "Failed to update setting: " +
                            (res.error?.message || "Unknown error")
                        );
                      }
                    }
                  }}
                  className={`border rounded-lg px-3 py-1.5 text-sm w-40 ${
                    isDisabled
                      ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                      : "border-brand-border bg-white"
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Infinite Flight Integration */}
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-brand">Infinite Flight Live</h3>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              ifStatus?.connected
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {ifStatus?.connected ? "Connected" : "Not Connected"}
          </span>
        </div>

        {ifStatus?.connected && ifStatus.scopes && (
          <p className="text-xs text-gray-400 mb-4">
            Scopes: {ifStatus.scopes}
          </p>
        )}

        <div className="flex flex-wrap gap-3 mb-4">
          {!ifStatus?.connected ? (
            <button
              onClick={handleConnect}
              disabled={ifLoading}
              className="rounded-full bg-gradient-to-br from-brand-dark to-brand text-white font-semibold text-sm px-5 py-2 hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50"
            >
              {ifLoading ? "..." : "Connect with Infinite Flight"}
            </button>
          ) : (
            <>
              <button
                onClick={handleSyncAircraft}
                disabled={ifLoading}
                className="rounded-full bg-brand text-white font-semibold text-sm px-5 py-2 hover:bg-brand-light transition-colors disabled:opacity-50"
              >
                {ifLoading ? "..." : "Sync Aircraft"}
              </button>
              <button
                onClick={handleCheckMatches}
                disabled={ifLoading}
                className="rounded-full border border-brand-border text-gray-600 font-semibold text-sm px-5 py-2 hover:bg-brand-pale transition-colors disabled:opacity-50"
              >
                Check Matches
              </button>
              <button
                onClick={handleDisconnect}
                disabled={ifLoading}
                className="rounded-full border border-red-200 text-red-500 font-semibold text-sm px-5 py-2 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Disconnect
              </button>
            </>
          )}
        </div>

        {ifMsg && (
          <p className="text-sm text-gray-600 bg-brand-pale rounded-xl p-3 mb-4">{ifMsg}</p>
        )}

        {ifMatches && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="bg-brand-pale text-left">
                <tr>
                  <th className="px-4 py-2 font-semibold text-gray-600">Local Aircraft</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">Registration</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">IF Match</th>
                  <th className="px-4 py-2 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {ifMatches.matches?.map((m: any) => (
                  <tr key={m.local_id} className="border-t border-brand-border">
                    <td className="px-4 py-2">ID: {m.local_id}</td>
                    <td className="px-4 py-2 font-semibold">{m.local_registration}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {m.suggested_if_aircraft
                        ? `${m.suggested_if_aircraft.registration} (${m.suggested_if_aircraft.organization_name})`
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {m.linked ? (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          Linked
                        </span>
                      ) : m.suggested_if_aircraft ? (
                        <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                          Ready
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No match</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Embedded Leg Economics Simulator & Pax Boarding Simulator */}
      <div className="flex flex-col gap-6">
        <LegSimulatorPanel />
        <PaxSimulatorPanel />
      </div>
    </div>
  );
}


export function RatesTab() {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector((s) => s.admin);

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  // Group settings by their category
  const econSettings = settings.filter(s => s.setting_key.startsWith("econ_") && !s.setting_key.includes("payout") && !s.setting_key.includes("min_payout"));
  const repuSettings = settings.filter(s => s.setting_key.startsWith("repu_"));
  const salarySettings = settings.filter(s => s.setting_key.includes("payout") || s.setting_key.includes("min_payout"));

  const renderGroup = (title: string, icon: string, list: typeof settings) => (
    <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6 space-y-4">
      <h3 className="text-sm font-black text-brand-dark flex items-center gap-1.5 border-b border-brand-border/40 pb-2.5 uppercase tracking-wider">
        {icon} {title}
      </h3>
      <div className="space-y-4">
        {list.map((s) => (
          <div key={s.setting_key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1.5 last:border-0 border-b border-gray-50 pb-4">
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-gray-700">{s.setting_key}</span>
              <p className="text-[10px] text-gray-400 font-medium max-w-md">{s.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                defaultValue={s.setting_value}
                onBlur={async (e) => {
                  if (e.target.value !== s.setting_value) {
                    const res = await dispatch(
                      updateSetting({
                        key: s.setting_key,
                        value: e.target.value,
                      })
                    );
                    if (!updateSetting.fulfilled.match(res)) {
                      alert("Failed to update rate: " + (res.error?.message || "Unknown error"));
                    } else {
                      dispatch(fetchSettings());
                    }
                  }
                }}
                className="border border-brand-border rounded-xl px-3 py-2 text-xs font-mono font-bold w-32 focus:border-brand focus:outline-none"
              />
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-xs text-gray-400 italic">No settings loaded.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-brand-dark tracking-tight">💰 Rate Changer Center</h2>
        <p className="text-gray-400 text-xs mt-1">Configure global parameters affecting pilot payouts, flight leg earnings, and reputation scoring.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {renderGroup("Leg Economics & Ticket pricing", "✈️", econSettings)}
        {renderGroup("Reputation Score Metrics", "🌟", repuSettings)}
        {renderGroup("Salary Payout Percentages & Limits", "💵", salarySettings)}
      </div>

      {/* Embedded Leg Economics Simulator & Pax Boarding Simulator */}
      <div className="flex flex-col gap-6">
        <LegSimulatorPanel />
        <PaxSimulatorPanel />
      </div>
    </div>
  );
}


export function LegSimulatorPanel() {
  const { settings } = useAppSelector((s) => s.admin);
  const specs = useAppSelector((s) => s.aircraft.specs) || {};

  // Simulator Inputs State
  const [selectedAircraft, setSelectedAircraft] = useState("A320");
  const [paxCount, setPaxCount] = useState(150);
  const [flightTimeHours, setFlightTimeHours] = useState("2");
  const [flightTimeMinutes, setFlightTimeMinutes] = useState("0");
  const flightTime = (parseInt(flightTimeHours) || 0) * 60 + (parseInt(flightTimeMinutes) || 0);
  const [fuelBurned, setFuelBurned] = useState(5000);
  const [landingFpm, setLandingFpm] = useState(120);
  const [isDiverted, setIsDiverted] = useState(false);
  const [isSplit, setIsSplit] = useState(false);

  // Helper to extract a setting value (falling back to custom defaults)
  const getSetting = (key: string, def: number): number => {
    const s = settings.find((x) => x.setting_key === key);
    return s ? parseFloat(s.setting_value) : def;
  };

  const currentSpec = specs[selectedAircraft] || {};
  const capacity = currentSpec.properties?.capacity || 180;

  // Auto-calculate fuel burn based on selected aircraft and flight duration
  useEffect(() => {
    const rate = FUEL_BURN_RATES[selectedAircraft] || 2500;
    const estBurn = Math.round((flightTime / 60) * rate);
    setFuelBurned(estBurn);
  }, [selectedAircraft, flightTimeHours, flightTimeMinutes]);

  // Auto-adjust pax count slider max if aircraft changes
  useEffect(() => {
    if (paxCount > capacity) {
      setPaxCount(capacity);
    }
  }, [selectedAircraft, capacity]);

  // Read current live rates
  const ticketBasePrice = getSetting("econ_ticket_base_price", 2.0); // ticket rate per pax per minute
  const fuelPriceRate = getSetting("econ_fuel_price_rate", 1.10);
  const diversionRatePerPax = getSetting("econ_diversion_charge_per_pax", 100);

  const payoutShareSolo = getSetting("econ_payout_share_solo", 0.10);
  const payoutShareSplit = getSetting("econ_payout_share_split", 0.05);
  const minPayoutSolo = getSetting("econ_min_payout_solo", 750);
  const minPayoutSplit = getSetting("econ_min_payout_split", 350);

  const grace = getSetting("repu_punctuality_grace", 30);
  const smoothThreshold = getSetting("repu_smoothness_threshold", 150);
  const smoothDivisor = getSetting("repu_smoothness_divisor", 4.0);

  // 1. New Gross Revenue = ticket_rate * pax * mins
  const grossRevenue = Math.round(ticketBasePrice * paxCount * flightTime);

  // 2. Fuel Cost
  const fuelCost = Math.round(fuelBurned * fuelPriceRate);
  
  // 3. Landing Penalty (0 - 150 FPM = 0 QAR)
  let landingPenalty = 0;
  if (landingFpm <= 150) landingPenalty = 0;
  else if (landingFpm <= 250) landingPenalty = 500;
  else if (landingFpm <= 350) landingPenalty = 2000;
  else if (landingFpm <= 450) landingPenalty = 6000;
  else landingPenalty = 15000;

  // 4. Operating Cost = 70% of Revenue (* 1.05 variance)
  const operatingCost = Math.round(grossRevenue * 0.70 * 1.05);
  const diversionCharge = isDiverted ? Math.round(paxCount * diversionRatePerPax) : 0;

  const totalExpenses = fuelCost + landingPenalty + operatingCost + diversionCharge;
  const netProfit = grossRevenue - totalExpenses;
  const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  const soloSalary = netProfit > 0 
    ? Math.max(minPayoutSolo, Math.round(netProfit * payoutShareSolo)) 
    : minPayoutSolo;

  const splitSalary = netProfit > 0 
    ? Math.max(minPayoutSplit, Math.round(netProfit * payoutShareSplit)) 
    : minPayoutSplit;

  const diff = Math.abs(flightTime - 45); // Assume 45 min scheduled duration
  const punctualityScore = Math.max(0, 100 - (diff > grace ? (diff - grace) : 0));
  const landingScore = Math.max(0, 100 - (landingFpm > smoothThreshold ? (landingFpm - smoothThreshold) / smoothDivisor : 0));
  const repRating = ((punctualityScore + landingScore) / 2.0) / 20.0;

  return (
    <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6 space-y-6">
      <div>
        <h3 className="text-lg font-black text-brand-dark flex items-center gap-1.5 border-b border-brand-border/40 pb-2.5 uppercase tracking-wider">
          📊 Leg Economics & Integrated Fuel Simulator
        </h3>
        <p className="text-gray-400 text-xs mt-1">Simulate flight leg revenue (Rate × Pax × Mins), 70% operating cost rule, fuel burn estimates, and touchdown penalty rates.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side - Inputs */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500">Aircraft Model (Auto Fuel Burn Rate)</label>
              <select
                value={selectedAircraft}
                onChange={(e) => setSelectedAircraft(e.target.value)}
                className="border border-brand-border rounded-xl px-3 py-2 text-xs focus:outline-none font-bold text-brand"
              >
                {MASTER_AIRCRAFT_LIST.map((ac) => (
                  <option key={ac.icao} value={ac.icao}>
                    {ac.name} ({ac.icao}) — {ac.rate} kg/hr fuel burn
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-bold text-gray-500">
              <span>Passenger Count</span>
              <span className="text-brand font-mono font-bold">{paxCount} / {capacity} Pax</span>
            </div>
            <input
              type="range"
              min={1}
              max={capacity}
              value={paxCount}
              onChange={(e) => setPaxCount(parseInt(e.target.value))}
              className="w-full accent-brand mt-1"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500">Flight Time (HH:MM)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="HH"
                  min="0"
                  value={flightTimeHours}
                  onChange={(e) => setFlightTimeHours(e.target.value)}
                  className="border border-brand-border rounded-xl px-2 py-2 text-xs font-mono font-bold focus:outline-none w-[45%] text-center"
                />
                <span className="text-gray-400 font-bold">:</span>
                <input
                  type="number"
                  placeholder="MM"
                  min="0"
                  max="59"
                  value={flightTimeMinutes}
                  onChange={(e) => setFlightTimeMinutes(e.target.value)}
                  className="border border-brand-border rounded-xl px-2 py-2 text-xs font-mono font-bold focus:outline-none w-[45%] text-center"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500">Fuel Burned (kg)</label>
              <input
                type="number"
                value={fuelBurned}
                onChange={(e) => setFuelBurned(Math.max(0, parseInt(e.target.value) || 0))}
                className="border border-brand-border rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none text-emerald-700 bg-emerald-50/30"
              />
              <span className="text-[9px] text-gray-400">Auto-calc: {FUEL_BURN_RATES[selectedAircraft] || 2500} kg/h</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500">Landing Rate (FPM)</label>
              <input
                type="number"
                value={landingFpm}
                onChange={(e) => setLandingFpm(Math.max(0, parseInt(e.target.value) || 0))}
                className="border border-brand-border rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
              />
              <span className="text-[9px] text-gray-400">0-150 FPM = 0 QAR</span>
            </div>
          </div>

          <div className="flex gap-6 pt-2">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isDiverted}
                onChange={(e) => setIsDiverted(e.target.checked)}
                className="rounded accent-brand animate-pulse"
              />
              Diverted Flight
            </label>

            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isSplit}
                onChange={(e) => setIsSplit(e.target.checked)}
                className="rounded accent-brand"
              />
              Split Flight (Co-pilot share)
            </label>
          </div>
        </div>

        {/* Right Side - Results Preview */}
        <div className="bg-brand-pale/40 border border-brand-border/40 rounded-2xl p-5 space-y-4">
          <div className="border-b border-brand-border/30 pb-3">
            <span className="text-[10px] uppercase font-bold text-gray-450">Net Profit</span>
            <div className="flex justify-between items-baseline mt-0.5">
              <span className={`text-2xl font-black ${netProfit >= 0 ? "text-green-700" : "text-rose-700"}`}>
                {netProfit.toLocaleString()} QAR
              </span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${netProfit >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {profitMargin.toFixed(1)}% Margin
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-400 font-bold block mb-1">Gross Revenue</span>
              <span className="font-extrabold text-gray-700">{grossRevenue.toLocaleString()} QAR</span>
            </div>
            <div>
              <span className="text-gray-400 font-bold block mb-1">Total Expenses</span>
              <span className="font-extrabold text-gray-700">{totalExpenses.toLocaleString()} QAR</span>
            </div>
          </div>

          <div className="border-t border-brand-border/30 pt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">🎟️ Passenger Revenue ({paxCount} pax × {flightTime} m):</span>
              <span className="font-black text-gray-700">{grossRevenue.toLocaleString()} QAR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">✈️ Operating Cost (70% + 5% var):</span>
              <span className="font-black text-rose-700">-{operatingCost.toLocaleString()} QAR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">⛽ Fuel Cost ({fuelBurned.toLocaleString()} kg):</span>
              <span className="font-black text-rose-700">-{fuelCost.toLocaleString()} QAR</span>
            </div>
            {landingPenalty > 0 ? (
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">💥 Landing Penalty ({landingFpm} FPM):</span>
                <span className="font-black text-rose-700">-{landingPenalty.toLocaleString()} QAR</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">🧈 Touchdown ({landingFpm} FPM):</span>
                <span className="font-black text-emerald-600">0 QAR (Smooth)</span>
              </div>
            )}
            {isDiverted && (
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">🔀 Diversion Care Surcharge:</span>
                <span className="font-black text-rose-700">-{diversionCharge.toLocaleString()} QAR</span>
              </div>
            )}
          </div>

          <div className="border-t border-brand-border/30 pt-3 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <div>
                <span className="text-gray-500 font-bold block">Overall Leg Reputation:</span>
                <span className="text-[9px] text-gray-400">Punctuality: {punctualityScore.toFixed(0)}% | Landing: {landingScore.toFixed(0)}%</span>
              </div>
              <span className="text-sm font-black text-brand">{repRating.toFixed(2)} / 5.00 ★</span>
            </div>

            <div className="flex justify-between items-center text-xs bg-white border border-brand-border/40 p-2.5 rounded-xl">
              <div>
                <span className="text-gray-700 font-black block">Pilot Payout Preview:</span>
                <span className="text-[9px] text-gray-400">
                  {isSplit 
                    ? `Split Payout (Share: ${(payoutShareSplit*100).toFixed(0)}% | Floor: ${minPayoutSplit} QAR)` 
                    : `Solo Payout (Share: ${(payoutShareSolo*100).toFixed(0)}% | Floor: ${minPayoutSolo} QAR)`}
                </span>
              </div>
              <span className="text-sm font-black text-green-700 font-mono">
                {isSplit ? `${splitSalary.toLocaleString()} QAR` : `${soloSalary.toLocaleString()} QAR`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PaxSimulatorPanel() {
  const specs = useAppSelector((s) => s.aircraft.specs) || {};
  const [isOpen, setIsOpen] = useState(false);
  const [paxCount, setPaxCount] = useState(150);
  const [aircraftIcao, setAircraftIcao] = useState("A320");
  const [flightNumber, setFlightNumber] = useState("QR100");
  const [origin, setOrigin] = useState("OTHH");
  const [destination, setDestination] = useState("DNMM");

  const [liveAircraft, setLiveAircraft] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLiveAircraft = async () => {
      try {
        setLoading(true);
        const data = await api.get<any[]>("/aircraft");
        setLiveAircraft(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to fetch live fleet");
      } finally {
        setLoading(false);
      }
    };
    fetchLiveAircraft();
  }, []);

  const capacity = specs[aircraftIcao]?.properties?.capacity || 180;

  return (
    <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6 space-y-6">
      <div>
        <h3 className="text-lg font-black text-brand-dark flex items-center gap-1.5 border-b border-brand-border/40 pb-2.5 uppercase tracking-wider">
          🎬 Boarding Animation Simulator
        </h3>
        <p className="text-gray-400 text-xs mt-1">Preview passenger Manifest Odometers, Seat grids, and boarding animations.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-500">Passenger Count</label>
          <input
            type="number"
            value={paxCount}
            onChange={(e) => setPaxCount(Number(e.target.value) || 0)}
            className="border border-brand-border rounded-xl px-3 py-2 text-xs focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-500">Aircraft Model (ICAO)</label>
          <select
            value={aircraftIcao}
            onChange={(e) => setAircraftIcao(e.target.value)}
            className="border border-brand-border rounded-xl px-3 py-2 text-xs focus:outline-none"
          >
            {Object.keys(specs).map((k) => (
              <option key={k} value={k}>
                {k} (Cap: {specs[k]?.properties?.capacity || 180})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-500">Flight Number</label>
          <input
            type="text"
            value={flightNumber}
            onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
            className="border border-brand-border rounded-xl px-3 py-2 text-xs focus:outline-none uppercase"
          />
        </div>
        <div className="flex flex-col gap-1 col-span-1">
          <label className="text-xs font-bold text-gray-500">Origin / Departure</label>
          <input
            type="text"
            maxLength={4}
            value={origin}
            onChange={(e) => setOrigin(e.target.value.toUpperCase())}
            className="border border-brand-border rounded-xl px-3 py-2 text-xs focus:outline-none uppercase"
          />
        </div>
        <div className="flex flex-col gap-1 col-span-1">
          <label className="text-xs font-bold text-gray-500">Destination / Arrival</label>
          <input
            type="text"
            maxLength={4}
            value={destination}
            onChange={(e) => setDestination(e.target.value.toUpperCase())}
            className="border border-brand-border rounded-xl px-3 py-2 text-xs focus:outline-none uppercase"
          />
        </div>
      </div>

      {/* Live Fleet DB Connection Checker */}
      <div className="bg-gray-50 border border-brand-border rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-500 flex items-center gap-1.5 uppercase">
            🔌 DB & Backend Connection Status
          </h4>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${error ? "bg-red-100 text-red-700" : loading ? "bg-gray-100 text-gray-500 animate-pulse" : "bg-green-100 text-green-700"}`}>
            {error ? "OFFLINE" : loading ? "CHECKING..." : "CONNECTED"}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {loading ? (
            <span className="text-xs text-gray-400">Loading aircraft registrations from DB...</span>
          ) : error ? (
            <span className="text-xs text-red-500 font-semibold text-center py-1">❌ Connection Error: {error}</span>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400">SELECT LIVE AIRFRAME (FROM DATABASE)</label>
              <select
                className="w-full border border-brand-border bg-white rounded-xl px-3 py-1.5 text-xs focus:outline-none font-semibold text-brand"
                onChange={(e) => {
                  const reg = e.target.value;
                  if (!reg) return;
                  const found = liveAircraft.find(a => a.registration === reg);
                  if (found) {
                    alert(`Selected: ${found.registration}\nType: ${found.aircraft_type_name || "N/A"}\nStatus: ${found.status}\nCurrent Airport: ${found.current_airport || "N/A"}`);
                  }
                }}
              >
                <option value="">-- {liveAircraft.length} Live Aircraft Found --</option>
                {liveAircraft.map((a) => (
                  <option key={a.id} value={a.registration}>
                    {a.registration} - {a.aircraft_type_name || "ICAO"} ({a.status})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-brand-dark text-white font-black py-3 rounded-2xl text-xs transition-all shadow-md cursor-pointer hover:opacity-90"
      >
        ⚡ Launch Boarding Simulation
      </button>

      {/* Pax Boarding Preview Modal */}
      <PaxBoardingModal
        isOpen={isOpen}
        finalPaxCount={paxCount}
        aircraftIcao={aircraftIcao}
        flightNumber={flightNumber}
        origin={origin}
        destination={destination}
        seatCapacity={capacity}
        onComplete={() => setIsOpen(false)}
      />
    </div>
  );
}

