import { useEffect, useState, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { useCurrency } from "../hooks/useCurrency";
import { api } from "../api/client";
import { AdminBiddingPage } from "./admin/AdminBiddingPage";
import PaxBoardingModal from "../components/efb/briefing/PaxBoardingModal";
import { isFleetAircraft } from "../utils/aircraftCategories";
import {
  fetchSettings,
  updateSetting,
  enrollPilot,
  fetchEnrolledPilots,
  updateSimbriefId,
} from "../store/slices/adminSlice";
import { fetchPilots } from "../store/slices/pilotSlice";
import {
  fetchAirframes,
  fetchAircraftTypes,
  updateAirframe,
} from "../store/slices/aircraftSlice";
import { fetchTransfers, reviewTransfer } from "../store/slices/transferSlice";
import {
  fetchWaves,
  createWave,
  deleteWave,
} from "../store/slices/scheduleSlice";

type Tab =
  | "pilots"
  | "aircraft"
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
  const { pilots } = useAppSelector((s) => s.pilot);
  const { airframes, types } = useAppSelector((s) => s.aircraft);
  const { transfers } = useAppSelector((s) => s.transfer);
  const user = useAppSelector((s) => s.auth.user);
  const [tab, setTab] = useState<Tab>("pilots");

  const isEligibleForRates = user && user.callsign && ["QRV001", "QRV002", "QRV003", "QRV004"].includes(user.callsign.toUpperCase());

  const tabs: { key: Tab; label: string }[] = [
    { key: "pilots", label: "Pilots" },
    { key: "aircraft", label: "Aircraft" },
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
    dispatch(fetchPilots({}));
    dispatch(fetchAirframes());
    dispatch(fetchAircraftTypes());
    dispatch(fetchTransfers());
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
      {tab === "aircraft" && <AircraftTab />}
      {tab === "transfers" && <TransfersTab />}
      {tab === "waves" && <WavesTab />}
      {tab === "settings" && <SettingsTab />}
      {tab === "rates" && isEligibleForRates && <RatesTab />}
    </div>
  );
}

