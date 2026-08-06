import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchGroupDetail } from "../store/slices/groupSlice";
import { api } from "../api/client";
import aircraftImages from "../assets/aircraft_images.json";

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { currentGroup } = useAppSelector((s) => s.group);
  const [opsStats, setOpsStats] = useState<{ dispatched: number; no_show: number; booked: number } | null>(null);

  useEffect(() => {
    if (id) dispatch(fetchGroupDetail(Number(id)));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.get<any[]>(`/bookings?group_id=${id}`).then(bs => {
      setOpsStats({
        dispatched: bs.filter((b: any) => b.status === "dispatched").length,
        no_show: bs.filter((b: any) => b.status === "no_show").length,
        booked: bs.filter((b: any) => b.status === "booked").length,
      });
    }).catch(() => setOpsStats(null));
  }, [id]);

  if (!currentGroup) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 text-center text-[var(--text-sub)] font-semibold animate-pulse">
        Loading Flying Group details...
      </div>
    );
  }

  // Helper to resolve high-res aircraft photo based on aircraft_type_id or ICAO model
  const getAircraftImage = (ac: any) => {
    const typeId = ac.aircraft_type_id;
    if (typeId && aircraftImages[String(typeId) as keyof typeof aircraftImages]) {
      return aircraftImages[String(typeId) as keyof typeof aircraftImages].url;
    }
    const typeName = (ac.aircraft_type_name || "").toUpperCase();
    if (typeName.includes("A35K") || typeName.includes("350-1000")) {
      return "https://commons.wikimedia.org/wiki/Special:FilePath/A350-1041_QATAR_A7-ANL_landing_at_Berlin_Tegel.jpg";
    }
    if (typeName.includes("A359") || typeName.includes("350-900") || typeName.includes("A350")) {
      return "https://commons.wikimedia.org/wiki/Special:FilePath/Airbus_A350-900_A7-ALR_of_Qatar_Airways.jpg";
    }
    if (typeName.includes("A388") || typeName.includes("A380") || typeName.includes("380")) {
      return "https://commons.wikimedia.org/wiki/Special:FilePath/QTR_A7-APA_A380!137_EDHI_16-04-14.jpg";
    }
    if (typeName.includes("777") || typeName.includes("B77") || typeName.includes("B77W") || typeName.includes("B77L")) {
      return "https://commons.wikimedia.org/wiki/Special:FilePath/A7-BEG_Qatar_B777_(39512386675).jpg";
    }
    if (typeName.includes("787") || typeName.includes("B78")) {
      return "https://commons.wikimedia.org/wiki/Special:FilePath/Qatar_Airways_Boeing_787-8_Dreamliner_A7-BCO_MUC_2015_02.jpg";
    }
    if (typeName.includes("330") || typeName.includes("A33")) {
      return "https://commons.wikimedia.org/wiki/Special:FilePath/A7-AEI_Airbus_A330-302_Qatar_Airways.jpg";
    }
    return "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80";
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 text-[var(--text-main)]">
      {/* Back Navigation Button */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/groups"
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--brand)] hover:opacity-80 transition-opacity bg-[var(--bg-card)] px-4 py-2 rounded-full border border-[var(--brand-border)] shadow-sm"
        >
          <span>←</span> Back to Groups
        </Link>
      </div>

      {/* Hero Header Card - Styled with Global Brand Theme */}
      <div className="bg-gradient-to-r from-[var(--brand-dark)] via-[var(--brand)] to-[var(--brand-light)] rounded-3xl p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md text-amber-300 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-white/20">
              <span>✈️ Operational Group Fleet</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">{currentGroup.name}</h1>
            <p className="text-sm text-white/80 mt-2 flex items-center gap-3">
              <span>📅 {currentGroup.period_start} — {currentGroup.period_end}</span>
              {currentGroup.discord_channel_id && (
                <span className="bg-black/20 px-3 py-0.5 rounded-md text-xs font-medium border border-white/15">
                  Discord: #{currentGroup.discord_channel_id}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-black/25 backdrop-blur-md p-4 rounded-2xl border border-white/15">
            <div className="text-center px-4 border-r border-white/15">
              <div className="text-3xl font-black text-amber-400">{currentGroup.aircraft_count}</div>
              <div className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Airframes</div>
            </div>
            <div className="text-center px-4 border-r border-white/15">
              <div className="text-3xl font-black text-blue-400">{currentGroup.member_count}</div>
              <div className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Pilots</div>
            </div>
            <div className="text-center px-4">
              <div className="text-3xl font-black text-emerald-400">{currentGroup.available_slots}</div>
              <div className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Open Slots</div>
            </div>
          </div>
        </div>
      </div>

      {/* Operations Status */}
      {opsStats && (opsStats.dispatched > 0 || opsStats.no_show > 0 || opsStats.booked > 0) && (
        <div className="card bg-base-100 border border-brand-border shadow-sm mb-8">
          <div className="card-body p-5">
            <h3 className="card-title text-sm font-black text-brand m-0">Live Operations</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="stat bg-success/10 rounded-xl p-3">
                <div className="stat-title text-[10px]">In Flight</div>
                <div className="stat-value text-lg text-success">{opsStats.dispatched}</div>
              </div>
              <div className="stat bg-error/10 rounded-xl p-3">
                <div className="stat-title text-[10px]">No Shows</div>
                <div className="stat-value text-lg text-error">{opsStats.no_show}</div>
              </div>
              <div className="stat bg-warning/10 rounded-xl p-3">
                <div className="stat-title text-[10px]">Awaiting</div>
                <div className="stat-value text-lg text-warning">{opsStats.booked}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Roster Section */}
      <div className="mb-10">
        <div className="mb-6">
          <h2 className="text-2xl font-black text-[var(--text-main)]">Airframe & Crew Roster</h2>
        </div>

        {currentGroup.aircraft.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-3xl p-10 text-center border border-dashed border-[var(--brand-border)]">
            <p className="text-[var(--text-sub)] font-medium">No airframes assigned to this group yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {currentGroup.aircraft.map((ac: any) => {
              const hasCaptain = Boolean(ac.assigned_captain_id);
              const hasFO = Boolean(ac.assigned_fo_id);
              const acImg = getAircraftImage(ac);

              return (
                <div
                  key={ac.id}
                  className="bg-[var(--bg-card)] rounded-3xl border border-[var(--brand-border)] shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12">
                    {/* LEFT COLUMN: Plane Picture + Plane Details */}
                    <div className="md:col-span-5 bg-[var(--bg-slate)] p-6 border-b md:border-b-0 md:border-r border-[var(--brand-border)] flex flex-col justify-between">
                      <div>
                        {/* Plane Picture Header */}
                        <div className="relative h-48 rounded-2xl overflow-hidden mb-4 border border-[var(--brand-border)] shadow-md group">
                          <img
                            src={acImg}
                            alt={ac.registration}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                          <span
                            className={`absolute top-3 right-3 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border shadow-sm backdrop-blur-md ${
                              ac.status === "flying"
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                                : ac.status === "parked"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                            }`}
                          >
                            {ac.status || "Parked"}
                          </span>
                        </div>

                        {/* Plane Details Box */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-3xl font-black tracking-wide text-amber-500 dark:text-amber-400">
                              {ac.registration}
                            </span>
                            <span className="text-xs font-bold px-3 py-1 rounded-lg bg-[var(--brand-pale)] text-[var(--brand)] border border-[var(--brand-border)]">
                              {ac.aircraft_type_name || "Aircraft"}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-[var(--brand-border)] flex items-center justify-between text-xs text-[var(--text-sub)]">
                            <span>📍 Base Airport</span>
                            <strong className="font-bold text-[var(--text-main)] bg-[var(--bg-card)] px-2.5 py-0.5 rounded border border-[var(--brand-border)]">
                              {ac.current_airport || "OTHH"}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Flight Booking Link */}
                      <div className="mt-6 pt-4 border-t border-[var(--brand-border)] flex items-center justify-between">
                        <span className="text-xs text-[var(--text-sub)]">Tail #{ac.registration}</span>
                        <Link
                          to="/calendar"
                          className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-bold rounded-xl text-xs shadow-md transition-all hover:scale-105 flex items-center gap-1.5"
                        >
                          <span>📅 Schedule Flight</span>
                        </Link>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Assigned Pilots (Larger, Theme-Aware Cards) */}
                    <div className="md:col-span-7 p-6 bg-[var(--bg-card)] flex flex-col justify-between gap-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-[var(--text-sub)]">
                          Assigned Crew
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">Ordered by PIREP Hours</span>
                      </div>

                      {/* TOP BOX: Captain Card (Prominent & Spacious) */}
                      <div className="p-5 rounded-2xl bg-[var(--bg-slate)] border border-amber-500/30 shadow-sm relative overflow-hidden transition-all hover:border-amber-500/60">
                        <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-950 font-black text-[10px] uppercase px-3.5 py-1 rounded-bl-xl tracking-wider shadow-sm">
                          CAPTAIN (PIC)
                        </div>

                        {hasCaptain ? (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                            <div className="flex items-center gap-4">
                              <img
                                src={
                                  ac.assigned_captain_avatar ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    ac.assigned_captain_callsign || "Capt"
                                  )}&background=b91c1c&color=fff`
                                }
                                alt="Captain Avatar"
                                className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-md shrink-0"
                              />
                              <div>
                                <h4 className="font-black text-xl text-[var(--text-main)] leading-tight">
                                  {ac.assigned_captain_callsign || `Pilot #${ac.assigned_captain_id}`}
                                </h4>
                                <p className="text-xs font-medium text-[var(--text-sub)] mt-1">
                                  {ac.assigned_captain_name || "Assigned Pilot"}
                                </p>
                              </div>
                            </div>

                            <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-[var(--brand-border)]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-sub)]">
                                PIREP Flight Hours
                              </span>
                              <div className="inline-flex items-center gap-1.5 font-black text-amber-600 dark:text-amber-400 text-base bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/30 mt-1">
                                <span>⏱️</span>
                                <span>{ac.assigned_captain_hours || 0}h</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] flex items-center justify-center text-2xl text-[var(--text-muted)] border border-[var(--brand-border)]">
                                👨‍✈️
                              </div>
                              <div>
                                <h4 className="font-bold text-[var(--text-sub)] text-base">Unassigned Captain</h4>
                                <p className="text-xs text-[var(--text-muted)]">Vacant Command Slot</p>
                              </div>
                            </div>
                            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-card)] px-3 py-1 rounded-lg border border-[var(--brand-border)]">
                              Vacant
                            </span>
                          </div>
                        )}
                      </div>

                      {/* BOTTOM BOX: First Officer Card (Prominent & Spacious) */}
                      <div className="p-5 rounded-2xl bg-[var(--bg-slate)] border border-blue-500/30 shadow-sm relative overflow-hidden transition-all hover:border-blue-500/60">
                        <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black text-[10px] uppercase px-3.5 py-1 rounded-bl-xl tracking-wider shadow-sm">
                          FIRST OFFICER (FO)
                        </div>

                        {hasFO ? (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                            <div className="flex items-center gap-4">
                              <img
                                src={
                                  ac.assigned_fo_avatar ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    ac.assigned_fo_callsign || "FO"
                                  )}&background=2563eb&color=fff`
                                }
                                alt="FO Avatar"
                                className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-400 shadow-md shrink-0"
                              />
                              <div>
                                <h4 className="font-black text-xl text-[var(--text-main)] leading-tight">
                                  {ac.assigned_fo_callsign || `Pilot #${ac.assigned_fo_id}`}
                                </h4>
                                <p className="text-xs font-medium text-[var(--text-sub)] mt-1">
                                  {ac.assigned_fo_name || "Assigned Pilot"}
                                </p>
                              </div>
                            </div>

                            <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-[var(--brand-border)]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-sub)]">
                                PIREP Flight Hours
                              </span>
                              <div className="inline-flex items-center gap-1.5 font-black text-blue-600 dark:text-blue-400 text-base bg-blue-500/10 px-3 py-1 rounded-xl border border-blue-500/30 mt-1">
                                <span>⏱️</span>
                                <span>{ac.assigned_fo_hours || 0}h</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] flex items-center justify-center text-2xl text-[var(--text-muted)] border border-[var(--brand-border)]">
                                🧑‍✈️
                              </div>
                              <div>
                                <h4 className="font-bold text-[var(--text-sub)] text-base">
                                  {hasCaptain ? "Solo Command Airframe" : "Unassigned First Officer"}
                                </h4>
                                <p className="text-xs text-[var(--text-muted)]">
                                  {hasCaptain ? "Single Captain assigned to this frame" : "Vacant Co-pilot Slot"}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-card)] px-3 py-1 rounded-lg border border-[var(--brand-border)]">
                              {hasCaptain ? "Solo Command" : "Vacant"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Group Members Section */}
      <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--brand-border)] shadow-sm p-6">
        <h3 className="text-xl font-black text-[var(--text-main)] mb-4">
          Group Members ({currentGroup.members.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {currentGroup.members.map((m: any) => (
            <div
              key={m.id}
              className="p-4 rounded-2xl border border-[var(--brand-border)] bg-[var(--bg-slate)] flex items-center justify-between"
            >
              <div>
                <p className="font-bold text-sm text-[var(--text-main)]">
                  {m.pilot_callsign || `Pilot #${m.pilot_id}`}
                </p>
                <p className="text-xs text-[var(--text-sub)]">{m.pilot_name}</p>
              </div>
              {m.is_group_admin && (
                <span className="text-[10px] font-extrabold uppercase bg-[var(--brand-pale)] text-[var(--brand)] px-2.5 py-1 rounded-full border border-[var(--brand-border)]">
                  Admin
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
