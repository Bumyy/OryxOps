import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

interface AircraftType {
  id: number;
  name: string;
  icao: string;
  liveryname: string | null;
}

interface LiveAircraft {
  id: number;
  aircraft_type_id: number;
  aircraft_type_name: string;
  registration: string;
  if_aircraft_id: string | null;
  if_organization_aircraft_id: string | null;
  current_airport: string;
  status: string;
  current_pilot_name: string | null;
  total_flight_hours: number;
  total_flights: number;
  home_base: string;
  group_id?: number;
  group_name?: string;
  last_flight_at?: string;
}

interface AircraftState {
  types: AircraftType[];
  airframes: LiveAircraft[];
  currentAirframe: (LiveAircraft & { history?: any[] }) | null;
  specs: any | null;
  loading: boolean;
}

const initialState: AircraftState = {
  types: [],
  airframes: [],
  currentAirframe: null,
  specs: null,
  loading: false,
};

export const fetchAircraftTypes = createAsyncThunk("aircraft/fetchTypes", () =>
  api.get<AircraftType[]>("/aircraft/types"),
);

export const fetchAircraftSpecs = createAsyncThunk("aircraft/fetchSpecs", () =>
  api.get<any>("/aircraft/specs"),
);

export const fetchAirframes = createAsyncThunk(
  "aircraft/fetchAll",
  (params?: { status?: string; group_id?: number; airport?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.group_id) qs.set("group_id", String(params.group_id));
    if (params?.airport) qs.set("airport", params.airport);
    const query = qs.toString();
    return api.get<LiveAircraft[]>(`/aircraft${query ? `?${query}` : ""}`);
  },
);

export const fetchAirframeDetail = createAsyncThunk(
  "aircraft/fetchDetail",
  (id: number) => api.get<LiveAircraft>(`/aircraft/${id}`),
);

export const fetchAirframeHistory = createAsyncThunk(
  "aircraft/fetchHistory",
  (id: number) => api.get<any[]>(`/aircraft/${id}/history`),
);

export const createAirframe = createAsyncThunk(
  "aircraft/create",
  (data: any) => api.post<LiveAircraft>("/aircraft", data),
);

export const updateAirframe = createAsyncThunk(
  "aircraft/update",
  ({ id, data }: { id: number; data: any }) =>
    api.patch<LiveAircraft>(`/aircraft/${id}`, data),
);

const aircraftSlice = createSlice({
  name: "aircraft",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAircraftTypes.fulfilled, (state, action) => {
        state.types = action.payload;
      })
      .addCase(fetchAircraftSpecs.fulfilled, (state, action) => {
        state.specs = action.payload;
      })
      .addCase(fetchAirframes.fulfilled, (state, action) => {
        state.airframes = action.payload;
      })
      .addCase(fetchAirframeDetail.fulfilled, (state, action) => {
        state.currentAirframe = action.payload;
      })
      .addCase(fetchAirframeHistory.fulfilled, (state, action) => {
        if (state.currentAirframe) {
          state.currentAirframe.history = action.payload;
        }
      });
  },
});

export default aircraftSlice.reducer;
