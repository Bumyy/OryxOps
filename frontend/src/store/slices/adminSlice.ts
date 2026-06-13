import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

interface Setting {
  setting_key: string;
  setting_value: string;
  description: string | null;
}

interface AdminState {
  settings: Setting[];
  loading: boolean;
}

const initialState: AdminState = {
  settings: [],
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

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchSettings.fulfilled, (state, action) => {
      state.settings = action.payload;
    });
  },
});

export default adminSlice.reducer;
