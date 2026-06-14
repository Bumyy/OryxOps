import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

interface Group {
  id: number;
  name: string;
  discord_channel_id: string | null;
  is_active: boolean;
  period_start: string;
  period_end: string;
  member_count: number;
  aircraft_count: number;
}

interface GroupDetail extends Group {
  members: any[];
  aircraft: any[];
}

interface GroupState {
  groups: Group[];
  currentGroup: GroupDetail | null;
  loading: boolean;
  error: string | null;
}

const initialState: GroupState = {
  groups: [],
  currentGroup: null,
  loading: false,
  error: null,
};

export const fetchGroups = createAsyncThunk("group/fetchAll", () =>
  api.get<Group[]>("/groups"),
);

export const fetchGroupDetail = createAsyncThunk(
  "group/fetchDetail",
  (groupId: number) => api.get<GroupDetail>(`/groups/${groupId}`),
);

export const createGroup = createAsyncThunk(
  "group/create",
  (data: any) => api.post<Group>("/groups", data),
);

export const updateGroup = createAsyncThunk(
  "group/update",
  ({ id, data }: { id: number; data: any }) => api.patch<Group>(`/groups/${id}`, data),
);

export const assignPilots = createAsyncThunk(
  "group/assignPilots",
  ({ groupId, pilotIds, isGroupAdmin }: { groupId: number; pilotIds: number[]; isGroupAdmin: boolean }) =>
    api.post<any>(`/groups/${groupId}/members`, { pilot_ids: pilotIds, is_group_admin: isGroupAdmin }),
);

export const assignAircraft = createAsyncThunk(
  "group/assignAircraft",
  ({ groupId, aircraftIds }: { groupId: number; aircraftIds: number[] }) =>
    api.post<any>(`/groups/${groupId}/aircraft`, { aircraft_ids: aircraftIds }),
);

export const removePilot = createAsyncThunk(
  "group/removePilot",
  ({ groupId, pilotId }: { groupId: number; pilotId: number }) =>
    api.delete(`/groups/${groupId}/members/${pilotId}`),
);

export const removeAircraft = createAsyncThunk(
  "group/removeAircraft",
  ({ groupId, aircraftId }: { groupId: number; aircraftId: number }) =>
    api.delete(`/groups/${groupId}/aircraft/${aircraftId}`),
);

export const toggleAdmin = createAsyncThunk(
  "group/toggleAdmin",
  ({ groupId, pilotId, isGroupAdmin }: { groupId: number; pilotId: number; isGroupAdmin: boolean }) =>
    api.patch<any>(`/groups/${groupId}/members/${pilotId}/admin`, { is_group_admin: isGroupAdmin }),
);

const groupSlice = createSlice({
  name: "group",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchGroups.fulfilled, (state, action) => {
        state.groups = action.payload;
      })
      .addCase(fetchGroupDetail.fulfilled, (state, action) => {
        state.currentGroup = action.payload;
      })
      .addCase(createGroup.fulfilled, (state, action) => {
        state.groups.push(action.payload);
      });
  },
});

export default groupSlice.reducer;
