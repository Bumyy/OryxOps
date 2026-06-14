import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

interface ScheduleItem {
  id: number;
  group_id: number;
  aircraft_id: number;
  aircraft_registration: string;
  departure: string;
  arrival: string;
  flight_number: string | null;
  scheduled_departure: string;
  scheduled_arrival: string;
  wave_id: number | null;
  wave_name: string | null;
  ground_time_minutes: number;
  status: string;
  created_by_name: string;
  week_start: string;
  booking_count: number;
}

interface Wave {
  id: number;
  name: string;
  wave_type: string;
  departure_window_start: string;
  departure_window_end: string;
  week_start: string;
}

interface ScheduleState {
  schedules: ScheduleItem[];
  waves: Wave[];
  loading: boolean;
}

const initialState: ScheduleState = {
  schedules: [],
  waves: [],
  loading: false,
};

export const fetchSchedules = createAsyncThunk(
  "schedule/fetchAll",
  (params?: { group_id?: number; week_start?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.group_id) qs.set("group_id", String(params.group_id));
    if (params?.week_start) qs.set("week_start", params.week_start);
    if (params?.status) qs.set("status", params.status);
    return api.get<ScheduleItem[]>(`/schedules?${qs.toString()}`);
  },
);

export const createSchedule = createAsyncThunk(
  "schedule/create",
  (data: any) => api.post<ScheduleItem>("/schedules", data),
);

export const updateSchedule = createAsyncThunk(
  "schedule/update",
  ({ id, data }: { id: number; data: any }) =>
    api.patch<ScheduleItem>(`/schedules/${id}`, data),
);

export const deleteSchedule = createAsyncThunk(
  "schedule/delete",
  (id: number) => api.delete(`/schedules/${id}`),
);

export const proposeSchedule = createAsyncThunk(
  "schedule/propose",
  (id: number) => api.post<ScheduleItem>(`/schedules/${id}/propose`),
);

export const approveSchedule = createAsyncThunk(
  "schedule/approve",
  (id: number) => api.post<ScheduleItem>(`/schedules/${id}/approve`),
);

export const rejectSchedule = createAsyncThunk(
  "schedule/reject",
  (id: number) => api.post<ScheduleItem>(`/schedules/${id}/reject`),
);

export const bulkApproveSchedules = createAsyncThunk(
  "schedule/bulkApprove",
  (data: { group_id: number; week_start: string }) =>
    api.post("/schedules/bulk-approve", data),
);

export const fetchWaves = createAsyncThunk(
  "schedule/fetchWaves",
  (params?: { group_id?: number; week_start?: string }) => {
    const qs = new URLSearchParams();
    if (params?.group_id) qs.set("group_id", String(params.group_id));
    if (params?.week_start) qs.set("week_start", params.week_start);
    return api.get<Wave[]>(`/schedules/waves?${qs.toString()}`);
  },
);

export const createWave = createAsyncThunk(
  "schedule/createWave",
  (data: any) => api.post<Wave>("/schedules/waves", data),
);

export const deleteWave = createAsyncThunk(
  "schedule/deleteWave",
  (id: number) => api.delete(`/schedules/waves/${id}`),
);

const scheduleSlice = createSlice({
  name: "schedule",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSchedules.fulfilled, (state, action) => {
        state.schedules = action.payload;
      })
      .addCase(fetchWaves.fulfilled, (state, action) => {
        state.waves = action.payload;
      });
  },
});

export default scheduleSlice.reducer;
