import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

interface DiscoverySummary {
  aircraft_type_id: number;
  aircraft_type_name: string;
  total_routes: number;
  discovered_routes: number;
  discovery_pct: number;
}

interface DiscoveryDetail {
  aircraft_type_id: number;
  total_routes: number;
  discovered_routes: number;
  discovery_pct: number;
  discovered: { departure: string; arrival: string; flown_at: string }[];
  missing: { departure: string; arrival: string }[];
}

interface DiscoveryState {
  summary: DiscoverySummary[];
  detail: DiscoveryDetail | null;
  loading: boolean;
}

const initialState: DiscoveryState = {
  summary: [],
  detail: null,
  loading: false,
};

export const fetchDiscoverySummary = createAsyncThunk(
  "discovery/fetchSummary",
  (pilotId: number) => api.get<DiscoverySummary[]>(`/discovery/pilot/${pilotId}/summary`),
);

export const fetchMyDiscoverySummary = createAsyncThunk(
  "discovery/fetchMySummary",
  () => api.get<DiscoverySummary[]>("/discovery/me/summary"),
);

export const fetchDiscoveryDetail = createAsyncThunk(
  "discovery/fetchDetail",
  ({ pilotId, aircraftTypeId }: { pilotId: number; aircraftTypeId: number }) =>
    api.get<DiscoveryDetail>(`/discovery/pilot/${pilotId}/type/${aircraftTypeId}`),
);

export const fetchMyDiscoveryDetail = createAsyncThunk(
  "discovery/fetchMyDetail",
  (aircraftTypeId: number) =>
    api.get<DiscoveryDetail>(`/discovery/me/type/${aircraftTypeId}`),
);

const discoverySlice = createSlice({
  name: "discovery",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDiscoverySummary.fulfilled, (state, action) => {
        state.summary = action.payload;
      })
      .addCase(fetchMyDiscoverySummary.fulfilled, (state, action) => {
        state.summary = action.payload;
      })
      .addCase(fetchDiscoveryDetail.fulfilled, (state, action) => {
        state.detail = action.payload;
      })
      .addCase(fetchMyDiscoveryDetail.fulfilled, (state, action) => {
        state.detail = action.payload;
      });
  },
});

export default discoverySlice.reducer;
