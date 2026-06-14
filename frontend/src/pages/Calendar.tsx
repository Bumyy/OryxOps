import { useEffect, useMemo, useState, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  fetchSchedules, createSchedule, updateSchedule, deleteSchedule,
  approveSchedule, rejectSchedule, proposeSchedule, bulkApproveSchedules, fetchWaves,
} from "../store/slices/scheduleSlice";
import { createBooking } from "../store/slices/bookingSlice";
import { fetchGroups } from "../store/slices/groupSlice";
import { fetchAirframes, fetchAircraftTypes } from "../store/slices/aircraftSlice";
import { api } from "../api/client";

interface AvailableRoute { id: number; fltnum: string; dep: string; arr: string; duration: number; notes: string | null; }
interface PositionError { aircraftId: number; registration: string; scheduleId: number; expectedDep: string; actualDep: string; status: "ok" | "mismatch" | "ground_short"; }
interface FlightBlock { schedule: any; col: number; rowStart: number; rowEnd: number; isError: boolean; isGroundIssue: boolean; showGroundTime: boolean; subCol: number; maxSubCols: number; }

export default function Calendar() {
  const dispatch = useAppDispatch();
  const { schedules, waves } = useAppSelector((s) => s.schedule);
  const { groups } = useAppSelector((s) => s.group);
  const { airframes, types } = useAppSelector((s) => s.aircraft);

  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(getWeekStart);
  const [filterAircraftId, setFilterAircraftId] = useState(0);
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
  const [bookings, setBookings] = useState<Record<number, any[]>>({});
  const [myBookingsFilter, setMyBookingsFilter] = useState(false);
  const user = useAppSelector((s: any) => s.auth.user);

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const HOUR_HEIGHT = 40;

  useEffect(() => {
    dispatch(fetchGroups()); dispatch(fetchAirframes()); dispatch(fetchAircraftTypes());
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") { setPopup(null); setEditingSchedule(null); } };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (activeGroup) {
      const apiStatus = statusFilter === "active" ? undefined : (statusFilter || undefined);
      dispatch(fetchSchedules({ group_id: activeGroup, week_start: weekStart, status: apiStatus }));
      dispatch(fetchWaves({ week_start: weekStart }));
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

  function getWeekStart() { const d = new Date(); d.setUTCDate(d.getUTCDate() - d.getUTCDay() + 1); return d.toISOString().split("T")[0]; }
  function getSlotDate(day: number, hour: number): Date { const d = new Date(weekStart + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + day); d.setUTCHours(hour, 0, 0, 0); return d; }

  const baseSchedules = useMemo(() => {
    let bs = statusFilter === "active" ? schedules.filter(s => s.status !== "cancelled") : schedules;
    if (myBookingsFilter && user) {
      const myBkdIds = new Set(Object.entries(bookings).filter(([_, bs]) => bs.some((b: any) => b.pilot_id === user.id)).map(([sid]) => Number(sid)));
      bs = bs.filter(s => myBkdIds.has(s.id));
    }
    return bs;
  }, [schedules, statusFilter, myBookingsFilter, bookings, user]);

  const filteredSchedules = useMemo(() => {
    if (!filterAircraftId) return baseSchedules;
    return baseSchedules.filter(s => Number(s.aircraft_id) === Number(filterAircraftId));
  }, [baseSchedules, filterAircraftId]);

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
      <h1 className="text-3xl md:text-5xl font-bold text-brand mb-3 md:mb-8">Schedule Calendar</h1>
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <select value={activeGroup ?? ""} onChange={e => setActiveGroup(e.target.value ? Number(e.target.value) : null)} className="border border-brand-border rounded-xl px-3 py-2 bg-white text-xs">
          <option value="">Group</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className="border border-brand-border rounded-xl px-3 py-2 bg-white text-xs" />
        <select value={filterAircraftId} onChange={e => setFilterAircraftId(Number(e.target.value))} className="border border-brand-border rounded-xl px-3 py-2 bg-white text-xs">
          <option value={0}>All</option>{airframes.map(a => { const t = types.find(ty => ty.id === a.aircraft_type_id); return <option key={a.id} value={a.id}>{a.registration} ({t?.name || "?"}{t?.liveryname ? ` ${t.liveryname}` : ""})</option>; })}
        </select>
        <div className="flex gap-1 flex-wrap">
          {[["active","Active"],[null,"All"],["draft","Draft"],["proposed","Proposed"],["approved","Approved"],["cancelled","Cancelled"]].map(([v,l]) => (
            <button key={v??"all"} onClick={()=>setStatusFilter(v)} className={`rounded-full text-xs font-bold border px-2 py-1 transition-colors ${statusFilter===v?"bg-brand text-white border-brand":"border-brand-border text-gray-500 hover:bg-brand-hover-bg"}`}>{l}</button>
          ))}
        </div>
        {activeGroup && <button onClick={()=>dispatch(bulkApproveSchedules({group_id:activeGroup,week_start:weekStart})).then(refreshSchedules)} className="rounded-full bg-green-600 text-white font-semibold text-xs px-3 py-1.5 hover:bg-green-700">Approve All</button>}
        {user && <button onClick={()=>setMyBookingsFilter(!myBookingsFilter)} className={`rounded-full text-xs font-bold border px-3 py-1.5 transition-colors ${myBookingsFilter?"bg-blue-500 text-white border-blue-500":"border-brand-border text-gray-500 hover:bg-brand-hover-bg"}`}>👤 My Bookings</button>}
      </div>
      {positionErrors.filter(e=>e.status==="mismatch").map(e=>(<div key={`e-${e.scheduleId}`} className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-1 text-xs font-semibold mb-1">⚠ {e.registration}: Expected {e.expectedDep} but flight departs {e.actualDep}</div>))}
      {positionErrors.filter(e=>e.status==="ground_short").map(e=>(<div key={`g-${e.scheduleId}`} className="bg-orange-50 border border-orange-200 text-orange-700 rounded-xl px-3 py-1 text-xs font-semibold mb-1">⏱ {e.registration}: Ground {e.expectedDep.replace("gap:","")} vs req {e.actualDep.replace("need:","")}</div>))}

      {activeGroup ? (
        <div className="bg-white rounded-xl md:rounded-2xl border border-brand-border shadow-sm overflow-x-auto -mx-2 md:mx-0">
          <div className="min-w-[700px] md:min-w-[900px] relative">
            <div className="grid grid-cols-8">
              <div className="border-b border-r border-brand-border bg-brand-pale p-1.5 text-[10px] font-bold text-gray-500 text-center">UTC</div>
              {days.map((d,i)=>{const dt=new Date(weekStart+"T00:00:00Z");dt.setUTCDate(dt.getUTCDate()+i);return(<div key={d} className="border-b border-r border-brand-border bg-brand-pale p-1.5 text-[10px] font-bold text-gray-500 text-center">{d} {dt.getUTCDate()}/{dt.getUTCMonth()+1}</div>);})}
            </div>
            <div className="grid grid-cols-8 relative" style={{minHeight:24*HOUR_HEIGHT}}>
              {Array.from({length:24},(_,h)=>(
                <div key={`r-${h}`} className="contents">
                  <div className="border-b border-r border-brand-border p-1 text-[9px] text-gray-400 text-center font-mono bg-brand-pale/50 flex items-center justify-center" style={{height:HOUR_HEIGHT}}>{String(h).padStart(2,"0")}:00</div>
                  {days.map((_,di)=>(<div key={`${di}-${h}`} onClick={()=>openPopup(di,h)} onDragOver={handleDragOver} onDrop={e=>handleDrop(e,di,h)} className="border-b border-r border-brand-border cursor-pointer hover:bg-brand-hover-bg transition-colors" style={{height:HOUR_HEIGHT}}/>))}
                </div>
              ))}
              {waves.filter(w=>w.week_start===weekStart).map(w=>{const sh=Number(w.departure_window_start.split(":")[0])+Number(w.departure_window_start.split(":")[1])/60;const eh=Number(w.departure_window_end.split(":")[0])+Number(w.departure_window_end.split(":")[1])/60;const ia=w.wave_type==="arrival";return(<div key={`wv-${w.id}`} className={`absolute left-0 right-0 pointer-events-none z-0 ${ia?"bg-blue-100/30 border-l-4 border-blue-400":"bg-green-100/30 border-l-4 border-green-400"}`} style={{top:sh*HOUR_HEIGHT,height:Math.max((eh-sh)*HOUR_HEIGHT,8)}}><span className={`text-[9px] font-bold px-1 ${ia?"text-blue-600":"text-green-600"}`}>{ia?"ARR":"DEP"} {w.name}</span></div>);})}
              {flightBlocks.map(fb=>{
                const colPct=100/8, subW=colPct/fb.maxSubCols, wPct=subW-0.3, lOff=(fb.col+1)*colPct+fb.subCol*subW, top=fb.rowStart*HOUR_HEIGHT, ht=(fb.rowEnd-fb.rowStart)*HOUR_HEIGHT;
                const gt=fb.schedule.ground_time_minutes||60, gtH=Math.max((gt/60)*HOUR_HEIGHT,8);
                const s=fb.schedule, dur=Math.round((new Date(s.scheduled_arrival+"Z").getTime()-new Date(s.scheduled_departure+"Z").getTime())/360000)/10;
                  const bkd = bookings[s.id] || [];
                  const bookedBy = bkd.filter((b: any) => b.status === "booked").map((b: any) => b.pilot_callsign).join(", ");
                  const hasBooking = bkd.length > 0;
                  return (<div key={s.id}>
                  <div className={`absolute rounded-t-lg px-1 py-0.5 text-[8px] leading-tight cursor-pointer overflow-hidden border border-b-0 ${fb.isError?"bg-red-100 border-red-400 text-red-800":s.status==="cancelled"?"bg-gray-100 border-gray-300 text-gray-400 line-through opacity-60":s.status==="approved"?"bg-green-100 border-green-400 text-green-800":s.status==="proposed"?"bg-yellow-100 border-yellow-400 text-yellow-800":"bg-gray-100 border-gray-300 text-gray-700"} hover:z-20 hover:ring-2 hover:ring-brand/30`}
                    style={{left:`${lOff}%`,width:`${Math.max(wPct,2)}%`,top:`${top}px`,height:`${Math.max(ht,10)}px`,minWidth:"36px"}}
                    onClick={e=>{e.stopPropagation();setEditingSchedule(s);}} draggable onDragStart={e=>handleDragStart(e,s.id)} onDragEnd={handleDragEnd}
                    title={`${s.departure}→${s.arrival} | ${s.aircraft_registration} | ${s.status} | ${dur}h\nBy: ${s.created_by_name||"?"}${s.approved_by?` | Appr: #${s.approved_by}`:""}${hasBooking?`\nBooked: ${bookedBy}`:""}${fb.isError?'\n⚠ Mismatch':''}${fb.isGroundIssue?'\n⚠ GT short':''}\nDrag to move`}>
                    <div className="font-bold truncate flex items-center gap-0.5">{s.aircraft_registration}{s.approved_by&&<span title="Approved" className="text-[7px]">✅</span>}{hasBooking&&<span title={bookedBy} className="text-[7px]">👤</span>}</div>
                    <div className="truncate">{s.departure}→{s.arrival} <span className="opacity-60">{dur}h</span></div>
                    <div className="truncate opacity-70">{s.flight_number||`#${s.id}`} · {s.status} · {s.created_by_name||"?"}{hasBooking?` · ${bookedBy}`:""}</div>
                  </div>
                  {fb.showGroundTime&&<div className={`absolute rounded-b-lg border ${fb.isGroundIssue?"border-orange-400 border-dashed":"border-cyan-200 border-dashed"} bg-cyan-50/80 flex items-center justify-center text-[7px] text-cyan-700 font-semibold overflow-hidden pointer-events-none`} style={{left:`${lOff}%`,width:`${Math.max(wPct,2)}%`,top:`${top+Math.max(ht,10)}px`,height:`${gtH}px`}}>{gtH>=10?`GT ${gt}m`:""}</div>}
                </div>);
              })}
            </div>
          </div>
        </div>
      ):(<div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-brand-border -mx-2 md:mx-0"><p className="text-base">Select a group above to view its schedule.</p></div>)}

      {/* EDIT POPUP */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={()=>setEditingSchedule(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm mx-4" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-bold text-brand mb-3">{editingSchedule.flight_number||`#${editingSchedule.id}`}</h3>
            <div className="space-y-1 text-sm text-gray-600 mb-4">
              <p>{editingSchedule.departure} → {editingSchedule.arrival} <span className="text-xs opacity-60">({Math.round((new Date(editingSchedule.scheduled_arrival+"Z").getTime()-new Date(editingSchedule.scheduled_departure+"Z").getTime())/360000)/10}h)</span></p>
              <p>Aircraft: {editingSchedule.aircraft_registration}</p>
              <p>Status: <span className="font-semibold">{editingSchedule.status}</span> · By: {editingSchedule.created_by_name||"?"}{editingSchedule.approved_by?` · Appr: #${editingSchedule.approved_by}`:""}</p>
              <p className="text-xs text-gray-400">Dep: {new Date(editingSchedule.scheduled_departure+"Z").toISOString().replace("T"," ").slice(0,16)}</p>
              <p className="text-xs text-gray-400">Arr: {new Date(editingSchedule.scheduled_arrival+"Z").toISOString().replace("T"," ").slice(0,16)}</p>
              {(() => { const bkd = bookings[editingSchedule.id] || []; const names = bkd.filter((b: any) => b.status === "booked").map((b: any) => b.pilot_callsign).join(", "); if (names) return <p className="text-xs text-blue-600 font-semibold">Booked by: {names}</p>; return null; })()}
            </div>
            <div className="flex gap-2 flex-wrap">
              {editingSchedule.status==="draft"&&<button onClick={async()=>{await dispatch(proposeSchedule(editingSchedule.id));refreshSchedules();setEditingSchedule(null);}} className="flex-1 rounded-full bg-blue-500 text-white font-semibold text-sm py-2 hover:bg-blue-600">Propose</button>}
              {editingSchedule.status==="proposed"&&<><button onClick={async()=>{await dispatch(approveSchedule(editingSchedule.id));refreshSchedules();setEditingSchedule(null);}} className="flex-1 rounded-full bg-green-600 text-white font-semibold text-sm py-2 hover:bg-green-700">Approve</button><button onClick={async()=>{await dispatch(rejectSchedule(editingSchedule.id));refreshSchedules();setEditingSchedule(null);}} className="flex-1 rounded-full bg-yellow-500 text-white font-semibold text-sm py-2 hover:bg-yellow-600">Reject</button></>}
              {editingSchedule.status==="approved"&&<button onClick={async()=>{await dispatch(createBooking(editingSchedule.id));refreshSchedules();setEditingSchedule(null);}} className="flex-1 rounded-full bg-blue-500 text-white font-semibold text-sm py-2 hover:bg-blue-600">Book Flight</button>}
              <button onClick={()=>{if(confirm("Cancel this flight?")){dispatch(deleteSchedule(editingSchedule.id));refreshSchedules();setEditingSchedule(null);}}} className="flex-1 rounded-full bg-red-500 text-white font-semibold text-sm py-2 hover:bg-red-600">Delete</button>
              <button onClick={()=>setEditingSchedule(null)} className="flex-1 rounded-full bg-gray-200 text-gray-600 font-semibold text-sm py-2 hover:bg-gray-300">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POPUP */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={()=>setPopup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-lg mx-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-brand">Schedule — {days[popup.day]} {(()=>{const d=new Date(weekStart+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+popup.day);return d.toISOString().split("T")[0];})()}</h3>
              <button onClick={()=>setPopup(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-sm font-semibold text-gray-600 mb-1">Time (UTC)</label><input type="time" value={selTime} onChange={e=>setSelTime(e.target.value)} className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm focus:border-brand focus:ring-1 focus:ring-brand/30" /></div>
              <div><label className="block text-sm font-semibold text-gray-600 mb-1">Ground Time After (min)</label><input type="number" value={selGroundTime} onChange={e=>setSelGroundTime(Number(e.target.value))} min={30} max={480} className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm" /><p className="text-xs text-gray-400 mt-1">A320=45m · A330=90m · B777=120m · A380=180m</p></div>
              <div><label className="block text-sm font-semibold text-gray-600 mb-1">Aircraft</label><select value={selAircraftId} onChange={e=>loadRoutesForAircraft(Number(e.target.value))} className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm"><option value={0}>Select</option>{airframes.map(a=>{const t=types.find(ty=>ty.id===a.aircraft_type_id);return(<option key={a.id} value={a.id}>{a.registration} — {t?.name||"?"}{t?.liveryname?` (${t.liveryname})`:""} [at {a.current_airport}]</option>);})}</select>{popup.position&&<p className="text-xs text-brand mt-1 font-semibold">Position: {popup.position}</p>}</div>
              <div><label className="block text-sm font-semibold text-gray-600 mb-1">Override Dep ICAO</label><input type="text" maxLength={4} placeholder={popup.position||"e.g. EGLL"} value={selOverrideDep} onChange={e=>{const v=e.target.value.toUpperCase();setSelOverrideDep(v);if(selAircraftId>0)loadRoutesForAircraft(selAircraftId);}} className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm" /></div>
              <div><label className="block text-sm font-semibold text-gray-600 mb-1">Route {popup.position?`(from ${popup.position})`:""}</label><select value={selRouteId} onChange={e=>setSelRouteId(Number(e.target.value))} className="w-full border border-brand-border rounded-xl px-4 py-2.5 text-sm"><option value={0}>Select</option>{availableRoutes.map(r=>(<option key={r.id} value={r.id}>{r.dep}→{r.arr} [{r.fltnum?.split(",")[0]?.trim()||`#${r.id}`}] ({Math.floor(r.duration/3600)}h{Math.floor(r.duration%3600/60)}m)</option>))}</select>{loadingRoutes&&<p className="text-xs text-gray-400 mt-1">Loading...</p>}{!loadingRoutes&&selAircraftId>0&&availableRoutes.length===0&&<p className="text-xs text-orange-500 mt-1">No routes from this position for this aircraft.</p>}</div>
              {selectedRoute&&<div className="bg-brand-pale rounded-xl p-3 text-sm"><p className="text-gray-600">Arr: <span className="font-semibold text-brand">{selectedRoute.arr}</span> · Dur: <span className="font-semibold">{Math.floor(selectedRoute.duration/3600)}h{Math.floor(selectedRoute.duration%3600/60)}m</span></p></div>}
              <button onClick={doCreate} disabled={!selAircraftId||!selRouteId} className="w-full rounded-full bg-gradient-to-br from-brand-dark to-brand text-white font-semibold py-2.5 hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-40">Save as Draft</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
