import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchSchedules, fetchWaves, createSchedule, proposeSchedule } from "../store/slices/scheduleSlice";
import { fetchGroups } from "../store/slices/groupSlice";

export default function Calendar() {
  const dispatch = useAppDispatch();
  const { schedules, waves, loading } = useAppSelector((s) => s.schedule);
  const { groups } = useAppSelector((s) => s.group);
  const user = useAppSelector((s) => s.auth.user);

  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newDep, setNewDep] = useState("OTHH");
  const [newArr, setNewArr] = useState("");
  const [newSchedDep, setNewSchedDep] = useState("");

  useEffect(() => {
    dispatch(fetchGroups());
  }, []);

  useEffect(() => {
    if (activeGroup) {
      dispatch(fetchSchedules({ group_id: activeGroup, week_start: weekStart, status: statusFilter || undefined }));
      dispatch(fetchWaves({ group_id: activeGroup, week_start: weekStart }));
    }
  }, [activeGroup, weekStart, statusFilter]);

  function getWeekStart() {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return d.toISOString().split("T")[0];
  }

  const filtered = schedules;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-[--color-brand] mb-8">Schedule Calendar</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <select
          value={activeGroup ?? ""}
          onChange={(e) => setActiveGroup(e.target.value ? Number(e.target.value) : null)}
          className="border border-[--color-brand-border] rounded-xl px-4 py-2.5 focus:border-[--color-brand] transition-colors bg-white"
        >
          <option value="">Select a group</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="border border-[--color-brand-border] rounded-xl px-4 py-2.5 focus:border-[--color-brand] transition-colors bg-white"
        />

        <div className="flex gap-2">
          {[null, "draft", "proposed", "approved"].map((s) => (
            <button
              key={s ?? "all"}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full text-xs font-bold border border-[--color-brand-border] px-4 py-1.5 transition-colors duration-200 ${
                statusFilter === s ? "bg-[--color-brand] text-white border-[--color-brand]" : "text-gray-500 hover:bg-[--color-brand-hover-bg]"
              }`}
            >
              {s ?? "All"}
            </button>
          ))}
        </div>

        {activeGroup && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="rounded-full bg-gradient-to-br from-[--color-brand-dark] to-[--color-brand] text-white font-semibold text-sm px-5 py-2 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
          >
            + Add Flight
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && activeGroup && (
        <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm p-6 mb-6">
          <h3 className="text-lg font-bold text-[--color-brand] mb-4">Add Schedule Entry</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <input placeholder="Departure (e.g. OTHH)" value={newDep} onChange={(e) => setNewDep(e.target.value)} className="border border-[--color-brand-border] rounded-xl px-4 py-2.5 text-sm" />
            <input placeholder="Arrival (e.g. KJFK)" value={newArr} onChange={(e) => setNewArr(e.target.value)} className="border border-[--color-brand-border] rounded-xl px-4 py-2.5 text-sm" />
            <input type="datetime-local" value={newSchedDep} onChange={(e) => setNewSchedDep(e.target.value)} className="border border-[--color-brand-border] rounded-xl px-4 py-2.5 text-sm" />
          </div>
          <button
            onClick={async () => {
              if (!newDep || !newArr || !newSchedDep || !activeGroup) return;
              await dispatch(createSchedule({
                group_id: activeGroup,
                aircraft_id: 1, // placeholder
                departure: newDep,
                arrival: newArr,
                scheduled_departure: newSchedDep + ":00",
                scheduled_arrival: newSchedDep + ":00",
                week_start: weekStart,
              }));
              setShowCreate(false);
              dispatch(fetchSchedules({ group_id: activeGroup, week_start: weekStart }));
            }}
            className="rounded-full bg-gradient-to-br from-[--color-brand-dark] to-[--color-brand] text-white font-semibold text-sm px-5 py-2"
          >
            Save Draft
          </button>
        </div>
      )}

      {/* Schedule Table */}
      <div className="bg-white rounded-2xl border border-[--color-brand-border] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[--color-brand-pale] text-left">
              <tr>
                <th className="px-5 py-3 font-semibold text-gray-600">Flight</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Aircraft</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Route</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Departure</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Arrival</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Bookings</th>
                <th className="px-5 py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-[--color-brand-border] hover:bg-[--color-brand-hover-bg] transition-colors">
                  <td className="px-5 py-3 font-mono text-xs">{s.flight_number || `#${s.id}`}</td>
                  <td className="px-5 py-3">{s.aircraft_registration}</td>
                  <td className="px-5 py-3 font-semibold">{s.departure} &rarr; {s.arrival}</td>
                  <td className="px-5 py-3 text-xs">{new Date(s.scheduled_departure).toLocaleString()}</td>
                  <td className="px-5 py-3 text-xs">{new Date(s.scheduled_arrival).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      s.status === "approved" ? "bg-green-100 text-green-700" :
                      s.status === "proposed" ? "bg-yellow-100 text-yellow-700" :
                      s.status === "draft" ? "bg-gray-100 text-gray-600" :
                      "bg-red-100 text-red-700"
                    }`}>{s.status}</span>
                  </td>
                  <td className="px-5 py-3">{s.booking_count}</td>
                  <td className="px-5 py-3">
                    {s.status === "draft" && (
                      <button onClick={() => dispatch(proposeSchedule(s.id))} className="text-xs text-[--color-brand] hover:underline">Propose</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {activeGroup ? "No flights scheduled for this week." : "Select a group to view its schedule."}
          </div>
        )}
      </div>
    </div>
  );
}
