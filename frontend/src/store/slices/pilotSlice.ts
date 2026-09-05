import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

interface Pilot {
  id: number;
  callsign: string;
  name: string;
  grade: number | null;
  group_name: string | null;
  group_id: number | null;
  token_balance?: number;
}

interface PilotState {
  pilots: Pilot[];
  currentPilot: Pilot | null;
  loading: boolean;
}

const initialState: PilotState = {
  pilots: [],
  currentPilot: null,
  loading: false,
};

export const fetchPilots = createAsyncThunk(
  "pilot/fetchAll",
  (params?: { group_id?: number }) => {
    const qs = new URLSearchParams();
    if (params?.group_id) qs.set("group_id", String(params.group_id));
    return api.get<Pilot[]>(`/pilots?${qs.toString()}`);
  },
);

export const fetchPilotDetail = createAsyncThunk(
  "pilot/fetchDetail",
  (id: number) => api.get<Pilot>(`/pilots/${id}`),
);

export const fetchMyProfile = createAsyncThunk("pilot/fetchMe", () =>
  api.get<Pilot>("/pilots/me"),
);

const pilotSlice = createSlice({
  name: "pilot",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPilots.fulfilled, (state, action) => {
        state.pilots = action.payload;
      })
      .addCase(fetchPilotDetail.fulfilled, (state, action) => {
        state.currentPilot = action.payload;
      })
      .addCase(fetchMyProfile.fulfilled, (state, action) => {
        state.currentPilot = action.payload;
      });
  },
});

export default pilotSlice.reducer;
