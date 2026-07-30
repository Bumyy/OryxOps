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
import aircraftImages from "../assets/aircraft_images.json";

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
  const { schedules, waves, loading } = useAppSelector((s) => s.schedule);
  const { groups } = useAppSelector((s) => s.group);
  const { airframes, types } = useAppSelector((s) => s.aircraft);
  const { currentPilot } = useAppSelector((s) => s.pilot);
  const user = useAppSelector((s: any) => s.auth.user);

  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(getWeekStart);
  const [filterAircraftId, setFilterAircraftId] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>("active");
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");

  const [popup, setPopup] = useState<{ day: number; hour: number; position: string } | null>(null);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
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
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("dismissed_warnings");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [quota, setQuota] = useState<any>(null);

  const fetchQuota = async () => {
    try {
      const data = await api.get<any>(`/schedules/proposal-quota?week_start=${weekStart}`);
      if (data) setQuota(data);
    } catch (e) {
      console.error("Failed to load quota", e);
    }
  };

  const isExecutiveOrAdmin = Boolean(user?.is_executive || user?.is_admin);
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
      dispatch(fetchSchedules({ group_id: activeGroup, week_start: weekStart, status: "all" }));
      dispatch(fetchWaves({ week_start: weekStart }));
      dispatch(fetchAirframes({ group_id: activeGroup }));
      fetchQuota();
    }
  }, [activeGroup, weekStart]);

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
    let bs = schedules;
    if (statusFilter === "cancelled") {
      bs = schedules.filter(s => s.status?.toLowerCase() === "cancelled");
    } else if (statusFilter && statusFilter !== "all" && statusFilter !== "active") {
      bs = schedules.filter(s => s.status?.toLowerCase() === statusFilter.toLowerCase());
    } else {
      // Default / "all" / "active": exclude cancelled and deleted flights
      bs = schedules.filter(s => s.status?.toLowerCase() !== "cancelled" && s.status?.toLowerCase() !== "deleted");
    }
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
    return bs;
  }, [baseSchedules, filterAircraftId]);

  const sortedListSchedules = useMemo(() => {
    return [...filteredSchedules].sort((a, b) => {
      const depA = new Date(a.scheduled_departure + "Z").getTime();
      const depB = new Date(b.scheduled_departure + "Z").getTime();
      return depA - depB;
    });
  }, [filteredSchedules]);

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
      return { label: "Current Week", statusKey: "approved" };
    } else if (weekStart === nextStartStr) {
      const day = today.getUTCDay();
      const isWeekend = day === 6 || day === 0;
      if (isWeekend) {
        return { label: "Scheduling Week", statusKey: "proposed" };
      }
      return { label: "Next Week", statusKey: "draft" };
    } else if (weekStart < currentStartStr) {
      return { label: "Past Week", statusKey: "cancelled" };
    } else {
      return { label: "Future Week", statusKey: "warn" };
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
    const flights = schedules.filter(s => {
      const st = s.status?.toLowerCase();
      return (st === "draft" || st === "proposed" || st === "approved") && s.aircraft_id === aircraftId;
    }).sort((a, b) => new Date(a.scheduled_arrival + "Z").getTime() - new Date(b.scheduled_arrival + "Z").getTime());
    const slot = getSlotDate(day, hour);
    for (const f of flights) { if (new Date(f.scheduled_arrival + "Z").getTime() <= slot.getTime()) pos = f.arrival; }
    return pos;
  }

  // Position validation runs ONLY on draft, proposed, and approved flights (ignores cancelled & deleted)
  const positionErrors = useMemo((): PositionError[] => {
    const errors: PositionError[] = []; const byAircraft: Record<number, any[]> = {};
    const validationSchedules = schedules.filter(s => {
      const st = s.status?.toLowerCase();
      return st === "draft" || st === "proposed" || st === "approved";
    });
    for (const s of validationSchedules) { if (!byAircraft[s.aircraft_id]) byAircraft[s.aircraft_id] = []; byAircraft[s.aircraft_id].push(s); }
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
  }, [schedules, airframes]);

  const getWarningKey = (e: PositionError) => `${e.scheduleId}-${e.status}-${e.expectedDep}-${e.actualDep}`;

  const activeErrors = useMemo(() => {
    return positionErrors.filter(e => !dismissedWarnings.has(getWarningKey(e)));
  }, [positionErrors, dismissedWarnings]);

  const errorSet = useMemo(() => new Set(activeErrors.filter(e => e.status === "mismatch").map(e => e.scheduleId)), [activeErrors]);
  const groundSet = useMemo(() => new Set(activeErrors.filter(e => e.status === "ground_short").map(e => e.scheduleId)), [activeErrors]);

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

  function refreshSchedules() { if (activeGroup) { dispatch(fetchSchedules({ group_id: activeGroup, week_start: weekStart, status: "all" })); } }

  async function openPopup(day: number, hour: number, preselectedAcId?: number) {
    const pid = preselectedAcId ?? (filterAircraftId > 0 ? filterAircraftId : 0);
    setSelAircraftId(pid); setSelRouteId(0); setSelTime(`${String(hour).padStart(2, "0")}:00`); setSelGroundTime(60); setSelOverrideDep(""); setAvailableRoutes([]); setEditingSchedule(null);
    // If a specific aircraft is pre-selected, skip straight to step 2
    if (pid > 0) {
      setCreateStep(2);
    } else {
      setCreateStep(1);
    }
    setPopup({ day, hour, position: "" });
    if (pid > 0) loadRoutesForAircraft(pid, day, hour);
  }

  async function loadRoutesForAircraft(acId: number, day?: number, hour?: number, overrideDepStr?: string) {
    setSelAircraftId(acId); setSelRouteId(0); setAvailableRoutes([]); if (!acId) return;
    const d = day ?? popup?.day ?? 0; const h = hour ?? popup?.hour ?? 0;
    const depVal = overrideDepStr !== undefined ? overrideDepStr : selOverrideDep;
    const validOverride = depVal && depVal.trim().length === 4 ? depVal.trim().toUpperCase() : "";
    const pos = validOverride || getAircraftPosition(acId, d, h);
    setPopup(p => p ? { ...p, position: pos } : p);
    const ac = airframes.find(a => a.id === acId); if (!ac) return;
    setLoadingRoutes(true);
    try { const all = await api.get<AvailableRoute[]>(`/routes/available?aircraft_type_id=${ac.aircraft_type_id}&departure=${pos}`); setAvailableRoutes(all); } catch { setAvailableRoutes([]); }
    setLoadingRoutes(false);
  }

  const selectedRoute = availableRoutes.find(r => r.id === selRouteId);

  async function doCreate() {
    if (!activeGroup || !selAircraftId || !selRouteId || !popup) return;
    if (selOverrideDep && selOverrideDep.trim().length !== 4) {
      alert("Override Dep ICAO must be a 4-letter uppercase code (e.g. EGLL).");
      return;
    }
    const r = selectedRoute; if (!r) return;
    const depIcao = (selOverrideDep && selOverrideDep.trim().length === 4 ? selOverrideDep.trim().toUpperCase() : "") || popup.position || r.dep;
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

      {/* BOX 1: Navigation & Control Box */}
      {activeGroup && (
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4 bg-white border border-brand-border rounded-2xl p-4 shadow-sm">
          {/* Left: Group Selector & Week Controls */}
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
                <span
                  className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border"
                  style={{
                    background: `var(--status-${weekStatus.statusKey}-bg)`,
                    color: `var(--status-${weekStatus.statusKey}-text)`,
                    borderColor: `var(--status-${weekStatus.statusKey}-border)`,
                  }}
                >
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
          </div>

          {/* Right: Fleet Registration Filter, Status Filter Dropdown, My Bookings, View Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Fleet Registration Filter */}
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

            {/* Status Filter Dropdown */}
            <select
              value={statusFilter ?? "all"}
              onChange={e => {
                const val = e.target.value;
                setStatusFilter(val === "all" ? null : val);
              }}
              className="border border-brand-border rounded-xl px-3 py-2 bg-white text-xs font-semibold text-gray-600 focus:outline-none cursor-pointer"
            >
              <option value="active">Status: Active Flights</option>
              <option value="all">Status: All Statuses</option>
              <option value="draft">Status: Drafts</option>
              <option value="proposed">Status: Proposed</option>
              <option value="approved">Status: Approved</option>
              <option value="cancelled">Status: Cancelled</option>
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

            {/* View Switcher Toggle */}
            <div
              className="flex items-center border border-brand-border rounded-xl p-0.5"
              style={{ background: "var(--bg-muted)" }}
            >
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "calendar" ? "bg-brand text-white shadow-sm" : "text-gray-600 hover:text-brand"
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "list" ? "bg-brand text-white shadow-sm" : "text-gray-600 hover:text-brand"
                }`}
              >
                List View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOX 2: Executive & Admin Action Box (Shown ONLY to Executive & Admin users) */}
      {activeGroup && isExecutiveOrAdmin && (
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 rounded-2xl p-4 shadow-sm"
          style={{
            background: "var(--status-warn-bg)",
            border: "1px solid var(--status-warn-border)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider"
              style={{
                background: "var(--status-proposed-bg)",
                color: "var(--status-proposed-text)",
                border: "1px solid var(--status-proposed-border)",
              }}
            >
              Executive Controls
            </span>
            <span className="text-xs font-semibold hidden md:inline" style={{ color: "var(--status-warn-text)" }}>
              Management actions for schedule automation and approval
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleClonePreviousWeek}
              disabled={cloning}
              className="border border-brand text-brand bg-white hover:bg-brand-pale rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-sm disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
              title="Clone all schedules from last week into this week"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {cloning ? "Cloning..." : "Clone Last Week"}
            </button>

            <button
              onClick={() => {
                if (confirm("Approve all proposed flights for this week?")) {
                  dispatch(bulkApproveSchedules({ group_id: activeGroup, week_start: weekStart })).then(refreshSchedules);
                }
              }}
              className="rounded-xl bg-green-600 text-white font-bold text-xs px-4 py-2 hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Approve Proposed Flights
            </button>
          </div>
        </div>
      )}

      {/* Warnings & Errors */}
      {activeGroup && (
        <div className="mb-4">
          {activeErrors.filter(e => e.status === "mismatch").map(e => {
            const key = getWarningKey(e);
            return (
              <div
                key={`e-${e.scheduleId}`}
                className="rounded-xl px-3 py-2 text-xs font-semibold mb-1.5 shadow-sm flex items-center justify-between gap-3 hover:shadow-md transition-all duration-200"
                style={{
                  background: "var(--status-error-bg)",
                  color: "var(--status-error-text)",
                  border: "1px solid var(--status-error-border)",
                }}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Mismatch: <strong className="font-black">{e.registration}</strong>: Expected {e.expectedDep} but flight departs {e.actualDep}</span>
                </div>
                <button
                  onClick={() => {
                    const next = new Set(dismissedWarnings);
                    next.add(key);
                    setDismissedWarnings(next);
                    localStorage.setItem("dismissed_warnings", JSON.stringify(Array.from(next)));
                  }}
                  className="hover:bg-red-500/10 active:bg-red-500/20 p-1 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                  title="Dismiss warning"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
          {activeErrors.filter(e => e.status === "ground_short").map(e => {
            const key = getWarningKey(e);
            return (
              <div
                key={`g-${e.scheduleId}`}
                className="rounded-xl px-3 py-2 text-xs font-semibold mb-1.5 shadow-sm flex items-center justify-between gap-3 hover:shadow-md transition-all duration-200"
                style={{
                  background: "var(--status-warn-bg)",
                  color: "var(--status-warn-text)",
                  border: "1px solid var(--status-warn-border)",
                }}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Ground warning: <strong className="font-black">{e.registration}</strong>: Ground {e.expectedDep.replace("gap:", "")} vs req {e.actualDep.replace("need:", "")}</span>
                </div>
                <button
                  onClick={() => {
                    const next = new Set(dismissedWarnings);
                    next.add(key);
                    setDismissedWarnings(next);
                    localStorage.setItem("dismissed_warnings", JSON.stringify(Array.from(next)));
                  }}
                  className="hover:bg-amber-500/10 active:bg-amber-500/20 p-1 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                  title="Dismiss warning"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
          {positionErrors.length > activeErrors.length && (
            <div className="flex justify-end mt-1.5 px-1">
              <button
                onClick={() => {
                  setDismissedWarnings(new Set());
                  localStorage.removeItem("dismissed_warnings");
                }}
                className="text-[11px] font-bold text-gray-500 hover:text-brand hover:underline cursor-pointer flex items-center gap-1 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Restore {positionErrors.length - activeErrors.length} dismissed warning{positionErrors.length - activeErrors.length !== 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Page Content */}
      {activeGroup ? (
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-50 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3 transition-all duration-300 min-h-[400px] rounded-xl md:rounded-2xl">
              <div className="w-10 h-10 border-4 border-brand-border border-t-brand rounded-full animate-spin"></div>
              <p className="text-xs font-black text-brand animate-pulse uppercase tracking-wider">Loading schedules...</p>
            </div>
          )}
          {viewMode === "calendar" ? (
          /* CALENDAR GRID VIEW */
          <div className="bg-white rounded-xl md:rounded-2xl border border-brand-border shadow-sm overflow-auto max-h-[75vh] -mx-2 md:mx-0">
            <div className="grid grid-cols-[45px_repeat(7,minmax(85px,1fr))] md:grid-cols-[70px_repeat(7,minmax(120px,1fr))] relative z-0 min-w-[700px] md:min-w-[900px]" style={{ minHeight: HEADER_HEIGHT + 24 * HOUR_HEIGHT }}>
              {/* UTC Top-Left Corner Cell */}
              <div className="border-b border-r border-brand-border bg-brand-pale p-2 text-[10px] font-bold text-gray-500 text-center sticky left-0 top-0 z-40 flex items-center justify-center" style={{ height: HEADER_HEIGHT }}>UTC</div>
              
              {/* Day Headers */}
              {days.map((d, i) => {
                const dt = new Date(weekStart + "T00:00:00Z");
                dt.setUTCDate(dt.getUTCDate() + i);
                return (
                  <div key={`h-${d}`} className="border-b border-r border-brand-border bg-brand-pale p-2 text-[10px] font-bold text-gray-500 text-center sticky top-0 z-30 flex items-center justify-center" style={{ height: HEADER_HEIGHT }}>
                    {d} {dt.getUTCDate()}/{dt.getUTCMonth() + 1}
                  </div>
                );
              })}
              
              {/* Grid Body Cells */}
              {Array.from({ length: 24 }, (_, h) => (
                <Fragment key={`row-${h}`}>
                  <div className="border-b border-r border-brand-border p-1 text-[9px] text-gray-500 text-center font-mono bg-brand-pale flex items-center justify-center sticky left-0 z-20" style={{ height: HOUR_HEIGHT }}>
                    {String(h).padStart(2, "0")}:00
                  </div>
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
                    <div 
                      className={`absolute left-0 right-0 pointer-events-none z-[-1] border-y-2 border-dashed ${ia ? "bg-blue-100/40 border-blue-300" : "bg-green-100/40 border-green-300"}`} 
                      style={{ 
                        top: HEADER_HEIGHT + sh * HOUR_HEIGHT, 
                        height: Math.max((eh - sh) * HOUR_HEIGHT, 8),
                        gridColumnStart: 1,
                        gridColumnEnd: 9,
                      }}
                    />
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

              {/* Flight Blocks */}
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
                      className={`w-full rounded-t-lg px-1.5 py-1 text-[8px] leading-tight cursor-pointer overflow-hidden border border-b-0 pointer-events-auto font-extrabold ${
                        s.status === "cancelled" ? "line-through opacity-70 font-semibold" : ""
                      } hover:z-20 hover:ring-2 hover:ring-brand/30 transition-all shadow-sm`}
                      style={{
                        height: `${Math.max(ht, 10)}px`,
                        background: fb.isError ? "var(--status-error-bg)" :
                          s.status === "cancelled" ? "var(--status-cancelled-bg)" :
                          s.status === "approved" ? "var(--status-approved-bg)" :
                          s.status === "proposed" ? "var(--status-proposed-bg)" :
                          "var(--status-draft-bg)",
                        color: fb.isError ? "var(--status-error-text)" :
                          s.status === "cancelled" ? "var(--status-cancelled-text)" :
                          s.status === "approved" ? "var(--status-approved-text)" :
                          s.status === "proposed" ? "var(--status-proposed-text)" :
                          "var(--status-draft-text)",
                        borderColor: fb.isError ? "var(--status-error-border)" :
                          s.status === "cancelled" ? "var(--status-cancelled-border)" :
                          s.status === "approved" ? "var(--status-approved-border)" :
                          s.status === "proposed" ? "var(--status-proposed-border)" :
                          "var(--status-draft-border)",
                      }}
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
                        className="w-full rounded-b-lg border border-dashed flex items-center justify-center text-[7px] overflow-hidden font-semibold"
                        style={{
                          height: `${gtH}px`,
                          background: fb.isGroundIssue ? "var(--status-ground-err-bg)" : "var(--status-ground-ok-bg)",
                          color: fb.isGroundIssue ? "var(--status-ground-err-text)" : "var(--status-ground-ok-text)",
                          borderColor: fb.isGroundIssue ? "var(--status-ground-err-border)" : "var(--status-ground-ok-border)",
                        }}
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
          /* LIST VIEW: Aircraft Matrix Grid (Y-axis: Fleet Airframe | X-axis: Dates Mon-Sun) */
          <div className="bg-white rounded-xl md:rounded-2xl border border-brand-border shadow-sm overflow-auto max-h-[75vh] -mx-2 md:mx-0">
            {(() => {
              const listAirframes = filterAircraftId > 0
                ? airframes.filter(a => Number(a.id) === Number(filterAircraftId))
                : airframes;

              if (listAirframes.length === 0) {
                return (
                  <div className="text-center py-12 text-gray-400 font-semibold bg-white rounded-2xl border border-dashed border-gray-200 m-4">
                    No aircraft found for this flying group.
                  </div>
                );
              }

              const isDarkTheme = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

              // Compute maximum flights per day across all aircraft to dynamically set column widths
              const flightsPerDay = days.map((_, colIdx) => {
                let maxCount = 0;
                for (const ac of listAirframes) {
                  const count = filteredSchedules.filter(s => {
                    if (Number(s.aircraft_id) !== Number(ac.id)) return false;
                    const dep = new Date(s.scheduled_departure + "Z");
                    const depCol = dep.getUTCDay() === 0 ? 6 : dep.getUTCDay() - 1;
                    return depCol === colIdx;
                  }).length;
                  if (count > maxCount) maxCount = count;
                }
                return Math.max(maxCount, 1);
              });

              // Dynamic grid column widths: Y-axis (220px) + Day columns (width based on flight count)
              const gridTemplateCols = "220px " + flightsPerDay.map(c => `minmax(${c * 230 + (c > 1 ? 16 : 0)}px, ${c}fr)`).join(" ");
              const totalMinWidth = 220 + flightsPerDay.reduce((acc, c) => acc + (c * 230 + (c > 1 ? 16 : 0)), 0);

              return (
                <div
                  className="grid relative z-0 border-collapse"
                  style={{ gridTemplateColumns: gridTemplateCols, minWidth: `${totalMinWidth}px` }}
                >
                  {/* Top-Left Corner Cell: Sticky Header + Sticky Left */}
                  <div className="border-b border-r border-brand-border bg-brand-pale p-3 text-xs font-black text-brand uppercase text-center sticky left-0 top-0 z-40 flex items-center justify-center shadow-xs">
                    Fleet Airframe (Y)
                  </div>

                  {/* Top Row: X-axis Day Headers with single + ADD FLIGHT button per day */}
                  {days.map((d, colIdx) => {
                    const dt = new Date(weekStart + "T00:00:00Z");
                    dt.setUTCDate(dt.getUTCDate() + colIdx);
                    const isToday = dt.toISOString().split("T")[0] === new Date().toISOString().split("T")[0];
                    const dayFlightCount = filteredSchedules.filter(s => {
                      const dep = new Date(s.scheduled_departure + "Z");
                      const depCol = dep.getUTCDay() === 0 ? 6 : dep.getUTCDay() - 1;
                      return depCol === colIdx;
                    }).length;

                    return (
                      <div
                        key={`listh-${d}`}
                        className={`border-b border-r border-brand-border p-2.5 text-center sticky top-0 z-30 flex flex-col items-center justify-between gap-1.5 transition-colors ${
                          isToday ? "bg-brand/10 text-brand" : "bg-brand-pale text-gray-600"
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-black uppercase tracking-wider">{d}</span>
                          <span className="text-[10px] font-bold text-gray-400 font-mono">
                            {dt.getUTCDate()}/{dt.getUTCMonth() + 1}
                          </span>
                          {dayFlightCount > 0 && (
                            <span className="mt-0.5 text-[8px] font-extrabold text-brand bg-brand/10 rounded-full px-2 py-0.5">
                              {dayFlightCount} flight{dayFlightCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {/* Single + ADD FLIGHT Button in Top Header */}
                        <button
                          onClick={() => openPopup(colIdx, 12)}
                          className="w-full flex items-center justify-center gap-1 py-1 px-2 rounded-lg border border-dashed border-brand-border text-brand/60 hover:text-brand hover:border-brand hover:bg-brand/5 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                        >
                          <span className="text-xs font-black">+</span>
                          <span>ADD FLIGHT</span>
                        </button>
                      </div>
                    );
                  })}

                  {/* Rows for each Aircraft */}
                  {listAirframes.map((ac) => {
                    const acType = types.find(t => t.id === ac.aircraft_type_id);
                    const acTypeName = ac.aircraft_type_name || acType?.name || "Aircraft";
                    const imgMap = aircraftImages as Record<string, { url: string; source: string; objectPosition?: string }>;
                    const imgMeta = imgMap[ac.registration] ||
                                    imgMap[ac.registration?.replace("-", "")] ||
                                    imgMap[String(ac.aircraft_type_id)];

                    const imgUrl = imgMeta?.url || (isDarkTheme ? "/oryxops_logo_white.webp" : "/oryxops_logo_colored.webp");
                    const imgSource = imgMeta?.source || null;
                    const isFallback = !imgMeta?.url;

                    return (
                      <Fragment key={`acrow-${ac.id}`}>
                        {/* Sticky Left Y-axis Cell: Aircraft Card */}
                        <div className="border-b border-r border-brand-border bg-white p-1.5 sticky left-0 z-20 flex flex-col justify-between shadow-xs h-[200px]">
                          <div className="w-full text-left rounded-xl border border-brand-border bg-white shadow-2xs overflow-hidden flex flex-col h-full">
                            {/* Photo container */}
                            <div className="relative w-full h-[135px] bg-brand-pale overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                              <img
                                src={imgUrl}
                                alt={ac.registration}
                                className={isFallback ? "max-h-14 w-auto object-contain p-1" : "w-full h-full object-cover rounded-md"}
                                style={{ objectPosition: imgMeta?.objectPosition || "center 35%" }}
                                onError={(e) => {
                                  const fallbackUrl = isDarkTheme ? "/oryxops_logo_white.webp" : "/oryxops_logo_colored.webp";
                                  e.currentTarget.src = fallbackUrl;
                                  e.currentTarget.className = "max-h-14 w-auto object-contain p-1";
                                }}
                              />
                              {imgSource && !isFallback && (
                                <span className="absolute bottom-1 right-1 text-[7.5px] font-extrabold text-white bg-black/70 backdrop-blur-xs px-1.5 py-0.5 rounded select-none shadow-sm">
                                  © {imgSource}
                                </span>
                              )}
                            </div>

                            {/* Bottom: Registration & Model */}
                            <div className="p-2 bg-brand-pale/50 border-t border-brand-border/60 flex items-center justify-between gap-1 text-[11px] min-w-0 flex-1">
                              <span className="font-black text-brand tracking-wide truncate">{ac.registration}</span>
                              <span className="font-bold text-gray-500 text-[10px] truncate">{acTypeName}</span>
                            </div>
                          </div>
                        </div>

                        {/* 7 Intersection Cells (one per day) */}
                        {days.map((d, colIdx) => {
                          const dt = new Date(weekStart + "T00:00:00Z");
                          dt.setUTCDate(dt.getUTCDate() + colIdx);
                          const isToday = dt.toISOString().split("T")[0] === new Date().toISOString().split("T")[0];

                          // Flights for this aircraft departing on this day
                          const cellFlights = filteredSchedules
                            .filter((s) => {
                              if (Number(s.aircraft_id) !== Number(ac.id)) return false;
                              const dep = new Date(s.scheduled_departure + "Z");
                              const depCol = dep.getUTCDay() === 0 ? 6 : dep.getUTCDay() - 1;
                              return depCol === colIdx;
                            })
                            .sort((a, b) =>
                              new Date(a.scheduled_departure + "Z").getTime() -
                              new Date(b.scheduled_departure + "Z").getTime()
                            );

                          return (
                            <div
                              key={`cell-${ac.id}-${colIdx}`}
                              className={`border-b border-r border-brand-border p-2.5 flex flex-row gap-2.5 items-stretch h-[200px] transition-colors relative overflow-hidden ${
                                isToday ? "bg-brand/[0.015]" : "bg-white"
                              }`}
                            >
                              {cellFlights.length === 0 ? (
                                <div className="flex-1" />
                              ) : (
                                cellFlights.map((s) => {
                                  const depDate = new Date(s.scheduled_departure + "Z");
                                  const arrDate = new Date(s.scheduled_arrival + "Z");
                                  const dur = Math.round((arrDate.getTime() - depDate.getTime()) / 360000) / 10;
                                  const bkd = bookings[s.id] || [];
                                  const activeBooking = bkd.find((b: any) => b.status === "booked");
                                  const hasError = errorSet.has(s.id);
                                  const hasGroundIssue = groundSet.has(s.id);

                                  const statusKey =
                                    hasError ? "error" :
                                    s.status === "cancelled" ? "cancelled" :
                                    s.status === "approved" ? "approved" :
                                    s.status === "proposed" ? "proposed" :
                                    "draft";

                                  const textColor = s.status === "cancelled" ? "opacity-60" : "";

                                  const pilotsToShow: { pilot_id: number; callsign: string; avatar: string | null; label: string }[] = [];
                                  if (activeBooking) {
                                    if (activeBooking.departure_pilot_id) {
                                      pilotsToShow.push({ pilot_id: activeBooking.departure_pilot_id, callsign: activeBooking.departure_pilot_callsign || "?", avatar: activeBooking.departure_pilot_avatar || null, label: activeBooking.departure_pilot_id === activeBooking.arrival_pilot_id ? "Full" : "DEP" });
                                    }
                                    if (activeBooking.arrival_pilot_id && activeBooking.arrival_pilot_id !== activeBooking.departure_pilot_id) {
                                      pilotsToShow.push({ pilot_id: activeBooking.arrival_pilot_id, callsign: activeBooking.arrival_pilot_callsign || "?", avatar: activeBooking.arrival_pilot_avatar || null, label: "ARR" });
                                    }
                                  }

                                  const depStr = `${String(depDate.getUTCHours()).padStart(2, "0")}:${String(depDate.getUTCMinutes()).padStart(2, "0")} UTC`;
                                  const arrStr = `${String(arrDate.getUTCHours()).padStart(2, "0")}:${String(arrDate.getUTCMinutes()).padStart(2, "0")} UTC`;

                                  return (
                                    <button
                                      key={s.id}
                                      onClick={() => setEditingSchedule(s)}
                                      className={`w-[220px] shrink-0 text-left rounded-xl border-2 border-l-4 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer overflow-hidden p-3 flex flex-col justify-between gap-1.5 ${
                                        hasError ? "border-l-rose-500" :
                                        s.status === "cancelled" ? "border-l-slate-400" :
                                        s.status === "approved" ? "border-l-emerald-500" :
                                        s.status === "proposed" ? "border-l-amber-500" :
                                        "border-l-sky-500"
                                      }`}
                                      style={{
                                        background: `var(--status-${statusKey}-bg)`,
                                        borderColor: `var(--status-${statusKey}-border)`,
                                      }}
                                    >
                                      {/* Flight Number & Status Pill */}
                                      <div className="flex items-center justify-between gap-2 min-w-0">
                                        <span className={`text-xs font-black tracking-tight truncate ${textColor}`} style={{ color: `var(--status-${statusKey}-text)` }}>
                                          {s.flight_number || `#${s.id}`}
                                        </span>
                                        <span
                                          className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 border shadow-2xs"
                                          style={{
                                            background: `var(--status-${statusKey}-bg)`,
                                            color: `var(--status-${statusKey}-text)`,
                                            borderColor: `var(--status-${statusKey}-border)`,
                                          }}
                                        >
                                          {s.status}
                                        </span>
                                      </div>

                                      {/* Route */}
                                      <div className={`flex items-center gap-2 ${textColor}`}>
                                        <span className="text-base font-black tracking-wide text-gray-900">{s.departure}</span>
                                        <span className="text-xs text-brand font-bold">✈</span>
                                        <span className="text-base font-black tracking-wide text-gray-900">{s.arrival}</span>
                                      </div>

                                      {/* Flight Duration */}
                                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600">
                                        <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                          <circle cx="12" cy="12" r="9"/>
                                          <path strokeLinecap="round" d="M12 7v5l3 2"/>
                                        </svg>
                                        <span>{dur}h</span>
                                      </div>

                                      {/* Warnings */}
                                      {(hasError || hasGroundIssue) && (
                                        <div className="flex items-center gap-1 text-[10px] font-bold">
                                          {hasError ? (
                                            <span className="text-rose-600 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">⚠ Mismatch</span>
                                          ) : (
                                            <span className="text-amber-600 font-extrabold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">⚠ Short</span>
                                          )}
                                        </div>
                                      )}

                                      {/* DEP & ARR Timings */}
                                      <div className="text-[11px] font-bold font-mono text-gray-600 space-y-0.5 border-t border-brand-border/40 pt-1.5">
                                        <div className="flex justify-between items-center">
                                          <span className="text-[9px] font-black text-gray-400 uppercase">DEP</span>
                                          <span className="font-extrabold">{depStr}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-[9px] font-black text-gray-400 uppercase">ARR</span>
                                          <span className="font-extrabold">{arrStr}</span>
                                        </div>
                                      </div>

                                      {/* Pilot Booking Info */}
                                      <div className="pt-1.5 border-t border-brand-border/40">
                                        {activeBooking ? (
                                          <div className="flex items-center justify-between gap-1 min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              {pilotsToShow.map((p, idx) => (
                                                <div key={idx} className="flex items-center gap-1.5 min-w-0" title={`Booked by ${p.callsign}`}>
                                                  <span className="relative flex-shrink-0 w-4.5 h-4.5 inline-flex select-none">
                                                    {p.avatar ? (
                                                      <img src={p.avatar} alt={p.callsign} className="w-full h-full rounded-full object-cover border border-blue-400" />
                                                    ) : (
                                                      <span className="w-full h-full rounded-full bg-blue-100 border border-blue-400 text-blue-900 text-[8px] font-black inline-flex items-center justify-center">
                                                        {p.callsign[0]?.toUpperCase() || "?"}
                                                      </span>
                                                    )}
                                                  </span>
                                                  <span className="text-[11px] font-black text-blue-700 truncate">{p.callsign}</span>
                                                </div>
                                              ))}
                                            </div>
                                            <span className="text-[9px] font-black text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded uppercase shrink-0 border border-blue-200">
                                              {pilotsToShow[0]?.label || "Booked"}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-between text-gray-400 text-xs">
                                            <span className="text-[11px] font-medium italic">Unbooked</span>
                                            <span className="text-[9px] font-bold uppercase bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">Open</span>
                                          </div>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          )}
        </div>
        ) : (
          /* Landing Page UI when no activeGroup is selected */
          <div className="max-w-4xl mx-auto mt-6 md:mt-10 animate-fade-in px-2">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
              ) : null}

              <div className="bg-white border border-brand-border rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase bg-gray-100 px-3 py-1 rounded-full">All Flying Groups</span>
                  <h3 className="text-xl font-bold text-gray-800 mt-4">Select Group Directory</h3>
                  <p className="text-gray-500 text-xs mt-2 leading-relaxed">
                    Browse schedules for any active fleet group across the airline.
                  </p>
                  <select
                    value={activeGroup ?? ""}
                    onChange={e => setActiveGroup(e.target.value ? Number(e.target.value) : null)}
                    className="mt-4 w-full border border-brand-border rounded-xl px-4 py-3 bg-white text-xs font-bold text-brand focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer shadow-xs"
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

              {editingSchedule.status === "draft" && (
                (() => {
                  const depDate = new Date(editingSchedule.scheduled_departure + "Z");
                  const arrDate = new Date(editingSchedule.scheduled_arrival + "Z");
                  const durHrs = (arrDate.getTime() - depDate.getTime()) / 3600000;
                  const isShort = durHrs < 8.0;
                  const tokenCount = isShort ? (quota?.purchased_short_slots ?? 0) : (quota?.purchased_long_slots ?? 0);
                  const tokenLabel = isShort ? "Short-Haul" : "Long-Haul";
                  const isBlocked = quota && quota.remaining_free_slots === 0 && tokenCount === 0;

                  return (
                    <div className="w-full text-[11px] bg-brand-pale border border-brand-border rounded-xl p-2.5 space-y-1 mb-2">
                      <p className="font-bold text-brand-dark flex justify-between">
                        <span>Proposal Quota:</span>
                        <a href="/shop" className="text-brand hover:underline font-extrabold">Shop &rarr;</a>
                      </p>
                      {quota ? (
                        <div className="text-gray-600 space-y-0.5">
                          <div className="flex justify-between">
                            <span>Weekly Free Limit:</span>
                            <span className="font-bold">{quota.proposals_used} / {quota.weekly_limit}</span>
                          </div>
                          {quota.remaining_free_slots > 0 ? (
                            <p className="text-emerald-700 font-bold mt-1">✓ Proposing this flight is FREE (uses weekly slot)</p>
                          ) : (
                            <div className="space-y-1 border-t border-brand-border/40 pt-1 mt-1 font-semibold">
                              {isBlocked ? (
                                <p className="text-rose-600 font-bold">❌ Weekly free slots exhausted. No {tokenLabel} token available. Buy one in the Shop to propose.</p>
                              ) : (
                                <>
                                  <p className="text-amber-800 text-[10px]">Weekly quota reached! Proposing will consume 1x {tokenLabel} token.</p>
                                  <div className="grid grid-cols-2 gap-1 text-[9px] text-gray-500 font-bold uppercase tracking-wider text-center">
                                    <div className={`p-1 rounded border ${isShort ? "bg-brand/10 border-brand text-brand" : "bg-white/60 border-brand-border/40"}`}>
                                      <div>Short Token</div>
                                      <div className="text-xs font-black">{quota.purchased_short_slots} left</div>
                                    </div>
                                    <div className={`p-1 rounded border ${!isShort ? "bg-brand/10 border-brand text-brand" : "bg-white/60 border-brand-border/40"}`}>
                                      <div>Long Token</div>
                                      <div className="text-xs font-black">{quota.purchased_long_slots} left</div>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-400">Loading quota details...</p>
                      )}
                    </div>
                  );
                })()
              )}

              <div className="flex gap-2 flex-wrap w-full">
                {editingSchedule.status === "draft" && (
                  (() => {
                    const depDate = new Date(editingSchedule.scheduled_departure + "Z");
                    const arrDate = new Date(editingSchedule.scheduled_arrival + "Z");
                    const durHrs = (arrDate.getTime() - depDate.getTime()) / 3600000;
                    const isShort = durHrs < 8.0;
                    const tokenCount = isShort ? (quota?.purchased_short_slots ?? 0) : (quota?.purchased_long_slots ?? 0);
                    const isBlocked = quota && quota.remaining_free_slots === 0 && tokenCount === 0;

                    return (
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
                        disabled={Boolean(isBlocked)}
                        className="flex-1 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white py-2 cursor-pointer font-bold disabled:cursor-not-allowed text-center"
                      >
                        Propose
                      </button>
                    );
                  })()
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

      {/* CREATE POPUP — 2-Step: Step 1: Aircraft Picker Slider | Step 2: Route & Time */}
      {popup && (() => {
        // Compute qualified frames
        const qualifiedTypeIds = new Set<number>();
        (currentPilot?.careers ?? []).forEach((c: any) => {
          if (c.selected_aircraft_ids) {
            c.selected_aircraft_ids.split(",").forEach((id: string) => {
              const n = parseInt(id.trim(), 10);
              if (!isNaN(n)) qualifiedTypeIds.add(n);
            });
          }
        });
        const filteredFrames = qualifiedTypeIds.size > 0 && !isExecutiveOrAdmin
          ? airframes.filter(a => qualifiedTypeIds.has(a.aircraft_type_id))
          : airframes;
        const selectedAc = filteredFrames.find(a => a.id === selAircraftId);
        const selectedAcType = selectedAc ? types.find(t => t.id === selectedAc.aircraft_type_id) : null;
        const selectedAcImg = selectedAc ? (aircraftImages as any)[String(selectedAc.aircraft_type_id)] : null;

        const dayDate = new Date(weekStart + "T00:00:00Z");
        dayDate.setUTCDate(dayDate.getUTCDate() + popup.day);
        const dayLabel = `${days[popup.day]} ${dayDate.getUTCDate()}/${dayDate.getUTCMonth() + 1}`;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setPopup(null)}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
              onClick={e => e.stopPropagation()}
              style={{ maxHeight: "90vh" }}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-brand-dark to-brand px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">New Flight · {dayLabel}</p>
                  <h3 className="text-white text-lg font-black mt-0.5">
                    {createStep === 1 ? "Select Aircraft" : "Configure Flight"}
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  {/* Step indicator */}
                  <div className="flex gap-1.5">
                    <div className={`w-2 h-2 rounded-full transition-all ${createStep === 1 ? "bg-white scale-110" : "bg-white/40"}`} />
                    <div className={`w-2 h-2 rounded-full transition-all ${createStep === 2 ? "bg-white scale-110" : "bg-white/40"}`} />
                  </div>
                  <button
                    onClick={() => setPopup(null)}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-lg transition-all cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              </div>

              {createStep === 1 ? (
                /* ── STEP 1: Aircraft Slider ── */
                <div className="p-6" style={{ overflowY: "auto", maxHeight: "calc(90vh - 82px)" }}>
                  <p className="text-xs text-gray-500 font-semibold mb-4">
                    Choose the airframe you want to schedule. Swipe or scroll horizontally.
                  </p>
                  {filteredFrames.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-gray-400 font-semibold text-sm">No qualified aircraft available.</p>
                      <p className="text-gray-300 text-xs mt-1">Contact staff to configure your aircraft types.</p>
                    </div>
                  ) : (
                    <div
                      className="flex gap-4 overflow-x-auto pb-3"
                      style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
                    >
                      {filteredFrames.map(ac => {
                        const t = types.find(ty => ty.id === ac.aircraft_type_id);
                        const img = (aircraftImages as any)[String(ac.aircraft_type_id)];
                        const isSelected = ac.id === selAircraftId;
                        return (
                          <button
                            key={ac.id}
                            onClick={() => setSelAircraftId(isSelected ? 0 : ac.id)}
                            className={`flex-shrink-0 w-52 rounded-2xl border-2 overflow-hidden transition-all cursor-pointer text-left shadow-sm hover:shadow-lg ${
                              isSelected
                                ? "border-brand shadow-brand/20 scale-[1.02]"
                                : "border-brand-border hover:border-brand/40"
                            }`}
                            style={{ scrollSnapAlign: "start" }}
                          >
                            {/* Aircraft Image */}
                            <div className="h-28 bg-gray-100 relative overflow-hidden">
                              {img ? (
                                <img
                                  src={img.url}
                                  alt={t?.name || ac.registration}
                                  className="w-full h-full object-cover"
                                  style={{ objectPosition: img.objectPosition || "center 40%" }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                  </svg>
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute inset-0 bg-brand/10 flex items-center justify-center">
                                  <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center shadow-lg">
                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Aircraft Info */}
                            <div className="p-3 bg-white">
                              <p className="text-xs font-black text-gray-900 truncate">{ac.registration}</p>
                              <p className="text-[10px] font-bold text-brand truncate mt-0.5">{t?.name || "Unknown"}{t?.liveryname ? ` · ${t.liveryname}` : ""}</p>
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[9px] font-black text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded">{ac.current_airport}</span>
                                <span className="text-[9px] text-gray-300 font-bold">parked at</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Step 1 → Step 2 CTA */}
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => setPopup(null)}
                      className="flex-1 py-3 rounded-2xl border border-brand-border text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!selAircraftId}
                      onClick={() => {
                        if (selAircraftId > 0) {
                          setCreateStep(2);
                          loadRoutesForAircraft(selAircraftId, popup.day, popup.hour);
                        }
                      }}
                      className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-brand-dark to-brand text-white font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-40 cursor-pointer"
                    >
                      Next — Configure Route →
                    </button>
                  </div>
                </div>
              ) : (
                /* ── STEP 2: Route & Time Form ── */
                <div className="p-6" style={{ overflowY: "auto", maxHeight: "calc(90vh - 82px)" }}>
                  {/* Selected aircraft preview */}
                  {selectedAc && (
                    <div className="flex items-center gap-3 mb-5 p-3 rounded-2xl bg-brand-pale border border-brand/20">
                      <div className="w-16 h-10 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                        {selectedAcImg ? (
                          <img
                            src={selectedAcImg.url}
                            alt={selectedAcType?.name || selectedAc.registration}
                            className="w-full h-full object-cover"
                            style={{ objectPosition: selectedAcImg.objectPosition || "center 40%" }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-brand">{selectedAc.registration}</p>
                        <p className="text-[10px] text-gray-500 font-semibold truncate">{selectedAcType?.name || "?"}{selectedAcType?.liveryname ? ` · ${selectedAcType.liveryname}` : ""}</p>
                        {popup.position && <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">Current position: <span className="font-black text-brand">{popup.position}</span></p>}
                      </div>
                      <button
                        onClick={() => { setCreateStep(1); setSelRouteId(0); setAvailableRoutes([]); }}
                        className="ml-auto text-[10px] font-black text-brand/60 hover:text-brand border border-brand/20 px-2 py-1 rounded-lg transition-all cursor-pointer shrink-0"
                      >
                        ← Change
                      </button>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Day of Week */}
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">Day of Week</label>
                      <select
                        value={popup.day}
                        onChange={e => {
                          const newDay = Number(e.target.value);
                          setPopup(p => p ? { ...p, day: newDay } : p);
                          if (selAircraftId > 0) loadRoutesForAircraft(selAircraftId, newDay);
                        }}
                        className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm cursor-pointer focus:outline-none focus:border-brand"
                      >
                        {days.map((d, i) => {
                          const dt = new Date(weekStart + "T00:00:00Z");
                          dt.setUTCDate(dt.getUTCDate() + i);
                          return (
                            <option key={d} value={i}>
                              {d} ({dt.getUTCDate()}/{dt.getUTCMonth() + 1})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Time & Ground Time side by side */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">Dep Time (UTC)</label>
                        <input
                          type="time"
                          value={selTime}
                          onChange={e => setSelTime(e.target.value)}
                          className="w-full border border-brand-border rounded-xl px-3 py-2.5 text-sm focus:border-brand focus:ring-1 focus:ring-brand/30 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">Ground Time (min)</label>
                        <input
                          type="number"
                          value={selGroundTime}
                          onChange={e => setSelGroundTime(Number(e.target.value))}
                          min={30}
                          max={480}
                          className="w-full border border-brand-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 -mt-2">A320=45m · A330=90m · B777=120m · A380=180m</p>

                    {/* Override Dep ICAO */}
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">Override Dep ICAO <span className="font-medium normal-case text-gray-300">(optional)</span></label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={4}
                          placeholder={popup.position || "e.g. EGLL"}
                          value={selOverrideDep}
                          onChange={e => setSelOverrideDep(e.target.value.toUpperCase())}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (selAircraftId > 0 && (selOverrideDep === "" || selOverrideDep.trim().length === 4))
                                loadRoutesForAircraft(selAircraftId, undefined, undefined, selOverrideDep);
                            }
                          }}
                          className="flex-1 border border-brand-border rounded-xl px-4 py-2.5 text-sm uppercase font-mono tracking-wider focus:outline-none focus:border-brand"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (selAircraftId > 0 && (selOverrideDep === "" || selOverrideDep.trim().length === 4))
                              loadRoutesForAircraft(selAircraftId, undefined, undefined, selOverrideDep);
                          }}
                          disabled={Boolean(selOverrideDep && selOverrideDep.trim().length !== 4)}
                          className="px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-all disabled:opacity-40 cursor-pointer shrink-0"
                        >
                          Query DB
                        </button>
                      </div>
                      {selOverrideDep && selOverrideDep.trim().length !== 4 && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1">Write full 4-letter ICAO (e.g. EGLL, SBGR) then press Enter or Query DB.</p>
                      )}
                    </div>

                    {/* Route Selection */}
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                        Route {popup.position ? `from ${popup.position}` : ""}
                        {loadingRoutes && <span className="ml-2 normal-case font-normal text-gray-400">Loading...</span>}
                      </label>
                      <select
                        value={selRouteId}
                        onChange={e => setSelRouteId(Number(e.target.value))}
                        className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm cursor-pointer focus:outline-none focus:border-brand"
                      >
                        <option value={0}>Select route…</option>
                        {availableRoutes.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.dep}→{r.arr} [{r.fltnum?.split(",")[0]?.trim() || `#${r.id}`}] ({Math.floor(r.duration / 3600)}h{Math.floor(r.duration % 3600 / 60)}m)
                          </option>
                        ))}
                      </select>
                      {!loadingRoutes && selAircraftId > 0 && availableRoutes.length === 0 && (
                        <p className="text-xs text-orange-500 mt-1">No routes from this position for this aircraft type.</p>
                      )}
                    </div>

                    {/* Route Preview */}
                    {selectedRoute && (
                      <div className="bg-brand-pale rounded-2xl p-4 border border-brand/10">
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <p className="text-lg font-black text-gray-900">{selectedRoute.dep}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">DEP</p>
                          </div>
                          <div className="flex-1 flex flex-col items-center">
                            <div className="w-full flex items-center gap-1">
                              <div className="flex-1 h-px bg-brand/30" />
                              <span className="text-brand text-xs">✈</span>
                              <div className="flex-1 h-px bg-brand/30" />
                            </div>
                            <p className="text-[10px] font-bold text-brand mt-1">{Math.floor(selectedRoute.duration / 3600)}h {Math.floor(selectedRoute.duration % 3600 / 60)}m</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-black text-gray-900">{selectedRoute.arr}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">ARR</p>
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 text-center mt-2">{selectedRoute.fltnum?.split(",")[0]?.trim() || `Route #${selectedRoute.id}`}</p>
                      </div>
                    )}

                    {/* Save Button */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => setCreateStep(1)}
                        className="py-3 px-5 rounded-2xl border border-brand-border text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all cursor-pointer"
                      >
                        ← Back
                      </button>
                      <button
                        onClick={doCreate}
                        disabled={!selAircraftId || !selRouteId}
                        className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-brand-dark to-brand text-white font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-40 cursor-pointer"
                      >
                        Save as Draft
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