export function PilotsTab() {
  const dispatch = useAppDispatch();
  const { enrolled } = useAppSelector((s) => s.admin);

  const [searchQuery, setSearchQuery] = useState("");
  const [pilotSimbriefIds, setPilotSimbriefIds] = useState<Record<number, string>>({});
  const [pilotLifts, setPilotLifts] = useState<Record<number, number>>({});
  const [savingPilotId, setSavingPilotId] = useState<number | null>(null);

  useEffect(() => {
    dispatch(fetchEnrolledPilots());
  }, [dispatch]);

  const handleSavePilotSettings = async (p: any) => {
    setSavingPilotId(p.id);
    try {
      const rawSId = pilotSimbriefIds[p.id] !== undefined ? pilotSimbriefIds[p.id] : (p.simbrief_id ?? "");
      const sIdStr = String(rawSId).trim();
      const parsedSimbrief = sIdStr ? parseInt(sIdStr, 10) : null;
      if (parsedSimbrief !== p.simbrief_id) {
        await dispatch(updateSimbriefId({ pilot_id: p.id, simbrief_id: parsedSimbrief }));
      }

      const liftsVal = pilotLifts[p.id] !== undefined ? pilotLifts[p.id] : (p.lifts || 0);

      await api.post("/admin/update-pilot", {
        pilot_id: p.id,
        lifts: liftsVal,
      });

      alert(`Updated settings for ${p.callsign}!`);
      dispatch(fetchEnrolledPilots());
    } catch (err: any) {
      alert("Failed to update pilot: " + (err.message || "Unknown error"));
    } finally {
      setSavingPilotId(null);
    }
  };

  const [enrollCallsign, setEnrollCallsign] = useState("");
  const [enrollSimbrief, setEnrollSimbrief] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const handleEnrollByCallsign = async () => {
    if (!enrollCallsign.trim()) {
      alert("Please enter a pilot callsign!");
      return;
    }
    setEnrolling(true);
    try {
      const sId = enrollSimbrief.trim() ? parseInt(enrollSimbrief.trim(), 10) : null;
      const res = await api.post<{ detail: string }>("/admin/enroll-by-callsign", {
        callsign: enrollCallsign.trim(),
        simbrief_id: sId,
      });
      alert(res.detail || "Pilot enrolled successfully!");
      setEnrollCallsign("");
      setEnrollSimbrief("");
      dispatch(fetchEnrolledPilots());
    } catch (err: any) {
      alert("Failed to enroll pilot: " + (err.message || "Unknown error"));
    } finally {
      setEnrolling(false);
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

  const filteredEnrolled = filterPilots(enrolled);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-brand">Pilot Fleet Management</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manage enrolled pilots, SimBrief IDs, and lifts.</p>
          </div>
          <input
            type="text"
            placeholder="Search enrolled pilots by callsign or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-brand-border rounded-xl px-4 py-2 text-xs w-full sm:w-72 focus:outline-none focus:border-brand"
          />
        </div>

        {/* Quick Enroll Box */}
        <div className="bg-brand-pale/80 p-4 rounded-2xl border border-brand-border mb-8 shadow-xs">
          <h3 className="text-xs font-black uppercase tracking-wider text-brand mb-2 flex items-center gap-1.5">
            <span>Quick Enroll Pilot by Callsign (Grants Award 9)</span>
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              placeholder="Enter Callsign (e.g. QRV001)..."
              value={enrollCallsign}
              onChange={(e) => setEnrollCallsign(e.target.value)}
              className="border border-brand-border rounded-xl px-3.5 py-2 text-xs font-bold w-full sm:w-64 bg-white focus:outline-none focus:border-brand"
            />
            <input
              type="text"
              placeholder="SimBrief ID (Optional)..."
              value={enrollSimbrief}
              onChange={(e) => setEnrollSimbrief(e.target.value)}
              className="border border-brand-border rounded-xl px-3.5 py-2 text-xs font-mono w-full sm:w-48 bg-white focus:outline-none focus:border-brand"
            />
            <button
              disabled={enrolling}
              onClick={handleEnrollByCallsign}
              className="w-full sm:w-auto text-xs font-black uppercase tracking-wider bg-brand text-white px-5 py-2 rounded-xl hover:bg-brand-dark transition-all cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap"
            >
              {enrolling ? "Enrolling..." : "+ Enroll Pilot"}
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 mb-3 flex items-center gap-2">
            <span>Enrolled Active Pilots ({filteredEnrolled.length})</span>
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredEnrolled.map((p) => {
              const currentLifts = pilotLifts[p.id] !== undefined ? pilotLifts[p.id] : (p.lifts || 0);
              const isSaving = savingPilotId === p.id;

              return (
                <div
                  key={p.id}
                  className="flex flex-col p-4 bg-emerald-50/40 rounded-2xl border border-emerald-200/80 shadow-xs gap-3.5"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-emerald-200/60 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base text-brand">{p.callsign}</span>
                        <span className="text-[10px] font-bold text-gray-500">({p.name})</span>
                        {currentLifts > 0 && (
                          <span className="text-[9px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-full">
                            ★ {currentLifts} Lift{currentLifts > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      disabled={isSaving}
                      onClick={() => handleSavePilotSettings(p)}
                      className="text-xs font-black uppercase tracking-wider bg-brand text-white px-3.5 py-1.5 rounded-xl hover:bg-brand-dark transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save All"}
                    </button>
                  </div>

                  {/* Grid of Edit Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* 1. Lifts Counter */}
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200/80 flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-gray-500">Lifts Provided</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPilotLifts(prev => ({ ...prev, [p.id]: Math.max(0, currentLifts - 1) }))}
                          className="w-6 h-6 rounded-lg bg-gray-100 font-bold text-gray-700 hover:bg-gray-200 flex items-center justify-center cursor-pointer"
                        >-</button>
                        <span className="font-mono font-black text-sm px-2">{currentLifts}</span>
                        <button
                          type="button"
                          onClick={() => setPilotLifts(prev => ({ ...prev, [p.id]: currentLifts + 1 }))}
                          className="w-6 h-6 rounded-lg bg-gray-100 font-bold text-gray-700 hover:bg-gray-200 flex items-center justify-center cursor-pointer"
                        >+</button>
                      </div>
                    </div>

                    {/* 2. SimBrief ID */}
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-200/80 flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-gray-500">SimBrief ID</label>
                      <input
                        type="text"
                        placeholder="Not set"
                        value={pilotSimbriefIds[p.id] !== undefined ? pilotSimbriefIds[p.id] : (p.simbrief_id || "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPilotSimbriefIds(prev => ({ ...prev, [p.id]: val }));
                        }}
                        className="border border-brand-border rounded-lg px-2.5 py-1 text-xs font-mono bg-white focus:outline-none focus:border-brand"
                      />
                    </div>
                  </div>

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

/* ─── AIRCRAFT TAB ─── */

export function AircraftTab() {
  const dispatch = useAppDispatch();
  const { airframes } = useAppSelector((s) => s.aircraft);
  const [editStatus, setEditStatus] = useState<Record<number, string>>({});

  useEffect(() => {
    dispatch(fetchAirframes());
    dispatch(fetchAircraftTypes());
  }, [dispatch]);

  const fleetAirframes = useMemo(() => {
    return airframes.filter((a) => isFleetAircraft(a.registration));
  }, [airframes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-brand">Fleet Management</h2>
      </div>

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
              {fleetAirframes.map((a) => (
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

  useEffect(() => {
    dispatch(fetchWaves({}));
  }, []);

  const handleCreate = async () => {
    if (!name || !start || !end) return;
    await dispatch(
      createWave({
        name,
        wave_type: waveType,
        departure_window_start: start,
        departure_window_end: end,
      })
    );
    setName("");
    dispatch(fetchWaves({}));
  };

  const depWaves = waves.filter((w) => w.wave_type === "departure");
  const arrWaves = waves.filter((w) => w.wave_type === "arrival");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-brand">Wave Management</h2>

      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6">
        <h3 className="text-lg font-bold text-brand mb-4">Create Lifetime Wave</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
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
        </div>
        <button
          onClick={handleCreate}
          className="rounded-full bg-brand text-white font-semibold text-sm px-5 py-2"
        >
          Create
        </button>
        <p className="text-xs text-gray-400 mt-2">
          Waves are reusable and remain active for every week. Typical DOH waves:
          Morning arrivals 04-07, departures 07-09; evening arrivals 16-19,
          departures 19-21.
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
                  {w.departure_window_start} → {w.departure_window_end}
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
                  {w.departure_window_start} → {w.departure_window_end}
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

      {/* Discord Fleet Logs Webhook Card */}
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-brand-border/40 pb-3">
          <div>
            <h3 className="text-lg font-black text-brand-dark flex items-center gap-2">
              <span>💬</span> Discord #fleet-logs Webhook
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Configure the Webhook URL for publishing live enroute status & parked flight movement logs with pilot mentions.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="https://discord.com/api/webhooks/..."
            defaultValue={settings.find(s => s.setting_key === "discord_fleet_logs_webhook_url")?.setting_value || ""}
            onBlur={async (e) => {
              const val = e.target.value.trim();
              const current = settings.find(s => s.setting_key === "discord_fleet_logs_webhook_url")?.setting_value;
              if (val !== current) {
                const res = await dispatch(
                  updateSetting({
                    key: "discord_fleet_logs_webhook_url",
                    value: val,
                  })
                );
                if (updateSetting.fulfilled.match(res)) {
                  alert("Discord fleet logs webhook URL saved!");
                  dispatch(fetchSettings());
                } else {
                  alert("Failed to save webhook URL: " + (res.error?.message || "Unknown error"));
                }
              }
            }}
            className="w-full border border-brand-border bg-gray-50/50 rounded-xl px-4 py-2.5 text-xs font-mono focus:bg-white focus:border-brand focus:outline-none"
          />
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

      {/* IF Live Tracking Status */}
      <TrackingPanel />

      {/* Embedded Leg Economics Simulator & Pax Boarding Simulator */}
      <div className="flex flex-col gap-6">
        <LegSimulatorPanel />
        <PaxSimulatorPanel />
      </div>
    </div>
  );
}


export function TrackingPanel() {
  const [trackStatus, setTrackStatus] = useState<any>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackMsg, setTrackMsg] = useState("");

  const fetchStatus = async () => {
    try {
      const res = await api.get<any>("/tracking/status");
      setTrackStatus(res);
    } catch {
      setTrackStatus(null);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleSync = async () => {
    setTrackLoading(true);
    setTrackMsg("");
    try {
      const res = await api.post<any>("/tracking/sync");
      setTrackStatus(res);
      setTrackMsg("Sync completed.");
    } catch (e: any) {
      setTrackMsg(e.message || "Sync failed");
    }
    setTrackLoading(false);
  };

  return (
    <div className="card bg-base-100 border border-brand-border shadow-sm">
      <div className="card-body p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="card-title text-xl font-bold text-brand m-0">IF Live Tracking</h3>
          <span className={`badge ${trackStatus?.last_sync_at ? "badge-success" : "badge-ghost"} badge-sm font-bold`}>
            {trackStatus?.last_sync_at ? "Active" : "Idle"}
          </span>
        </div>

        {trackStatus && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="stat bg-base-200 rounded-xl p-3">
              <div className="stat-title text-[9px]">Last Sync</div>
              <div className="stat-value text-xs">
                {trackStatus.last_sync_at ? new Date(trackStatus.last_sync_at).toLocaleTimeString("en-GB") : "Never"}
              </div>
            </div>
            <div className="stat bg-primary/5 rounded-xl p-3">
              <div className="stat-title text-[9px]">Active Flights</div>
              <div className="stat-value text-lg text-primary">{trackStatus.active_flights_on_server ?? "—"}</div>
            </div>
            <div className="stat bg-success/10 rounded-xl p-3">
              <div className="stat-title text-[9px]">Dispatched</div>
              <div className="stat-value text-lg text-success">{trackStatus.dispatched_this_cycle ?? "—"}</div>
            </div>
            <div className="stat bg-error/10 rounded-xl p-3">
              <div className="stat-title text-[9px]">No-Shows</div>
              <div className="stat-value text-lg text-error">{trackStatus.no_shows_this_cycle ?? "—"}</div>
            </div>
          </div>
        )}

        {trackStatus?.last_error && (
          <div className="alert alert-error text-xs">{trackStatus.last_error}</div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={trackLoading}
            className="btn btn-primary btn-sm"
          >
            {trackLoading ? <span className="loading loading-spinner loading-xs" /> : null}
            {trackLoading ? "Syncing..." : "Force Sync Now"}
          </button>
          <button
            onClick={fetchStatus}
            className="btn btn-outline btn-sm"
          >
            Refresh Status
          </button>
        </div>

        {trackMsg && (
          <div className="alert text-sm">{trackMsg}</div>
        )}

        <p className="text-[10px] text-gray-400">
          Automatically syncs every 60 seconds. Matches IF Expert server flights to booked schedules by callsign.
        </p>
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
  const { currency, formatAmount } = useCurrency();
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
              <span className="text-[9px] text-gray-400">0-150 FPM = {formatAmount(0)}</span>
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
                {formatAmount(netProfit)}
              </span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${netProfit >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {profitMargin.toFixed(1)}% Margin
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-400 font-bold block mb-1">Gross Revenue</span>
              <span className="font-extrabold text-gray-700">{formatAmount(grossRevenue)}</span>
            </div>
            <div>
              <span className="text-gray-400 font-bold block mb-1">Total Expenses</span>
              <span className="font-extrabold text-gray-700">{formatAmount(totalExpenses)}</span>
            </div>
          </div>

          <div className="border-t border-brand-border/30 pt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">🎟️ Passenger Revenue ({paxCount} pax × {flightTime} m):</span>
              <span className="font-black text-gray-700">{formatAmount(grossRevenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">✈️ Operating Cost (70% + 5% var):</span>
              <span className="font-black text-rose-700">-{formatAmount(operatingCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">⛽ Fuel Cost ({fuelBurned.toLocaleString()} kg):</span>
              <span className="font-black text-rose-700">-{formatAmount(fuelCost)}</span>
            </div>
            {landingPenalty > 0 ? (
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">💥 Landing Penalty ({landingFpm} FPM):</span>
                <span className="font-black text-rose-700">-{formatAmount(landingPenalty)}</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">🧈 Touchdown ({landingFpm} FPM):</span>
                <span className="font-black text-emerald-600">{formatAmount(0)} (Smooth)</span>
              </div>
            )}
            {isDiverted && (
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">🔀 Diversion Care Surcharge:</span>
                <span className="font-black text-rose-700">-{formatAmount(diversionCharge)}</span>
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
                    ? `Split Payout (Share: ${(payoutShareSplit*100).toFixed(0)}% | Floor: ${formatAmount(minPayoutSplit)})` 
                    : `Solo Payout (Share: ${(payoutShareSolo*100).toFixed(0)}% | Floor: ${formatAmount(minPayoutSolo)})`}
                </span>
              </div>
              <span className="text-sm font-black text-green-700 font-mono">
                {isSplit ? formatAmount(splitSalary) : formatAmount(soloSalary)}
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

