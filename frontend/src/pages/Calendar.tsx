import { useEffect, useMemo, useState, Fragment } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  fetchSchedules, createSchedule, updateSchedule, deleteSchedule,
  approveSchedule, rejectSchedule, proposeSchedule, bulkApproveSchedules, fetchWaves,
} from "../store/slices/scheduleSlice";
import { createBooking, cancelBooking } from "../store/slices/bookingSlice";
import { fetchGroups } from "../store/slices/groupSlice";
import { fetchAirframes, fetchAircraftTypes } from "../store/slices/aircraftSlice";
import { fetchMyProfile } from "../store/slices/pilotSlice";
import { api } from "../api/client";

interface AvailableRoute { id: number; fltnum: string; dep: string; arr: string; duration: number; notes: string | null; }
interface PositionError { aircraftId: number; registration: string; scheduleId: number; expectedDep: string; actualDep: string; status: "ok" | "mismatch" | "ground_short"; }
interface FlightBlock { schedule: any; col: number; rowStart: number; rowEnd: number; isError: boolean; isGroundIssue: boolean; showGroundTime: boolean; subCol: number; maxSubCols: number; }

function getISOWeek(dateString: string) {
  const date = new Date(dateString + "T00:00:00Z");
  const tdt = new Date(date.valueOf());
  const dayn = (date.getUTCDay() + 6) % 7;
  tdt.setUTCDate(tdt.getUTCDate() - dayn + 3);
  const firstThu = tdt.valueOf();
  tdt.setUTCMonth(0, 1);
  if (tdt.getUTCDay() !== 4) {
    tdt.setUTCMonth(0, 1 + ((4 - tdt.getUTCDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThu - tdt.valueOf()) / 604800000);
}

export default function Calendar() {
  const dispatch = useAppDispatch();
  const { schedules, waves } = useAppSelector((s) => s.schedule);
  const { groups } = useAppSelector((s) => s.group);
  const { airframes, types } = useAppSelector((s) => s.aircraft);
  const { currentPilot } = useAppSelector((s) => s.pilot);

  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(getWeekStart);
  const [filterAircraftId, setFilterAircraftId] = useState(0);
  const [filterAircraftTypeId, setFilterAircraftTypeId] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>("active");
  const [popup, setPopup] = useState<{ day: number; hour: number; position: string } | null>(null);
  const [selAircraftId, setSelAircraftId] = useState(0);
  const [selRouteId, setSelRouteId] = useState(0);
  const [selTime, setSelTime] = useState("00:00");
  const [selGroundTime, setSelGroundTime] = useState(60);
  const [selOverrideDep, setSelOverrideDep] = useState("");
  const [availableRoutes, setAvailableRoutes] = useState<AvailableRoute[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [editDepTime, setEditDepTime] = useState("");
  const [editArrTime, setEditArrTime] = useState("");
  const [updatingTime, setUpdatingTime] = useState(false);
  const [bookings, setBookings] = useState<Record<number, any[]>>({});
  const [myBookingsFilter, setMyBookingsFilter] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const user = useAppSelector((s: any) => s.auth.user);

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const HOUR_HEIGHT = 40;
  const HEADER_HEIGHT = 36;

  useEffect(() => {
    dispatch(fetchGroups());
    dispatch(fetchAircraftTypes());
    dispatch(fetchMyProfile());
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") { setPopup(null); setEditingSchedule(null); } };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (groups.length > 0) {
      const activeGroupIds = groups.map(g => g.id);
      if (currentPilot && currentPilot.group_id && activeGroupIds.includes(currentPilot.group_id)) {
        setActiveGroup(currentPilot.group_id);
      } else if (activeGroup === null || !activeGroupIds.includes(activeGroup)) {
        setActiveGroup(groups[0].id);
      }
    }
  }, [groups, currentPilot]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeGroup) {
      const apiStatus = statusFilter === "active" ? undefined : (statusFilter || undefined);
      dispatch(fetchSchedules({ group_id: activeGroup, week_start: weekStart, status: apiStatus }));
      dispatch(fetchWaves({ week_start: weekStart }));
      dispatch(fetchAirframes({ group_id: activeGroup }));
    }
  }, [activeGroup, weekStart, statusFilter]);

  // Fetch bookings for displayed schedules
  useEffect(() => {
    if (schedules.length === 0) { setBookings({}); return; }
    const ids = schedules.map(s => s.id).join(",");
    api.get<any[]>(`/bookings?schedule_ids=${ids}`).then(bs => {
      const map: Record<number, any[]> = {};
      for (const b of bs) { if (!map[b.schedule_id]) map[b.schedule_id] = []; map[b.schedule_id].push(b); }
      setBookings(map);
    }).catch(() => setBookings({}));
  }, [schedules]);

  useEffect(() => {
    if (editingSchedule) {
      setEditDepTime(editingSchedule.scheduled_departure);
      setEditArrTime(editingSchedule.scheduled_arrival);
    }
  }, [editingSchedule]);

  function getWeekStart() { const d = new Date(); d.setUTCDate(d.getUTCDate() - d.getUTCDay() + 1); return d.toISOString().split("T")[0]; }
  function getSlotDate(day: number, hour: number): Date { const d = new Date(weekStart + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + day); d.setUTCHours(hour, 0, 0, 0); return d; }

  const baseSchedules = useMemo(() => {
    let bs = statusFilter === "active" ? schedules.filter(s => s.status !== "cancelled") : schedules;
    if (myBookingsFilter && user) {
      const myBkdIds = new Set(Object.entries(bookings).filter(([_, bs]) => 
        bs.some((b: any) => b.departure_pilot_id === user.id || b.arrival_pilot_id === user.id)).map(([sid]) => Number(sid)));
      bs = bs.filter(s => myBkdIds.has(s.id));
    }
    return bs;
  }, [schedules, statusFilter, myBookingsFilter, bookings, user]);

  const filteredSchedules = useMemo(() => {
    let bs = baseSchedules;
    if (filterAircraftId) {
      bs = bs.filter(s => Number(s.aircraft_id) === Number(filterAircraftId));
    }
    if (filterAircraftTypeId) {
      const typeAirframeIds = new Set(airframes.filter(a => a.aircraft_type_id === filterAircraftTypeId).map(a => a.id));
      bs = bs.filter(s => typeAirframeIds.has(Number(s.aircraft_id)));
    }
    return bs;
  }, [baseSchedules, filterAircraftId, filterAircraftTypeId, airframes]);

  const weekNumber = useMemo(() => getISOWeek(weekStart), [weekStart]);
  const weekDateRange = useMemo(() => {
    const start = new Date(weekStart + "T00:00:00Z");
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    return `${startStr} - ${endStr}`;
  }, [weekStart]);

  const weekStatus = useMemo(() => {
    const today = new Date();
    const currentStart = new Date();
    currentStart.setUTCDate(currentStart.getUTCDate() - ((currentStart.getUTCDay() + 6) % 7));
    const currentStartStr = currentStart.toISOString().split("T")[0];

    const nextStart = new Date(currentStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextStartStr = nextStart.toISOString().split("T")[0];

    if (weekStart === currentStartStr) {
      return { label: "Current Week", style: "bg-green-100 text-green-800 border-green-200" };
    } else if (weekStart === nextStartStr) {
      const day = today.getUTCDay();
      const isWeekend = day === 6 || day === 0;
      if (isWeekend) {
        return { label: "Scheduling Week", style: "bg-amber-100 text-amber-800 border-amber-200" };
      }
      return { label: "Next Week", style: "bg-blue-100 text-blue-800 border-blue-200" };
    } else if (weekStart < currentStartStr) {
      return { label: "Past Week", style: "bg-gray-100 text-gray-500 border-gray-200" };
    } else {
      return { label: "Future Week", style: "bg-purple-100 text-purple-800 border-purple-200" };
    }
  }, [weekStart]);

  const isCurrentWeek = useMemo(() => {
    const currentStart = new Date();
    currentStart.setUTCDate(currentStart.getUTCDate() - ((currentStart.getUTCDay() + 6) % 7));
    const currentStartStr = currentStart.toISOString().split("T")[0];
    return weekStart === currentStartStr;
  }, [weekStart]);

  const liveUTCInfo = useMemo(() => {
    const day = currentTime.getUTCDay();
    const col = day === 0 ? 6 : day - 1;
    const hr = currentTime.getUTCHours() + currentTime.getUTCMinutes() / 60;
    return { col, hr };
  }, [currentTime]);

  const handlePrevWeek = () => {
    const d = new Date(weekStart + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 7);
    setWeekStart(d.toISOString().split("T")[0]);
  };

  const handleNextWeek = () => {
    const d = new Date(weekStart + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 7);
    setWeekStart(d.toISOString().split("T")[0]);
  };

  const handleCurrentWeek = () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    setWeekStart(d.toISOString().split("T")[0]);
  };

  const handleClonePreviousWeek = async () => {
    if (!activeGroup) return;
    const prevD = new Date(weekStart + "T00:00:00Z");
    prevD.setUTCDate(prevD.getUTCDate() - 7);
    const prevWeekStart = prevD.toISOString().split("T")[0];

    try {
      setCloning(true);
      const prevSchedules = await api.get<any[]>(`/schedules?group_id=${activeGroup}&week_start=${prevWeekStart}`);
      if (!prevSchedules || prevSchedules.length === 0) {
        alert("No schedules found in the previous week to clone.");
        setCloning(false);
        return;
      }

      if (confirm(`Found ${prevSchedules.length} schedules in Week ${getISOWeek(prevWeekStart)} (${prevWeekStart}). Clone them to Week ${getISOWeek(weekStart)} (${weekStart}) as drafts?`)) {
        let clonedCount = 0;
        for (const s of prevSchedules) {
          if (s.status === "cancelled") continue;
          const dep = new Date(s.scheduled_departure + "Z");
          const arr = new Date(s.scheduled_arrival + "Z");
          dep.setUTCDate(dep.getUTCDate() + 7);
          arr.setUTCDate(arr.getUTCDate() + 7);

          await dispatch(createSchedule({
            group_id: activeGroup,
            aircraft_id: s.aircraft_id,
            route_id: s.route_id,
            departure: s.departure,
            arrival: s.arrival,
            flight_number: s.flight_number,
            scheduled_departure: dep.toISOString().slice(0, 19),
            scheduled_arrival: arr.toISOString().slice(0, 19),
            week_start: weekStart,
            ground_time_minutes: s.ground_time_minutes || 60
          }));
          clonedCount++;
        }
        alert(`Successfully cloned ${clonedCount} schedules!`);
        refreshSchedules();
      }
    } catch (err: any) {
      alert("Failed to clone schedules: " + (err.message || err));
    } finally {
      setCloning(false);
    }
  };

  function getAircraftPosition(aircraftId: number, day: number, hour: number): string {
    const ac = airframes.find(a => a.id === aircraftId);
    let pos = ac?.current_airport || "OTHH";
    const flights = baseSchedules.filter(s => s.aircraft_id === aircraftId).sort((a, b) => new Date(a.scheduled_arrival + "Z").getTime() - new Date(b.scheduled_arrival + "Z").getTime());
    const slot = getSlotDate(day, hour);
    for (const f of flights) { if (new Date(f.scheduled_arrival + "Z").getTime() <= slot.getTime()) pos = f.arrival; }
    return pos;
  }

  // Position validation
  const positionErrors = useMemo((): PositionError[] => {
    const errors: PositionError[] = []; const byAircraft: Record<number, any[]> = {};
    for (const s of baseSchedules) { if (!byAircraft[s.aircraft_id]) byAircraft[s.aircraft_id] = []; byAircraft[s.aircraft_id].push(s); }
    for (const [acId, flights] of Object.entries(byAircraft)) {
      const sorted = flights.sort((a, b) => new Date(a.scheduled_departure + "Z").getTime() - new Date(b.scheduled_departure + "Z").getTime());
      const ac = airframes.find(a => a.id === Number(acId));
      for (let i = 0; i < sorted.length; i++) {
        const f = sorted[i]; const expected = i === 0 ? (ac?.current_airport || null) : sorted[i - 1].arrival;
        if (expected && expected !== f.departure) errors.push({ aircraftId: Number(acId), registration: f.aircraft_registration || ac?.registration || `#${acId}`, scheduleId: f.id, expectedDep: expected, actualDep: f.departure, status: "mismatch" });
        if (i > 0) { const prev = sorted[i - 1]; const gap = (new Date(f.scheduled_departure + "Z").getTime() - new Date(prev.scheduled_arrival + "Z").getTime()) / 60000; const min = f.ground_time_minutes || 60; if (gap < min) errors.push({ aircraftId: Number(acId), registration: f.aircraft_registration || ac?.registration || `#${acId}`, scheduleId: f.id, expectedDep: `gap:${Math.round(gap)}min`, actualDep: `need:${min}min`, status: "ground_short" }); }
      }
    }
    return errors;
  }, [baseSchedules, airframes]);

  const errorSet = useMemo(() => new Set(positionErrors.filter(e => e.status === "mismatch").map(e => e.scheduleId)), [positionErrors]);
  const groundSet = useMemo(() => new Set(positionErrors.filter(e => e.status === "ground_short").map(e => e.scheduleId)), [positionErrors]);

  // Flight blocks with overlap detection
  const flightBlocks = useMemo((): FlightBlock[] => {
    const blocks: FlightBlock[] = [];
    for (const s of filteredSchedules) {
      const dep = new Date(s.scheduled_departure + "Z"); const arr = new Date(s.scheduled_arrival + "Z");
      const dCol = dep.getUTCDay() === 0 ? 6 : dep.getUTCDay() - 1; const aCol = arr.getUTCDay() === 0 ? 6 : arr.getUTCDay() - 1;
      const sh = dep.getUTCHours() + dep.getUTCMinutes() / 60; const eh = arr.getUTCHours() + arr.getUTCMinutes() / 60;
      const b = { schedule: s, isError: errorSet.has(s.id), isGroundIssue: groundSet.has(s.id), subCol: 0, maxSubCols: 1 };
      if (dCol === aCol) blocks.push({ ...b, col: dCol, rowStart: Math.max(0, sh), rowEnd: Math.min(24, Math.max(eh, sh + 0.5)), showGroundTime: true });
      else { blocks.push({ ...b, col: dCol, rowStart: Math.max(0, sh), rowEnd: 24, showGroundTime: false }); blocks.push({ ...b, col: aCol, rowStart: 0, rowEnd: Math.max(eh, 0.5), showGroundTime: true }); }
    }
    for (let col = 0; col < 7; col++) {
      const cbs = blocks.filter(b => b.col === col).sort((a, b) => a.rowStart - b.rowStart);
      const groups: FlightBlock[][] = [];
      for (const bl of cbs) { let placed = false; for (const g of groups) { if (g.some(gb => gb.rowStart < bl.rowEnd && gb.rowEnd > bl.rowStart)) { g.push(bl); placed = true; break; } } if (!placed) groups.push([bl]); }
      for (const g of groups) { const slots: (FlightBlock | null)[] = []; for (const bl of g.sort((a, b) => a.rowStart - b.rowStart)) { let i = 0; while (slots[i] && slots[i]!.rowEnd > bl.rowStart) i++; slots[i] = bl; bl.subCol = i; } const max = slots.length; for (const bl of g) bl.maxSubCols = max; }
    }
    return blocks;
  }, [filteredSchedules, errorSet, groundSet]);

  function refreshSchedules() { if (activeGroup) { const s = statusFilter === "active" ? undefined : (statusFilter || undefined); dispatch(fetchSchedules({ group_id: activeGroup, week_start: weekStart, status: s })); } }

  async function openPopup(day: number, hour: number) {
    const pid = filterAircraftId > 0 ? filterAircraftId : 0;
    setSelAircraftId(pid); setSelRouteId(0); setSelTime(`${String(hour).padStart(2, "0")}:00`); setSelGroundTime(60); setSelOverrideDep(""); setAvailableRoutes([]); setEditingSchedule(null);
    setPopup({ day, hour, position: "" });
    if (pid > 0) loadRoutesForAircraft(pid, day, hour);
  }

  async function loadRoutesForAircraft(acId: number, day?: number, hour?: number) {
    setSelAircraftId(acId); setSelRouteId(0); setAvailableRoutes([]); if (!acId) return;
    const d = day ?? popup?.day ?? 0; const h = hour ?? popup?.hour ?? 0;
    const pos = selOverrideDep || getAircraftPosition(acId, d, h);
    setPopup(p => p ? { ...p, position: pos } : p);
    const ac = airframes.find(a => a.id === acId); if (!ac) return;
    setLoadingRoutes(true);
    try { const all = await api.get<AvailableRoute[]>(`/routes/available?aircraft_type_id=${ac.aircraft_type_id}&departure=${pos}`); setAvailableRoutes(all); } catch { setAvailableRoutes([]); }
    setLoadingRoutes(false);
  }

  const selectedRoute = availableRoutes.find(r => r.id === selRouteId);

  async function doCreate() {
    if (!activeGroup || !selAircraftId || !selRouteId || !popup) return;
    const r = selectedRoute; if (!r) return;
    const depIcao = selOverrideDep || popup.position || r.dep;
    const ws = new Date(weekStart + "T00:00:00Z"); ws.setUTCDate(ws.getUTCDate() + popup.day);
    const dd = new Date(`${ws.toISOString().split("T")[0]}T${selTime}:00Z`);
    const ad = new Date(dd.getTime() + r.duration * 1000);
    await dispatch(createSchedule({ group_id: activeGroup, aircraft_id: selAircraftId, route_id: r.id, departure: depIcao, arrival: r.arr, flight_number: r.fltnum?.split(",")[0]?.trim() || null, scheduled_departure: dd.toISOString().slice(0, 19), scheduled_arrival: ad.toISOString().slice(0, 19), week_start: weekStart, ground_time_minutes: selGroundTime }));
    setPopup(null); setSelOverrideDep(""); refreshSchedules();
  }

  function handleDragStart(e: React.DragEvent, id: number) { e.dataTransfer.setData("scheduleId", String(id)); e.dataTransfer.effectAllowed = "move"; const el = e.currentTarget as HTMLElement; el.style.opacity = "0.15"; requestAnimationFrame(() => { el.style.pointerEvents = "none"; }); }
  function handleDragEnd(e: React.DragEvent) { const el = e.currentTarget as HTMLElement; el.style.opacity = ""; el.style.pointerEvents = ""; }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
  async function handleDrop(e: React.DragEvent, day: number, hour: number) {
    e.preventDefault(); const id = Number(e.dataTransfer.getData("scheduleId")); if (!id) return;
    const s = schedules.find(sch => sch.id === id); if (!s) return;
    const ws = new Date(weekStart + "T00:00:00Z"); ws.setUTCDate(ws.getUTCDate() + day);
    const nd = new Date(`${ws.toISOString().split("T")[0]}T${String(hour).padStart(2, "0")}:00Z`);
    const dur = (new Date(s.scheduled_arrival + "Z").getTime() - new Date(s.scheduled_departure + "Z").getTime()) / 1000;
    await dispatch(updateSchedule({ id, data: { scheduled_departure: nd.toISOString().slice(0, 19), scheduled_arrival: new Date(nd.getTime() + dur * 1000).toISOString().slice(0, 19), week_start: weekStart } }));
    refreshSchedules();
  }

  return (
    <div className="w-full px-2 md:px-6 py-3 md:py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl md:text-5xl font-bold text-brand">Schedule Calendar</h1>
      </div>

      {/* Upgraded Control Bar (Visible when group is active) */}
      {activeGroup && (
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4 bg-white border border-brand-border rounded-2xl p-4 shadow-sm">
          {/* Left: Group Selection & Week Navigation */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={activeGroup ?? ""}
              onChange={e => setActiveGroup(e.target.value ? Number(e.target.value) : null)}
              className="border border-brand-border rounded-xl px-3 py-2 bg-white text-xs font-bold text-brand focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
            >
              <option value="">Choose Group...</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>

            {/* Week Navigation */}
            <div className="flex items-center border border-brand-border rounded-xl bg-gray-50 overflow-hidden">
              <button
                onClick={handlePrevWeek}
                className="px-3 py-2 hover:bg-gray-100 border-r border-brand-border text-gray-600 transition-colors text-xs font-bold cursor-pointer"
                title="Previous Week"
              >
                ←
              </button>
              <div className="px-3 py-2 flex items-center gap-2 select-none">
                <span className="text-xs font-black text-brand uppercase">
                  Week {weekNumber}
                </span>
                <span className="text-[10px] text-gray-500 font-semibold hidden sm:inline">
                  ({weekDateRange})
                </span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${weekStatus.style}`}>
                  {weekStatus.label}
                </span>
              </div>
              <button
                onClick={handleNextWeek}
                className="px-3 py-2 hover:bg-gray-100 border-l border-brand-border text-gray-600 transition-colors text-xs font-bold cursor-pointer"
                title="Next Week"
              >
                →
              </button>
            </div>

            <button
              onClick={handleCurrentWeek}
              className={`border border-brand-border hover:bg-brand-hover-bg rounded-xl px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                isCurrentWeek ? "bg-brand text-white border-brand hover:bg-brand" : "bg-white text-gray-600"
              }`}
            >
              Today
            </button>

            {activeGroup && (
              <button
                onClick={handleClonePreviousWeek}
                disabled={cloning}
                className="border border-dashed border-brand text-brand hover:bg-brand-pale rounded-xl px-3 py-2 text-xs font-bold transition-colors disabled:opacity-40 cursor-pointer"
                title="Clone all schedules from last week into this week"
              >
                {cloning ? "Cloning..." : "Clone Last Week"}
              </button>
            )}
          </div>

          {/* Right: Aircraft Filters & User Bookings */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Aircraft Type Filter */}
            <select
              value={filterAircraftTypeId}
              onChange={e => setFilterAircraftTypeId(Number(e.target.value))}
              className="border border-brand-border rounded-xl px-3 py-2 bg-white text-xs font-semibold text-gray-600 focus:outline-none cursor-pointer"
            >
              <option value={0}>Aircraft Type: All</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            {/* Specific Airframe Filter */}
            <select
              value={filterAircraftId}
              onChange={e => setFilterAircraftId(Number(e.target.value))}
              className="border border-brand-border rounded-xl px-3 py-2 bg-white text-xs font-semibold text-gray-600 focus:outline-none cursor-pointer"
            >
              <option value={0}>Fleet: All Registrations</option>
              {airframes.map(a => {
                const t = types.find(ty => ty.id === a.aircraft_type_id);
                return <option key={a.id} value={a.id}>{a.registration} ({t?.name || "?"}{t?.liveryname ? ` ${t.liveryname}` : ""})</option>;
              })}
            </select>

            {user && (
              <button
                onClick={() => setMyBookingsFilter(!myBookingsFilter)}
                className={`rounded-xl text-xs font-bold border px-3 py-2 transition-colors cursor-pointer ${
                  myBookingsFilter ? "bg-blue-500 text-white border-blue-500" : "border-brand-border text-gray-600 bg-white hover:bg-brand-hover-bg"
                }`}
              >
                My Bookings
              </button>
            )}
          </div>
        </div>
      )}

      {/* Warnings & Errors */}
      {activeGroup && (
        <div className="mb-4">
          {positionErrors.filter(e => e.status === "mismatch").map(e => (
            <div key={`e-${e.scheduleId}`} className="bg-rose-100 border border-rose-400 text-rose-950 rounded-xl px-3 py-1.5 text-xs font-bold mb-1 shadow-sm">
              Mismatch: {e.registration}: Expected {e.expectedDep} but flight departs {e.actualDep}
            </div>
          ))}
          {positionErrors.filter(e => e.status === "ground_short").map(e => (
            <div key={`g-${e.scheduleId}`} className="bg-amber-100 border border-amber-400 text-amber-950 rounded-xl px-3 py-1.5 text-xs font-bold mb-1 shadow-sm">
              Ground warning: {e.registration}: Ground {e.expectedDep.replace("gap:", "")} vs req {e.actualDep.replace("need:", "")}
            </div>
          ))}
        </div>
      )}

      {/* Status Filter Tabs & Bulk Actions */}
      {activeGroup && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3 px-1">
          <div className="flex gap-1.5 flex-wrap">
            {[["active", "Active Flights"], [null, "All Statuses"], ["draft", "Drafts"], ["proposed", "Proposed"], ["approved", "Approved"], ["cancelled", "Cancelled"]].map(([v, l]) => (
              <button
                key={v ?? "all"}
                onClick={() => setStatusFilter(v)}
                className={`rounded-xl text-xs font-bold border px-3 py-1.5 transition-all cursor-pointer ${
                  statusFilter === v ? "bg-brand text-white border-brand shadow-sm" : "border-brand-border bg-white text-gray-500 hover:bg-brand-hover-bg hover:text-brand"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (confirm("Approve all proposed flights for this week?")) {
                dispatch(bulkApproveSchedules({ group_id: activeGroup, week_start: weekStart })).then(refreshSchedules);
              }
            }}
            className="rounded-xl bg-green-600 text-white font-bold text-xs px-4 py-2 hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Approve Proposed Flights
          </button>
        </div>
      )}

      {/* Main Page Content */}
      {activeGroup ? (
        <div className="bg-white rounded-xl md:rounded-2xl border border-brand-border shadow-sm overflow-auto max-h-[75vh] -mx-2 md:mx-0">
          {/* Main scrollable grid table container (Single grid handles both header and cells sticky placement) */}
          <div className="grid grid-cols-[45px_repeat(7,minmax(85px,1fr))] md:grid-cols-[70px_repeat(7,minmax(120px,1fr))] relative z-0 min-w-[700px] md:min-w-[900px]" style={{ minHeight: HEADER_HEIGHT + 24 * HOUR_HEIGHT }}>
            
            {/* UTC Top-Left Corner Cell (sticky left and top) */}
            <div className="border-b border-r border-brand-border bg-brand-pale p-2 text-[10px] font-bold text-gray-500 text-center sticky left-0 top-0 z-40 flex items-center justify-center" style={{ height: HEADER_HEIGHT }}>UTC</div>
            
            {/* Day Headers (sticky top) */}
            {days.map((d, i) => {
              const dt = new Date(weekStart + "T00:00:00Z");
              dt.setUTCDate(dt.getUTCDate() + i);
              return (
                <div key={`h-${d}`} className="border-b border-r border-brand-border bg-brand-pale p-2 text-[10px] font-bold text-gray-500 text-center sticky top-0 z-30 flex items-center justify-center" style={{ height: HEADER_HEIGHT }}>
                  {d} {dt.getUTCDate()}/{dt.getUTCMonth() + 1}
                </div>
              );
            })}
            
            {/* Grid Body Cells rendered as flat elements using React Fragments */}
            {Array.from({ length: 24 }, (_, h) => (
              <Fragment key={`row-${h}`}>
                {/* Sticky Time Column Cells (sticky left) */}
                <div className="border-b border-r border-brand-border p-1 text-[9px] text-gray-500 text-center font-mono bg-brand-pale flex items-center justify-center sticky left-0 z-20" style={{ height: HOUR_HEIGHT }}>
                  {String(h).padStart(2, "0")}:00
                </div>
                {/* Day hourly slots */}
                {days.map((_, di) => (
                  <div key={`cell-${di}-${h}`} onClick={() => openPopup(di, h)} onDragOver={handleDragOver} onDrop={e => handleDrop(e, di, h)} className="border-b border-r border-brand-border cursor-pointer hover:bg-brand-hover-bg/40 transition-colors" style={{ height: HOUR_HEIGHT }} />
                ))}
              </Fragment>
            ))}

            {/* Waves background blocks */}
            {waves.filter(w => w.week_start === weekStart).map(w => {
              const sh = Number(w.departure_window_start.split(":")[0]) + Number(w.departure_window_start.split(":")[1]) / 60;
              const eh = Number(w.departure_window_end.split(":")[0]) + Number(w.departure_window_end.split(":")[1]) / 60;
              const ia = w.wave_type === "arrival";
              return (
                <Fragment key={`wv-container-${w.id}`}>
                  {/* Wave Background (z-[-1], behind flights & cells) */}
                  <div 
                    className={`absolute left-0 right-0 pointer-events-none z-[-1] border-y-2 border-dashed ${ia ? "bg-blue-100/40 border-blue-300" : "bg-green-100/40 border-green-300"}`} 
                    style={{ 
                      top: HEADER_HEIGHT + sh * HOUR_HEIGHT, 
                      height: Math.max((eh - sh) * HOUR_HEIGHT, 8),
                      gridColumnStart: 1,
                      gridColumnEnd: 9,
                    }}
                  />
                  {/* Wave Label Badge (z-22, in UTC column, floating above sticky cells) */}
                  <div 
                    className="absolute left-0 right-0 pointer-events-none z-22" 
                    style={{ 
                      top: HEADER_HEIGHT + sh * HOUR_HEIGHT, 
                      height: Math.max((eh - sh) * HOUR_HEIGHT, 8),
                      gridColumnStart: 1,
                      gridColumnEnd: 2,
                    }}
                  >
                    <span className={`text-[7px] md:text-[8px] font-black px-1 py-0.5 rounded shadow-sm border ${ia ? "bg-blue-500 text-white border-blue-600" : "bg-green-500 text-white border-green-600"} w-[38px] md:w-[62px] text-center inline-block ml-1 mt-1 select-none`}>
                      {ia ? "ARR" : "DEP"}
                    </span>
                  </div>
                </Fragment>
              );
            })}

            {/* Live UTC Hour Tracker Line */}
            {isCurrentWeek && (
              <div
                className="absolute pointer-events-none z-25 border-t-2 border-red-500 flex items-center h-0"
                style={{
                  top: `${HEADER_HEIGHT + liveUTCInfo.hr * HOUR_HEIGHT}px`,
                  gridColumnStart: liveUTCInfo.col + 2,
                  gridColumnEnd: liveUTCInfo.col + 3,
                  left: 0,
                  width: '100%'
                }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] shadow-md ring-2 ring-white" />
                <span className="bg-red-500 text-white text-[8px] px-1 py-0.5 rounded ml-1 font-mono font-bold shadow-sm select-none">
                  {currentTime.getUTCHours().toString().padStart(2, "0")}:{currentTime.getUTCMinutes().toString().padStart(2, "0")}
                </span>
              </div>
            )}

            {/* Flight Blocks (absolutely positioned relative to grid day columns) */}
            {flightBlocks.map(fb => {
              const top = HEADER_HEIGHT + fb.rowStart * HOUR_HEIGHT, ht = (fb.rowEnd - fb.rowStart) * HOUR_HEIGHT;
              const gt = fb.schedule.ground_time_minutes || 60, gtH = Math.max((gt / 60) * HOUR_HEIGHT, 8);
              const s = fb.schedule, dur = Math.round((new Date(s.scheduled_arrival + "Z").getTime() - new Date(s.scheduled_departure + "Z").getTime()) / 360000) / 10;
              const bkd = bookings[s.id] || [];
              const activeBooking = bkd.find((b: any) => b.status === "booked");
              const bookedBy = activeBooking
                ? activeBooking.departure_pilot_callsign === activeBooking.arrival_pilot_callsign
                  ? activeBooking.departure_pilot_callsign
                  : [activeBooking.departure_pilot_callsign, activeBooking.arrival_pilot_callsign].filter(Boolean).join(" / ")
                : "";
              const hasBooking = !!activeBooking;
              
              const leftPct = fb.subCol * (100 / fb.maxSubCols);
              const widthPct = (100 / fb.maxSubCols) - 0.5;

              return (
                <div 
                  key={`${s.id}-${fb.col}`}
                  className="absolute z-10 pointer-events-none"
                  style={{
                    gridColumnStart: fb.col + 2,
                    gridColumnEnd: fb.col + 3,
                    top: `${top}px`,
                    height: `${Math.max(ht + (fb.showGroundTime ? gtH : 0), 10)}px`,
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                >
                  <div
                    className={`w-full rounded-t-lg px-1.5 py-1 text-[8px] leading-tight cursor-pointer overflow-hidden border border-b-0 pointer-events-auto ${
                      fb.isError ? "bg-rose-100 border-rose-500 text-rose-950 font-black" :
                      s.status === "cancelled" ? "bg-slate-100 border-slate-400 text-slate-500 line-through opacity-70 font-semibold" :
                      s.status === "approved" ? "bg-emerald-100 border-emerald-600 text-emerald-950 font-extrabold" :
                      s.status === "proposed" ? "bg-amber-100 border-amber-600 text-amber-950 font-extrabold" :
                      "bg-sky-100 border-sky-500 text-sky-950 font-extrabold"
                    } hover:z-20 hover:ring-2 hover:ring-brand/30 transition-all shadow-sm`}
                    style={{ height: `${Math.max(ht, 10)}px` }}
                    onClick={e => { e.stopPropagation(); setEditingSchedule(s); }}
                    draggable
                    onDragStart={e => handleDragStart(e, s.id)}
                    onDragEnd={handleDragEnd}
                    title={`${s.departure}→${s.arrival} | ${s.aircraft_registration} | ${s.status} | ${dur}h\nBy: ${s.created_by_name || "?"}${s.approved_by ? ` | Appr: #${s.approved_by}` : ""}${hasBooking ? `\nBooked: ${bookedBy}` : ""}${fb.isError ? '\n⚠ Mismatch' : ''}${fb.isGroundIssue ? '\n⚠ GT short' : ''}\nDrag to move`}
                  >
                    <div className="font-bold truncate flex items-center gap-0.5">
                      {s.aircraft_registration}
                      {s.approved_by && <span title="Approved" className="text-[8px] font-black text-emerald-800 bg-emerald-200/60 px-1 rounded">✓</span>}
                      {(() => {
                        const activeBooking = bkd.find((b: any) => b.status === "booked");
                        if (!activeBooking) return null;
                        const pilotsToShow = [];
                        if (activeBooking.departure_pilot_id) {
                          pilotsToShow.push({
                            id: activeBooking.id,
                            pilot_id: activeBooking.departure_pilot_id,
                            pilot_callsign: activeBooking.departure_pilot_callsign,
                            pilot_avatar: activeBooking.departure_pilot_avatar,
                            type: "dep",
                            label: "DEP"
                          });
                        }
                        if (activeBooking.arrival_pilot_id && activeBooking.arrival_pilot_id !== activeBooking.departure_pilot_id) {
                          pilotsToShow.push({
                            id: activeBooking.id,
                            pilot_id: activeBooking.arrival_pilot_id,
                            pilot_callsign: activeBooking.arrival_pilot_callsign,
                            pilot_avatar: activeBooking.arrival_pilot_avatar,
                            type: "arr",
                            label: "ARR"
                          });
                        }
                        if (activeBooking.departure_pilot_id === activeBooking.arrival_pilot_id) {
                          if (pilotsToShow[0]) pilotsToShow[0].label = "Full";
                        }
                        return (
                          <div className="flex -space-x-1.5 items-center">
                            {pilotsToShow.map((p) => {
                              const callsign = p.pilot_callsign || "?";
                              const letter = callsign[0]?.toUpperCase() || "?";
                              const typeLabel = p.label === "DEP" ? "DEP Only" : p.label === "ARR" ? "ARR Only" : "Full Flight";
                              return (
                                <span 
                                  key={`${p.id}-${p.type}`}
                                  className="relative flex-shrink-0 ml-0.5 w-4.5 h-4.5 inline-flex select-none" 
                                  title={`Booked by ${callsign} (${typeLabel})`}
                                >
                                  {p.pilot_avatar ? (
                                    <img 
                                      src={p.pilot_avatar} 
                                      alt={callsign} 
                                      className="w-full h-full rounded-full object-cover border border-blue-400 bg-blue-100"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                        const fallbackEl = e.currentTarget.parentElement?.querySelector(".avatar-fallback") as HTMLElement;
                                        if (fallbackEl) fallbackEl.style.display = "inline-flex";
                                      }}
                                    />
                                  ) : null}
                                  <span 
                                    className="avatar-fallback w-full h-full rounded-full bg-blue-150 border border-blue-400 text-blue-900 text-[8px] font-black inline-flex items-center justify-center"
                                    style={{ display: p.pilot_avatar ? "none" : "inline-flex" }}
                                  >
                                    {letter}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="truncate font-semibold">{s.departure}→{s.arrival} <span className="opacity-60">{dur}h</span></div>
                    <div className="truncate opacity-75">{s.flight_number || `#${s.id}`} · {s.status}</div>
                  </div>
                  {fb.showGroundTime && (
                    <div
                      className={`w-full rounded-b-lg border ${fb.isGroundIssue ? "border-orange-500 bg-orange-100 text-orange-950 font-bold border-dashed" : "border-cyan-300 bg-cyan-50 text-cyan-800 font-semibold border-dashed"} flex items-center justify-center text-[7px] overflow-hidden`}
                      style={{ height: `${gtH}px` }}
                    >
                      {gtH >= 10 ? `GT ${gt}m` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Upgraded Landing Page UI when no activeGroup is selected */
        <div className="max-w-4xl mx-auto mt-6 md:mt-10 animate-fade-in px-2">
          {/* Operations Center Welcome Banner */}
          <div className="bg-gradient-to-br from-brand-dark to-brand rounded-3xl p-6 md:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-y-12 translate-x-12 hidden md:block">
              <svg className="w-80 h-80" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-black mb-3">UTC Operations Center</h2>
            <p className="text-white/80 max-w-xl text-xs md:text-sm leading-relaxed">
              Plan route schedules, coordinate aircraft turnarounds, and bid/book flights with your flying group. Select a group below to open its real-time interactive calendar.
            </p>
          </div>

          {/* Group Suggestions / Directory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* User's Group Suggestion card */}
            {currentPilot?.group_name ? (
              (() => {
                const userGroupId = currentPilot.group_id;
                const userGroupObj = groups.find(g => g.id === userGroupId);
                return (
                  <div className="bg-white border-2 border-brand rounded-2xl p-6 shadow-md flex flex-col justify-between hover:shadow-lg transition-all">
                    <div>
                      <span className="text-[9px] font-black tracking-widest text-brand uppercase bg-brand-pale px-3 py-1 rounded-full">Your Group</span>
                      <h3 className="text-2xl font-black text-brand mt-4">{currentPilot.group_name}</h3>
                      <p className="text-gray-500 text-xs mt-2 leading-relaxed">
                        This is your primary assigned group. Load the schedules, request slots, and coordinate flights with your team.
                      </p>
                      {userGroupObj && (
                        <div className="flex gap-4 mt-4 text-xs font-semibold text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-brand-border">
                          <span>{userGroupObj.member_count} members</span>
                          <span>{userGroupObj.aircraft_count} aircraft</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => userGroupId && setActiveGroup(userGroupId)}
                      className="mt-6 w-full rounded-full bg-brand text-white font-bold py-3 hover:bg-brand-dark hover:shadow-md transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Open Calendar
                    </button>
                  </div>
                );
              })()
            ) : (
              <div className="bg-white border border-brand-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase bg-gray-150 px-3 py-1 rounded-full">Assignment</span>
                  <h3 className="text-2xl font-black text-gray-400 mt-4">No active group</h3>
                  <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                    You are not assigned to a flying group. Choose any group on the right to browse their calendar, or contact staff to request a group assignment.
                  </p>
                </div>
                <div className="mt-6 h-11 border border-dashed border-gray-200 rounded-full flex items-center justify-center text-xs text-gray-300 font-semibold">
                  Locked
                </div>
              </div>
            )}

            {/* General Browse Group Card */}
            <div className="bg-white border border-brand-border rounded-2xl p-6 shadow-md flex flex-col justify-between hover:shadow-lg transition-all">
              <div>
                <span className="text-[9px] font-black tracking-widest text-gray-500 uppercase bg-gray-100 px-3 py-1 rounded-full">All Groups</span>
                <h3 className="text-2xl font-black text-brand mt-4">Browse Groups</h3>
                <p className="text-gray-500 text-xs mt-2 leading-relaxed mb-4">
                  Browse and view the UTC calendars, aircraft turnarounds, and schedule waves for any group in the database.
                </p>
                <select
                  value=""
                  onChange={e => e.target.value && setActiveGroup(Number(e.target.value))}
                  className="w-full border border-brand-border rounded-xl px-4 py-3 bg-white text-xs font-semibold text-gray-700 cursor-pointer focus:ring-1 focus:ring-brand focus:border-brand"
                >
                  <option value="" disabled>Choose a flying group...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.member_count} pilots, {g.aircraft_count} fleet)
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-6 text-[9px] text-gray-400 font-semibold text-center italic">
                Viewing other group calendars is restricted to read-only unless you are staff.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT POPUP */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingSchedule(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-brand mb-3">{editingSchedule.flight_number || `#${editingSchedule.id}`}</h3>
            <div className="space-y-1 text-sm text-gray-600 mb-4">
              <p>{editingSchedule.departure} → {editingSchedule.arrival} <span className="text-xs opacity-60">({Math.round((new Date(editingSchedule.scheduled_arrival + "Z").getTime() - new Date(editingSchedule.scheduled_departure + "Z").getTime()) / 360000) / 10}h)</span></p>
              <p>Aircraft: {editingSchedule.aircraft_registration}</p>
              <p>Status: <span className="font-semibold">{editingSchedule.status}</span> · By: {editingSchedule.created_by_name || "?"}{editingSchedule.approved_by ? ` · Appr: #${editingSchedule.approved_by}` : ""}</p>
              <p className="text-xs text-gray-400">Dep: {new Date(editingSchedule.scheduled_departure + "Z").toISOString().replace("T", " ").slice(0, 16)}</p>
              <p className="text-xs text-gray-400">Arr: {new Date(editingSchedule.scheduled_arrival + "Z").toISOString().replace("T", " ").slice(0, 16)}</p>
              {(() => { 
                const bkd = bookings[editingSchedule.id] || []; 
                const activeBooking = bkd.find((b: any) => b.status === "booked");
                if (!activeBooking) return null;
                return (
                  <div className="text-xs text-blue-600 font-semibold space-y-1 border-t border-brand-border/40 pt-2 mt-2">
                    {activeBooking.departure_pilot_id === activeBooking.arrival_pilot_id ? (
                      <p>Booked (Full Flight): {activeBooking.departure_pilot_callsign}</p>
                    ) : (
                      <>
                        {activeBooking.departure_pilot_id && <p>Booked (Departure): {activeBooking.departure_pilot_callsign}</p>}
                        {activeBooking.arrival_pilot_id && <p>Booked (Arrival): {activeBooking.arrival_pilot_callsign}</p>}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
            
            {/* Shift/Edit Times Form */}
            <div className="border-t border-brand-border/40 pt-3.5 mt-3.5 mb-4 space-y-3">
              <h4 className="text-[11px] font-bold text-brand uppercase tracking-wider">Shift Flight Times (UTC)</h4>
              <div>
                <label className="block text-[9px] font-bold text-gray-500 mb-1">Departure</label>
                <input
                  type="datetime-local"
                  value={editDepTime ? editDepTime.slice(0, 16) : ""}
                  onChange={(e) => setEditDepTime(e.target.value)}
                  className="w-full border border-brand-border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-brand bg-white text-gray-700"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-500 mb-1">Arrival</label>
                <input
                  type="datetime-local"
                  value={editArrTime ? editArrTime.slice(0, 16) : ""}
                  onChange={(e) => setEditArrTime(e.target.value)}
                  className="w-full border border-brand-border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-brand bg-white text-gray-700"
                />
              </div>
              <button
                type="button"
                disabled={updatingTime}
                onClick={async () => {
                  if (!editDepTime || !editArrTime) return;
                  setUpdatingTime(true);
                  try {
                    const formatDt = (s: string) => s.slice(0, 19).replace("T", " ");
                    const res = await dispatch(updateSchedule({
                      id: editingSchedule.id,
                      data: {
                        scheduled_departure: formatDt(editDepTime),
                        scheduled_arrival: formatDt(editArrTime)
                      }
                    }));
                    if (updateSchedule.fulfilled.match(res)) {
                      alert("Schedule times shifted successfully!");
                      refreshSchedules();
                      setEditingSchedule(null);
                    } else {
                      alert("Failed to shift schedule times: " + (res.error?.message || "Unknown error"));
                    }
                  } catch (err: any) {
                    alert("Error: " + err.message);
                  } finally {
                    setUpdatingTime(false);
                  }
                }}
                className="w-full rounded-full bg-brand text-white py-1.5 hover:bg-brand-dark text-[10px] font-black transition-colors cursor-pointer text-center"
              >
                {updatingTime ? "Saving..." : "Save Shifted Times"}
              </button>
            </div>
            <div className="flex flex-col gap-3 text-xs font-bold">
              {editingSchedule.status === "approved" && (() => {
                const bkd = bookings[editingSchedule.id] || [];
                const activeBooking = bkd.find((b: any) => b.status === "booked");
                const depBooked = activeBooking ? activeBooking.departure_pilot_id !== null : false;
                const arrBooked = activeBooking ? activeBooking.arrival_pilot_id !== null : false;
                
                return (
                  <div className="flex flex-col gap-2 w-full">
                    {!depBooked && (
                      <button 
                        onClick={async () => { 
                          const res = await dispatch(createBooking({ scheduleId: editingSchedule.id, bookingType: "departure" })); 
                          if (createBooking.fulfilled.match(res)) {
                            alert("Departure part booked successfully!");
                            refreshSchedules(); 
                            setEditingSchedule(null); 
                          } else {
                            alert("Failed to book flight: " + (res.error?.message || "Unknown error"));
                          }
                        }} 
                        className="w-full rounded-full bg-blue-500 text-white py-2 hover:bg-blue-600 cursor-pointer text-center"
                      >
                        Book Departure Part
                      </button>
                    )}
                    {!arrBooked && (
                      <button 
                        onClick={async () => { 
                          const res = await dispatch(createBooking({ scheduleId: editingSchedule.id, bookingType: "arrival" })); 
                          if (createBooking.fulfilled.match(res)) {
                            alert("Arrival part booked successfully!");
                            refreshSchedules(); 
                            setEditingSchedule(null); 
                          } else {
                            alert("Failed to book flight: " + (res.error?.message || "Unknown error"));
                          }
                        }} 
                        className="w-full rounded-full bg-blue-500 text-white py-2 hover:bg-blue-600 cursor-pointer text-center"
                      >
                        Book Arrival Part
                      </button>
                    )}
                    {!depBooked && !arrBooked && (
                      <button 
                        onClick={async () => { 
                          const res = await dispatch(createBooking({ scheduleId: editingSchedule.id, bookingType: "both" })); 
                          if (createBooking.fulfilled.match(res)) {
                            alert("Full flight booked successfully!");
                            refreshSchedules(); 
                            setEditingSchedule(null); 
                          } else {
                            alert("Failed to book flight: " + (res.error?.message || "Unknown error"));
                          }
                        }} 
                        className="w-full rounded-full bg-gradient-to-br from-brand-dark to-brand text-white py-2 hover:shadow-md cursor-pointer text-center"
                      >
                        Book Full Flight (Both Parts)
                      </button>
                    )}
                  </div>
                );
              })()}

              <div className="flex gap-2 flex-wrap w-full">
                {editingSchedule.status === "draft" && (
                  <button 
                    onClick={async () => { 
                      const res = await dispatch(proposeSchedule(editingSchedule.id)); 
                      if (proposeSchedule.fulfilled.match(res)) {
                        alert("Schedule proposed successfully!");
                        refreshSchedules(); 
                        setEditingSchedule(null); 
                      } else {
                        alert("Failed to propose schedule: " + (res.error?.message || "Unknown error"));
                      }
                    }} 
                    className="flex-1 rounded-full bg-blue-500 text-white py-2 hover:bg-blue-600 cursor-pointer"
                  >
                    Propose
                  </button>
                )}
                {editingSchedule.status === "proposed" && (
                  <>
                    <button 
                      onClick={async () => { 
                        const res = await dispatch(approveSchedule(editingSchedule.id)); 
                        if (approveSchedule.fulfilled.match(res)) {
                          alert("Schedule approved successfully!");
                          refreshSchedules(); 
                          setEditingSchedule(null); 
                        } else {
                          alert("Failed to approve schedule: " + (res.error?.message || "Unknown error"));
                        }
                      }} 
                      className="flex-1 rounded-full bg-green-600 text-white py-2 hover:bg-green-700 cursor-pointer"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={async () => { 
                        const res = await dispatch(rejectSchedule(editingSchedule.id)); 
                        if (rejectSchedule.fulfilled.match(res)) {
                          alert("Schedule rejected successfully!");
                          refreshSchedules(); 
                          setEditingSchedule(null); 
                        } else {
                          alert("Failed to reject schedule: " + (res.error?.message || "Unknown error"));
                        }
                      }} 
                      className="flex-1 rounded-full bg-yellow-500 text-white py-2 hover:bg-yellow-600 cursor-pointer"
                    >
                      Reject
                    </button>
                  </>
                )}
                
                {(() => {
                  const bkd = bookings[editingSchedule.id] || [];
                  const activeBooking = bkd.find((b: any) => b.status === "booked");
                  if (!activeBooking) return null;
                  
                  const myDepBooking = activeBooking.departure_pilot_id === user?.id && activeBooking.arrival_pilot_id !== user?.id ? activeBooking : null;
                  const myArrBooking = activeBooking.arrival_pilot_id === user?.id && activeBooking.departure_pilot_id !== user?.id ? activeBooking : null;
                  const myBothBooking = activeBooking.departure_pilot_id === user?.id && activeBooking.arrival_pilot_id === user?.id ? activeBooking : null;
                  
                  return (
                    <>
                      {myDepBooking && (
                        <button 
                          onClick={async () => { 
                            if (confirm("Cancel your departure booking?")) {
                              const res = await dispatch(cancelBooking(myDepBooking.id)); 
                              if (cancelBooking.fulfilled.match(res)) {
                                alert("Departure booking cancelled!");
                                refreshSchedules(); 
                                setEditingSchedule(null); 
                              } else {
                                alert("Failed to cancel booking: " + (res.error?.message || "Unknown error"));
                              }
                            }
                          }} 
                          className="flex-1 rounded-full bg-red-600 text-white py-2 hover:bg-red-700 cursor-pointer"
                        >
                          Cancel Departure
                        </button>
                      )}
                      {myArrBooking && (
                        <button 
                          onClick={async () => { 
                            if (confirm("Cancel your arrival booking?")) {
                              const res = await dispatch(cancelBooking(myArrBooking.id)); 
                              if (cancelBooking.fulfilled.match(res)) {
                                alert("Arrival booking cancelled!");
                                refreshSchedules(); 
                                setEditingSchedule(null); 
                              } else {
                                alert("Failed to cancel booking: " + (res.error?.message || "Unknown error"));
                              }
                            }
                          }} 
                          className="flex-1 rounded-full bg-red-600 text-white py-2 hover:bg-red-700 cursor-pointer"
                        >
                          Cancel Arrival
                        </button>
                      )}
                      {myBothBooking && (
                        <button 
                          onClick={async () => { 
                            if (confirm("Cancel your booking?")) {
                              const res = await dispatch(cancelBooking(myBothBooking.id)); 
                              if (cancelBooking.fulfilled.match(res)) {
                                alert("Booking cancelled!");
                                refreshSchedules(); 
                                setEditingSchedule(null); 
                              } else {
                                alert("Failed to cancel booking: " + (res.error?.message || "Unknown error"));
                              }
                            }
                          }} 
                          className="flex-1 rounded-full bg-red-600 text-white py-2 hover:bg-red-700 cursor-pointer"
                        >
                          Cancel Booking
                        </button>
                      )}
                    </>
                  );
                })()}

                <button 
                  onClick={async () => { 
                    if (confirm("Cancel this flight?")) { 
                      const res = await dispatch(deleteSchedule(editingSchedule.id)); 
                      if (deleteSchedule.fulfilled.match(res)) {
                        alert("Schedule deleted successfully!");
                        refreshSchedules(); 
                        setEditingSchedule(null); 
                      } else {
                        alert("Failed to delete schedule: " + (res.error?.message || "Unknown error"));
                      }
                    } 
                  }} 
                  className="flex-1 rounded-full bg-red-500 text-white py-2 hover:bg-red-600 cursor-pointer"
                >
                  Delete
                </button>
                <button onClick={() => setEditingSchedule(null)} className="flex-1 rounded-full bg-gray-200 text-gray-600 py-2 hover:bg-gray-300 cursor-pointer">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POPUP */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPopup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-brand">Schedule — {days[popup.day]} {(() => { const d = new Date(weekStart + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + popup.day); return d.toISOString().split("T")[0]; })()}</h3>
              <button onClick={() => setPopup(null)} className="text-gray-400 hover:text-gray-600 text-xl cursor-pointer">&times;</button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-sm font-semibold text-gray-600 mb-1">Time (UTC)</label><input type="time" value={selTime} onChange={e => setSelTime(e.target.value)} className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm focus:border-brand focus:ring-1 focus:ring-brand/30" /></div>
              <div><label className="block text-sm font-semibold text-gray-600 mb-1">Ground Time After (min)</label><input type="number" value={selGroundTime} onChange={e => setSelGroundTime(Number(e.target.value))} min={30} max={480} className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm" /><p className="text-xs text-gray-400 mt-1">A320=45m · A330=90m · B777=120m · A380=180m</p></div>
              <div><label className="block text-sm font-semibold text-gray-600 mb-1">Aircraft</label><select value={selAircraftId} onChange={e => loadRoutesForAircraft(Number(e.target.value))} className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm cursor-pointer"><option value={0}>Select</option>{airframes.map(a => { const t = types.find(ty => ty.id === a.aircraft_type_id); return (<option key={a.id} value={a.id}>{a.registration} — {t?.name || "?"}{t?.liveryname ? ` (${t.liveryname})` : ""} [at {a.current_airport}]</option>); })}</select>{popup.position && <p className="text-xs text-brand mt-1 font-semibold">Position: {popup.position}</p>}</div>
              <div><label className="block text-sm font-semibold text-gray-600 mb-1">Override Dep ICAO</label><input type="text" maxLength={4} placeholder={popup.position || "e.g. EGLL"} value={selOverrideDep} onChange={e => { const v = e.target.value.toUpperCase(); setSelOverrideDep(v); if (selAircraftId > 0) loadRoutesForAircraft(selAircraftId); }} className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm" /></div>
              <div><label className="block text-sm font-semibold text-gray-600 mb-1">Route {popup.position ? `(from ${popup.position})` : ""}</label><select value={selRouteId} onChange={e => setSelRouteId(Number(e.target.value))} className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm cursor-pointer"><option value={0}>Select</option>{availableRoutes.map(r => (<option key={r.id} value={r.id}>{r.dep}→{r.arr} [{r.fltnum?.split(",")[0]?.trim() || `#${r.id}`}] ({Math.floor(r.duration / 3600)}h{Math.floor(r.duration % 3600 / 60)}m)</option>))}</select>{loadingRoutes && <p className="text-xs text-gray-400 mt-1">Loading...</p>}{!loadingRoutes && selAircraftId > 0 && availableRoutes.length === 0 && <p className="text-xs text-orange-500 mt-1">No routes from this position for this aircraft.</p>}</div>
              {selectedRoute && <div className="bg-brand-pale rounded-xl p-3 text-sm"><p className="text-gray-600">Arr: <span className="font-semibold text-brand">{selectedRoute.arr}</span> · Dur: <span className="font-semibold">{Math.floor(selectedRoute.duration / 3600)}h{Math.floor(selectedRoute.duration % 3600 / 60)}m</span></p></div>}
              <button onClick={doCreate} disabled={!selAircraftId || !selRouteId} className="w-full rounded-full bg-gradient-to-br from-brand-dark to-brand text-white font-semibold py-2.5 hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-40 cursor-pointer">Save as Draft</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
