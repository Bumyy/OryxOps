import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

interface Setting {
  setting_key: string;
  setting_value: string;
  description: string | null;
}

interface EnrolledPilot {
  id: number;
  callsign: string;
  name: string;
  enrolled: boolean;
}

interface AdminState {
  settings: Setting[];
  enrolled: EnrolledPilot[];
  unenrolled: EnrolledPilot[];
  loading: boolean;
}

const initialState: AdminState = {
  settings: [],
  enrolled: [],
  unenrolled: [],
  loading: false,
};

export const fetchSettings = createAsyncThunk("admin/fetchSettings", () =>
  api.get<Setting[]>("/settings"),
);

export const updateSetting = createAsyncThunk(
  "admin/updateSetting",
  ({ key, value }: { key: string; value: string }) =>
    api.patch<Setting>(`/settings/${key}`, { setting_value: value }),
);

export const promotePilot = createAsyncThunk(
  "admin/promotePilot",
  ({ pilotId, careerPathId }: { pilotId: number; careerPathId: number }) =>
    api.post<any>(`/admin/promote/${pilotId}?career_path_id=${careerPathId}`),
);

export const enrollPilot = createAsyncThunk(
  "admin/enrollPilot",
  (data: { pilot_id: number; career_path_id: number }) =>
    api.post<any>("/admin/enroll-pilot", data),
);

export const fetchEnrolledPilots = createAsyncThunk(
  "admin/fetchEnrolled",
  () => api.get<{ enrolled: EnrolledPilot[]; unenrolled: EnrolledPilot[] }>("/admin/enrolled-pilots"),
);

export const reshuffleGroup = createAsyncThunk(
  "admin/reshuffle",
  (groupId: number) => api.post<any>(`/admin/reshuffle/${groupId}`),
);

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.settings = action.payload;
      })
      .addCase(fetchEnrolledPilots.fulfilled, (state, action) => {
        state.enrolled = action.payload.enrolled;
        state.unenrolled = action.payload.unenrolled;
      });
  },
});

export default adminSlice.reducer;
