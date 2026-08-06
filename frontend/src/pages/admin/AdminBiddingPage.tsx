import React, { useEffect, useState } from "react";
import { biddingApi } from "../../api/biddingApi";
import type { BiddingSession, BiddingApplicant } from "../../api/biddingApi";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchGroups } from "../../store/slices/groupSlice";
import PilotHoursBadge from "../../components/PilotHoursBadge";

export const AdminBiddingPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { groups } = useAppSelector((s) => s.group);

  const [sessions, setSessions] = useState<BiddingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Session Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number>(0);
  const [slotsOffered, setSlotsOffered] = useState<number>(1);
  const [biddingFee, setBiddingFee] = useState<number>(3000);
  const [pathSwitchFee, setPathSwitchFee] = useState<number>(40000);
  const [durationDays, setDurationDays] = useState<number>(4);
  const [notes, setNotes] = useState<string>("");

  // Inspect Session State
  const [activeSession, setActiveSession] = useState<BiddingSession | null>(null);
  const [selectedWinners, setSelectedWinners] = useState<number[]>([]);
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [submittingFinalize, setSubmittingFinalize] = useState(false);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await biddingApi.getSessions();
      setSessions(data);
      if (activeSession) {
        const updated = data.find((s) => s.id === activeSession.id);
        if (updated) setActiveSession(updated);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load bidding sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(fetchGroups());
    loadSessions();
  }, []);

  useEffect(() => {
    if (groups.length > 0 && selectedGroupId === 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await biddingApi.createSession({
        group_id: selectedGroupId,
        slots_offered: slotsOffered,
        bidding_fee_qar: biddingFee,
        path_switch_fee_qar: pathSwitchFee,
        duration_days: durationDays,
        notes: notes.trim() || undefined,
      });
      setShowCreateForm(false);
      setNotes("");
      loadSessions();
    } catch (err: any) {
      setError(err.message || "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  const toggleWinnerSelection = (pilotId: number) => {
    if (selectedWinners.includes(pilotId)) {
      setSelectedWinners(selectedWinners.filter((id) => id !== pilotId));
    } else {
      if (activeSession && selectedWinners.length >= activeSession.slots_offered) {
        alert(`You can only select up to ${activeSession.slots_offered} winner(s) for this session.`);
        return;
      }
      setSelectedWinners([...selectedWinners, pilotId]);
    }
  };

  const handleFinalizeSession = async () => {
    if (!activeSession) return;
    if (selectedWinners.length === 0) {
      if (!window.confirm("No winners selected. Are you sure you want to finalize and reject all applicants?")) {
        return;
      }
    }

    try {
      setSubmittingFinalize(true);
      setError(null);
      await biddingApi.finalizeSession(activeSession.id, {
        winner_pilot_ids: selectedWinners,
        admin_notes: adminNotes.trim() || undefined,
      });
      setSelectedWinners([]);
      setAdminNotes("");
      setActiveSession(null);
      loadSessions();
    } catch (err: any) {
      setError(err.message || "Failed to finalize session");
    } finally {
      setSubmittingFinalize(false);
    }
  };

  const handleCancelSession = async (sessionId: number) => {
    if (
      !window.confirm(
        `Are you sure you want to cancel Bidding Session #${sessionId}? All active applicants will be issued a 100% refund for their bidding and path switch fees.`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await biddingApi.cancelSession(sessionId);
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
      }
      loadSessions();
    } catch (err: any) {
      setError(err.message || "Failed to cancel session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-900/60 p-6 rounded-3xl border border-gray-800 backdrop-blur-md">
        <div>
          <span className="text-xs uppercase tracking-wider font-extrabold text-blue-400">
            Fleet Operations & Capacity
          </span>
          <h1 className="text-2xl font-black text-white">Vacancy Bidding Management</h1>
          <p className="text-xs text-gray-400 mt-1">
            Open 4-day bidding rounds for group pilot slots, review candidates, and process automated transfers.
          </p>
        </div>

        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-2xl text-xs shadow-lg transition-all"
        >
          {showCreateForm ? "Cancel" : "＋ Create New Bidding Session"}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-2xl text-red-300 text-xs">
          ⚠️ {error}
        </div>
      )}

      {/* Create Session Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateSession} className="bg-gray-900/90 p-6 rounded-3xl border border-blue-500/30 space-y-4 shadow-xl">
          <h3 className="text-lg font-bold text-white border-b border-gray-800 pb-2">
            Publish New Bidding Session
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-gray-400 font-bold mb-1">Target Flying Group</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 text-white p-2.5 rounded-xl font-semibold"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.available_slots} Slots Open)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-400 font-bold mb-1">Slots Offered</label>
              <input
                type="number"
                min={1}
                max={20}
                value={slotsOffered}
                onChange={(e) => setSlotsOffered(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 text-white p-2.5 rounded-xl font-semibold"
              />
            </div>

            <div>
              <label className="block text-gray-400 font-bold mb-1">Duration (Days)</label>
              <input
                type="number"
                min={1}
                max={14}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 text-white p-2.5 rounded-xl font-semibold"
              />
            </div>

            <div>
              <label className="block text-gray-400 font-bold mb-1">Entry Bidding Fee (QAR)</label>
              <input
                type="number"
                min={0}
                value={biddingFee}
                onChange={(e) => setBiddingFee(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 text-white p-2.5 rounded-xl font-semibold"
              />
            </div>

            <div>
              <label className="block text-gray-400 font-bold mb-1">Path Switch Fee (QAR)</label>
              <input
                type="number"
                min={0}
                value={pathSwitchFee}
                onChange={(e) => setPathSwitchFee(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 text-white p-2.5 rounded-xl font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-400 font-bold mb-1 text-xs">Internal Notes / Requirements</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for pilots viewing this bidding vacancy..."
              className="w-full bg-gray-800 border border-gray-700 text-white p-2.5 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all"
            >
              Publish Bidding Round
            </button>
          </div>
        </form>
      )}

      {/* Sessions List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`p-6 rounded-3xl border transition-all ${
              activeSession?.id === s.id
                ? "bg-gray-900 border-blue-500 ring-2 ring-blue-500/20"
                : "bg-gray-900/60 border-gray-800 hover:border-gray-700"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  Session #{s.id}
                </span>
                <h3 className="text-xl font-black text-white">{s.group_name}</h3>
              </div>

              <span
                className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                  s.status === "open"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : s.status === "under_review"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : "bg-gray-800 text-gray-400 border-gray-700"
                }`}
              >
                {s.status.replace("_", " ")}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs bg-gray-800/40 p-3 rounded-2xl border border-gray-800">
              <div>
                <span className="text-gray-500 font-bold block">Slots Offered</span>
                <span className="text-gray-200 font-extrabold">{s.slots_offered}</span>
              </div>

              <div>
                <span className="text-gray-500 font-bold block">Applicants</span>
                <span className="text-amber-400 font-extrabold">{s.applicant_count} Pilot(s)</span>
              </div>

              <div>
                <span className="text-gray-500 font-bold block">Bidding Fee</span>
                <span className="text-gray-200 font-semibold">{s.bidding_fee_qar.toLocaleString()} QAR</span>
              </div>

              <div>
                <span className="text-gray-500 font-bold block">Path Switch Fee</span>
                <span className="text-purple-300 font-semibold">{s.path_switch_fee_qar.toLocaleString()} QAR</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
              <span>Closes: {new Date(s.closes_at).toLocaleDateString()}</span>

              <div className="flex items-center gap-2">
                {(s.status === "open" || s.status === "under_review") && (
                  <button
                    onClick={() => handleCancelSession(s.id)}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white font-bold rounded-xl border border-red-500/30 transition-colors"
                  >
                    Cancel Session
                  </button>
                )}

                <button
                  onClick={() => {
                    setActiveSession(s);
                    setSelectedWinners([]);
                  }}
                  className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white font-bold rounded-xl border border-blue-500/30 transition-colors"
                >
                  Review Applicants ({s.applicants?.length || s.applicant_count}) →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Review & Finalize Applicants Panel */}
      {activeSession && (
        <div className="bg-gray-900 p-6 rounded-3xl border border-blue-500/40 space-y-6 shadow-2xl animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Reviewing Session #{activeSession.id}
              </span>
              <h2 className="text-2xl font-black text-white">
                {activeSession.group_name} — {activeSession.slots_offered} Slot(s) Up For Award
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold">
                Selected Winners: {selectedWinners.length} / {activeSession.slots_offered}
              </span>

              <button
                onClick={() => setActiveSession(null)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>

          {/* Applicants Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-300">
              Submitted Bids ({activeSession.applicants?.length || 0})
            </h3>

            {(!activeSession.applicants || activeSession.applicants.length === 0) ? (
              <div className="text-center py-8 bg-gray-800/40 rounded-2xl text-gray-400 text-xs">
                No active pilot bids submitted for this session yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSession.applicants.map((app: BiddingApplicant) => {
                  const isSelected = selectedWinners.includes(app.pilot_id);

                  return (
                    <div
                      key={app.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? "bg-emerald-950/40 border-emerald-500 shadow-lg ring-2 ring-emerald-500/30"
                          : "bg-gray-800/60 border-gray-700/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-white">
                              {app.pilot_callsign}
                            </span>
                            {app.pilot_name && (
                              <span className="text-xs text-gray-400">({app.pilot_name})</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 block mt-0.5">
                            Current Fleet: <strong className="text-gray-200">{app.current_group_name}</strong>
                          </span>
                        </div>

                        {/* Pilot Hours Badge (CEO Component Integration) */}
                        {app.hours_breakdown && (
                          <PilotHoursBadge
                            pilotId={app.pilot_id}
                            bookings={[]}
                            summary={{
                              fullBookHours: app.hours_breakdown.full_book_hours,
                              onlyDepHours: app.hours_breakdown.only_dep_hours,
                              onlyArriHours: app.hours_breakdown.only_arri_hours,
                              totalHours: app.hours_breakdown.total_hours,
                              fullBookCount: 0,
                              onlyDepCount: 0,
                              onlyArriCount: 0,
                              totalBookingsCount: 0,
                            }}
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs bg-gray-900/60 p-2.5 rounded-xl">
                        <span>
                          Path Switch:{" "}
                          <strong className={app.path_switch_required ? "text-purple-300" : "text-gray-400"}>
                            {app.path_switch_required ? "Yes (40,000 QAR)" : "No"}
                          </strong>
                        </span>

                        <span className="text-gray-400">
                          Fee Paid: <strong className="text-emerald-400">{(app.bidding_fee_paid + app.path_switch_fee_paid).toLocaleString()} QAR</strong>
                        </span>
                      </div>

                      {activeSession.status !== "closed" && app.status === "submitted" && (
                        <button
                          onClick={() => toggleWinnerSelection(app.pilot_id)}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? "bg-emerald-600 text-white shadow-md"
                              : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                          }`}
                        >
                          {isSelected ? "✓ Selected as Winner" : "Select Winner Slot"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Finalize Action Bar */}
          {activeSession.status !== "closed" && (
            <div className="pt-4 border-t border-gray-800 space-y-3">
              <input
                type="text"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Optional admin decision notes..."
                className="w-full bg-gray-800 border border-gray-700 text-white p-2.5 rounded-xl text-xs"
              />

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => handleCancelSession(activeSession.id)}
                  disabled={loading}
                  className="px-4 py-2.5 bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white font-bold rounded-xl text-xs border border-red-500/40 transition-all"
                >
                  🚫 Cancel Entire Session & Refund All
                </button>

                <button
                  onClick={handleFinalizeSession}
                  disabled={submittingFinalize}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all disabled:opacity-50"
                >
                  {submittingFinalize ? "Finalizing..." : `Award Selected Pilots (${selectedWinners.length}) & Close Session`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminBiddingPage;
