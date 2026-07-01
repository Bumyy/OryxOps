import { useEffect, useState, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchGroups,
  fetchGroupDetail,
  createGroup,
  updateGroup,
  assignPilots,
  removePilot,
  assignAircraft,
  removeAircraft,
  toggleAdmin,
} from "../../store/slices/groupSlice";
import { reshuffleGroup } from "../../store/slices/adminSlice";
import { fetchPilots } from "../../store/slices/pilotSlice";
import { fetchAirframes } from "../../store/slices/aircraftSlice";

export function GroupsTab() {
  const dispatch = useAppDispatch();
  const { groups, currentGroup } = useAppSelector((s) => s.group);
  const { pilots } = useAppSelector((s) => s.pilot);
  const { airframes } = useAppSelector((s) => s.aircraft);

  // Master view state
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Create Group Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDiscordId, setNewGroupDiscordId] = useState("");
  const [newGroupPeriodStart, setNewGroupPeriodStart] = useState("");
  const [newGroupPeriodEnd, setNewGroupPeriodEnd] = useState("");

  // Edit Group Form state (for selected group)
  const [editName, setEditName] = useState("");
  const [editDiscordId, setEditDiscordId] = useState("");
  const [editPeriodStart, setEditPeriodStart] = useState("");
  const [editPeriodEnd, setEditPeriodEnd] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Search/Assignment states
  const [pilotSearch, setPilotSearch] = useState("");
  const [showPilotDropdown, setShowPilotDropdown] = useState(false);
  const [pilotIsGroupAdmin, setPilotIsGroupAdmin] = useState(false);

  const [aircraftSearch, setAircraftSearch] = useState("");
  const [showAircraftDropdown, setShowAircraftDropdown] = useState(false);

  const pilotDropdownRef = useRef<HTMLDivElement>(null);
  const aircraftDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch initial lists
  useEffect(() => {
    dispatch(fetchGroups());
    dispatch(fetchPilots({}));
    dispatch(fetchAirframes());
  }, [dispatch]);

  // Handle outside clicks to close dropdowns
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (pilotDropdownRef.current && !pilotDropdownRef.current.contains(event.target as Node)) {
        setShowPilotDropdown(false);
      }
      if (aircraftDropdownRef.current && !aircraftDropdownRef.current.contains(event.target as Node)) {
        setShowAircraftDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Sync edit form fields when selected group changes
  useEffect(() => {
    if (currentGroup) {
      setEditName(currentGroup.name);
      setEditDiscordId(currentGroup.discord_channel_id || "");
      setEditPeriodStart(currentGroup.period_start);
      setEditPeriodEnd(currentGroup.period_end);
      setEditIsActive(currentGroup.is_active);
    }
  }, [currentGroup]);

  const selectGroup = (id: number) => {
    setSelectedGroupId(id);
    dispatch(fetchGroupDetail(id));
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName || !newGroupPeriodStart || !newGroupPeriodEnd) return;
    
    await dispatch(createGroup({
      name: newGroupName,
      discord_channel_id: newGroupDiscordId || null,
      period_start: newGroupPeriodStart,
      period_end: newGroupPeriodEnd,
    }));

    setNewGroupName("");
    setNewGroupDiscordId("");
    setNewGroupPeriodStart("");
    setNewGroupPeriodEnd("");
    setShowCreateModal(false);
    
    // Refresh group list
    dispatch(fetchGroups());
  };

  const handleUpdateGroupInfo = async () => {
    if (!selectedGroupId || !editName || !editPeriodStart || !editPeriodEnd) return;
    
    await dispatch(updateGroup({
      id: selectedGroupId,
      data: {
        name: editName,
        discord_channel_id: editDiscordId || null,
        period_start: editPeriodStart,
        period_end: editPeriodEnd,
        is_active: editIsActive,
      }
    }));

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);

    // Refresh data
    dispatch(fetchGroups());
    dispatch(fetchGroupDetail(selectedGroupId));
  };

  const handleReshuffle = async () => {
    if (!selectedGroupId) return;
    if (!window.confirm("Are you sure you want to reshuffle this group? This creates a new active period with the same members and aircraft.")) return;
    
    await dispatch(reshuffleGroup(selectedGroupId));
    dispatch(fetchGroups());
    dispatch(fetchGroupDetail(selectedGroupId));
  };

  const handleAddPilot = async (pilotId: number) => {
    if (!selectedGroupId) return;
    await dispatch(assignPilots({ groupId: selectedGroupId, pilotIds: [pilotId], isGroupAdmin: pilotIsGroupAdmin }));
    setPilotSearch("");
    setShowPilotDropdown(false);
    setPilotIsGroupAdmin(false);
    dispatch(fetchGroupDetail(selectedGroupId));
    dispatch(fetchGroups()); // Refresh counts
  };

  const handleRemovePilot = async (pilotId: number) => {
    if (!selectedGroupId) return;
    if (!window.confirm("Remove this pilot from the group?")) return;
    await dispatch(removePilot({ groupId: selectedGroupId, pilotId }));
    dispatch(fetchGroupDetail(selectedGroupId));
    dispatch(fetchGroups()); // Refresh counts
  };

  const handleTogglePilotAdmin = async (pilotId: number, currentAdminStatus: boolean) => {
    if (!selectedGroupId) return;
    await dispatch(toggleAdmin({ groupId: selectedGroupId, pilotId, isGroupAdmin: !currentAdminStatus }));
    dispatch(fetchGroupDetail(selectedGroupId));
  };

  const handleAddAircraft = async (aircraftId: number) => {
    if (!selectedGroupId) return;
    await dispatch(assignAircraft({ groupId: selectedGroupId, aircraftIds: [aircraftId] }));
    setAircraftSearch("");
    setShowAircraftDropdown(false);
    dispatch(fetchGroupDetail(selectedGroupId));
    dispatch(fetchGroups()); // Refresh counts
  };

  const handleRemoveAircraft = async (aircraftId: number) => {
    if (!selectedGroupId) return;
    if (!window.confirm("Remove this aircraft from the group?")) return;
    await dispatch(removeAircraft({ groupId: selectedGroupId, aircraftId }));
    dispatch(fetchGroupDetail(selectedGroupId));
    dispatch(fetchGroups()); // Refresh counts
  };

  // Filter groups for master list
  const filteredGroups = groups.filter((g) => {
    const matchesSearch = g.name.toLowerCase().includes(groupSearch.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && g.is_active) ||
      (statusFilter === "inactive" && !g.is_active);
    return matchesSearch && matchesStatus;
  });

  // Calculate available pilots/aircraft for selected group dropdowns
  const assignedPilotIds = currentGroup?.members.map((m: any) => m.pilot_id) || [];
  const assignedAircraftIds = currentGroup?.aircraft.map((a: any) => a.aircraft_id) || [];

  const availablePilots = pilots.filter(p => !assignedPilotIds.includes(p.id));
  const availableAircraft = airframes.filter(a => !assignedAircraftIds.includes(a.id));

  // Filter available items based on dropdown search inputs
  const filteredAvailablePilots = availablePilots.filter(p =>
    p.callsign?.toLowerCase().includes(pilotSearch.toLowerCase()) ||
    p.name?.toLowerCase().includes(pilotSearch.toLowerCase())
  );

  const filteredAvailableAircraft = availableAircraft.filter(a =>
    a.registration?.toLowerCase().includes(aircraftSearch.toLowerCase()) ||
    a.aircraft_type_name?.toLowerCase().includes(aircraftSearch.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full items-start">
      {/* ─── LEFT: GROUPS LIST (MASTER) ─── */}
      <div className="lg:col-span-1 bg-white rounded-2xl border border-brand-border shadow-sm flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-brand-border flex items-center justify-between bg-brand-pale">
          <h2 className="font-bold text-brand text-lg">Flying Groups</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-xs rounded-full bg-brand hover:bg-brand-light text-white font-semibold border-none px-3"
          >
            + New Group
          </button>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-brand-border space-y-2 bg-white flex-shrink-0">
          <input
            type="text"
            placeholder="Search groups..."
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            className="input input-sm input-bordered w-full rounded-xl focus:border-brand"
          />
          <div className="join w-full grid grid-cols-3">
            <button
              onClick={() => setStatusFilter("all")}
              className={`btn btn-xs join-item ${statusFilter === "all" ? "bg-brand text-white hover:bg-brand-light" : "bg-white text-gray-500"}`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`btn btn-xs join-item ${statusFilter === "active" ? "bg-brand text-white hover:bg-brand-light" : "bg-white text-gray-500"}`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`btn btn-xs join-item ${statusFilter === "inactive" ? "bg-brand text-white hover:bg-brand-light" : "bg-white text-gray-500"}`}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Scrollable Group List */}
        <div className="flex-1 overflow-y-auto divide-y divide-brand-border/60">
          {filteredGroups.map((g) => (
            <div
              key={g.id}
              onClick={() => selectGroup(g.id)}
              className={`p-4 cursor-pointer transition-colors duration-150 ${
                selectedGroupId === g.id
                  ? "bg-brand-hover-bg border-l-4 border-brand"
                  : "hover:bg-brand-pale/50 border-l-4 border-transparent"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <h3 className={`font-bold text-sm ${selectedGroupId === g.id ? "text-brand" : "text-gray-800"}`}>
                  {g.name}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${g.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {g.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-gray-400">
                <span>{g.member_count} pilots · {g.aircraft_count} aircraft</span>
                <span>{g.period_start} &rarr; {g.period_end}</span>
              </div>
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">No groups found.</div>
          )}
        </div>
      </div>

      {/* ─── RIGHT: SELECTED GROUP DETAIL (DETAIL) ─── */}
      <div className="lg:col-span-2 space-y-6">
        {currentGroup && selectedGroupId === currentGroup.id ? (
          <>
            {/* Group Core Settings & Actions */}
            <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border/60 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-brand">{currentGroup.name}</h2>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${currentGroup.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {currentGroup.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">ID: #{currentGroup.id} · Created Period: {currentGroup.period_start} &mdash; {currentGroup.period_end}</p>
                </div>
                <div className="flex gap-2">
                  {currentGroup.is_active && (
                    <button
                      onClick={handleReshuffle}
                      className="btn btn-sm btn-outline border-orange-400 text-orange-600 hover:bg-orange-500 hover:border-orange-500 hover:text-white rounded-full text-xs"
                      title="Create a new schedule period for this group keeping the same members/aircraft"
                    >
                      🔄 Reshuffle Group
                    </button>
                  )}
                </div>
              </div>

              {/* Edit Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Group Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input input-sm input-bordered w-full rounded-xl focus:border-brand"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Discord Channel ID</label>
                  <input
                    type="text"
                    value={editDiscordId}
                    placeholder="None"
                    onChange={(e) => setEditDiscordId(e.target.value)}
                    className="input input-sm input-bordered w-full rounded-xl focus:border-brand"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Period Start</label>
                  <input
                    type="date"
                    value={editPeriodStart}
                    onChange={(e) => setEditPeriodStart(e.target.value)}
                    className="input input-sm input-bordered w-full rounded-xl focus:border-brand"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Period End</label>
                  <input
                    type="date"
                    value={editPeriodEnd}
                    onChange={(e) => setEditPeriodEnd(e.target.value)}
                    className="input input-sm input-bordered w-full rounded-xl focus:border-brand"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-brand-border/40">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-600">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="checkbox checkbox-sm checkbox-primary rounded-md"
                  />
                  Active status (allows booking and schedule generation)
                </label>
                <div className="flex items-center gap-2">
                  {saveSuccess && (
                    <span className="text-xs font-semibold text-green-600 animate-pulse">Saved successfully!</span>
                  )}
                  <button
                    onClick={handleUpdateGroupInfo}
                    className="btn btn-sm rounded-full bg-brand hover:bg-brand-light text-white font-semibold border-none px-5"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Assignments (Members and Aircraft Side-by-Side) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* MEMBERS MANAGEMENT */}
              <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5 flex flex-col min-h-[30rem]">
                <h3 className="font-bold text-brand border-b border-brand-border/60 pb-3 mb-4 text-base flex justify-between items-center">
                  <span>Group Members ({currentGroup.members.length})</span>
                </h3>

                {/* Add member searchable dropdown */}
                <div ref={pilotDropdownRef} className="relative mb-4 bg-brand-pale p-3 rounded-2xl border border-brand-border/50">
                  <h4 className="text-xs font-bold text-brand-light mb-2">Assign Pilot</h4>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Search pilot callsign or name..."
                      value={pilotSearch}
                      onChange={(e) => {
                        setPilotSearch(e.target.value);
                        setShowPilotDropdown(true);
                      }}
                      onFocus={() => setShowPilotDropdown(true)}
                      className="input input-xs input-bordered w-full rounded-lg"
                    />
                    
                    {showPilotDropdown && (
                      <div className="absolute z-20 left-3 right-3 top-[4.5rem] max-h-48 overflow-y-auto bg-white border border-brand-border rounded-xl shadow-lg">
                        {filteredAvailablePilots.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleAddPilot(p.id)}
                            className="px-3 py-2 hover:bg-brand-hover-bg cursor-pointer text-xs flex justify-between items-center"
                          >
                            <span className="font-semibold text-gray-800">{p.callsign}</span>
                            <span className="text-gray-400 text-[10px]">{p.name}</span>
                          </div>
                        ))}
                        {filteredAvailablePilots.length === 0 && (
                          <div className="p-3 text-center text-xs text-gray-400">No available pilots found.</div>
                        )}
                      </div>
                    )}

                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500 font-semibold mt-1">
                      <input
                        type="checkbox"
                        checked={pilotIsGroupAdmin}
                        onChange={(e) => setPilotIsGroupAdmin(e.target.checked)}
                        className="checkbox checkbox-xs rounded-md checkbox-primary"
                      />
                      Assign as Group Administrator
                    </label>
                  </div>
                </div>

                {/* Members List */}
                <div className="flex-1 overflow-y-auto space-y-2 max-h-96 pr-1">
                  {currentGroup.members.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl border border-brand-border/60 hover:bg-brand-pale/20 transition-colors">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-semibold text-xs text-gray-800 truncate">
                          {m.pilot_callsign || `Pilot #${m.pilot_id}`}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">{m.pilot_name}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {m.is_group_admin && (
                          <span className="text-[9px] font-bold bg-brand text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Admin
                          </span>
                        )}
                        <button
                          onClick={() => handleTogglePilotAdmin(m.pilot_id, m.is_group_admin)}
                          className="btn btn-ghost btn-xs text-gray-400 hover:text-brand px-1"
                          title={m.is_group_admin ? "Demote to member" : "Promote to Group Admin"}
                        >
                          {m.is_group_admin ? "↓" : "↑"}
                        </button>
                        <button
                          onClick={() => handleRemovePilot(m.pilot_id)}
                          className="btn btn-ghost btn-xs text-red-400 hover:text-red-600 px-1"
                          title="Remove from group"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}

                  {currentGroup.members.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-8">No pilots assigned yet.</p>
                  )}
                </div>
              </div>

              {/* AIRCRAFT MANAGEMENT */}
              <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-5 flex flex-col min-h-[30rem]">
                <h3 className="font-bold text-brand border-b border-brand-border/60 pb-3 mb-4 text-base flex justify-between items-center">
                  <span>Group Aircraft ({currentGroup.aircraft.length})</span>
                </h3>

                {/* Add aircraft searchable dropdown */}
                <div ref={aircraftDropdownRef} className="relative mb-4 bg-brand-pale p-3 rounded-2xl border border-brand-border/50">
                  <h4 className="text-xs font-bold text-brand-light mb-2">Assign Aircraft</h4>
                  <input
                    type="text"
                    placeholder="Search aircraft registration or type..."
                    value={aircraftSearch}
                    onChange={(e) => {
                      setAircraftSearch(e.target.value);
                      setShowAircraftDropdown(true);
                    }}
                    onFocus={() => setShowAircraftDropdown(true)}
                    className="input input-xs input-bordered w-full rounded-lg"
                  />
                  
                  {showAircraftDropdown && (
                    <div className="absolute z-20 left-3 right-3 top-[4.5rem] max-h-48 overflow-y-auto bg-white border border-brand-border rounded-xl shadow-lg">
                      {filteredAvailableAircraft.map((a) => (
                        <div
                          key={a.id}
                          onClick={() => handleAddAircraft(a.id)}
                          className="px-3 py-2 hover:bg-brand-hover-bg cursor-pointer text-xs flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold text-gray-800">{a.registration}</span>
                            <span className="text-gray-400 ml-2 text-[10px]">({a.current_airport})</span>
                          </div>
                          <span className="text-[10px] text-gray-400">{a.aircraft_type_name}</span>
                        </div>
                      ))}
                      {filteredAvailableAircraft.length === 0 && (
                        <div className="p-3 text-center text-xs text-gray-400">No available aircraft found.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Aircraft List */}
                <div className="flex-1 overflow-y-auto space-y-2 max-h-96 pr-1">
                  {currentGroup.aircraft.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-2.5 rounded-xl border border-brand-border/60 hover:bg-brand-pale/20 transition-colors">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs text-gray-800">{a.registration}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                            a.status === "parked" ? "bg-green-100 text-green-700" :
                            a.status === "flying" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-500"
                          }`}>{a.status}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">
                          {a.aircraft_type_name} &middot; Current: {a.current_airport}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveAircraft(a.aircraft_id)}
                        className="btn btn-ghost btn-xs text-red-400 hover:text-red-600 px-1"
                        title="Remove aircraft"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {currentGroup.aircraft.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-8">No aircraft assigned yet.</p>
                  )}
                </div>
              </div>

            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-12 flex flex-col items-center justify-center text-center h-[calc(100vh-12rem)]">
            <svg className="w-16 h-16 text-brand/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <h3 className="text-lg font-bold text-gray-700">No Group Selected</h3>
            <p className="text-sm text-gray-400 max-w-sm mt-1">Select a group from the sidebar to manage members, aircraft, periods, and settings.</p>
          </div>
        )}
      </div>

      {/* ─── CREATE GROUP MODAL ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-brand mb-4">Create New Group</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wave 3 Operations"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="input input-sm input-bordered w-full rounded-xl focus:border-brand"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Discord Channel ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 1122334455667788"
                  value={newGroupDiscordId}
                  onChange={(e) => setNewGroupDiscordId(e.target.value)}
                  className="input input-sm input-bordered w-full rounded-xl focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Period Start</label>
                  <input
                    type="date"
                    required
                    value={newGroupPeriodStart}
                    onChange={(e) => setNewGroupPeriodStart(e.target.value)}
                    className="input input-sm input-bordered w-full rounded-xl focus:border-brand"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Period End</label>
                  <input
                    type="date"
                    required
                    value={newGroupPeriodEnd}
                    onChange={(e) => setNewGroupPeriodEnd(e.target.value)}
                    className="input input-sm input-bordered w-full rounded-xl focus:border-brand"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-brand-border/40 mt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-sm btn-ghost rounded-full text-gray-500 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm rounded-full bg-brand hover:bg-brand-light text-white font-semibold border-none px-5"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminGroups() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-5xl font-bold text-brand mb-8">Group Management</h1>
      <GroupsTab />
    </div>
  );
}
