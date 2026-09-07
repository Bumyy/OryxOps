import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

interface ScheduleItem {
  id: number;
  group_id?: number | null;
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
  created_by?: number;
  created_by_name: string;
  approved_by?: number | null;
  week_start: string;
  booking_count: number;
}

interface Wave {
  id: number;
  name: string;
  wave_type: string;
  departure_window_start: string;
  departure_window_end: string;
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
  async (data: any, { rejectWithValue }) => {
    try {
      return await api.post<ScheduleItem>("/schedules", data);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create schedule");
    }
  },
);

export const updateSchedule = createAsyncThunk(
  "schedule/update",
  async ({ id, data }: { id: number; data: any }, { rejectWithValue }) => {
    try {
      return await api.patch<ScheduleItem>(`/schedules/${id}`, data);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update schedule");
    }
  },
);

export const deleteSchedule = createAsyncThunk(
  "schedule/delete",
  async (id: number, { rejectWithValue }) => {
    try {
      return await api.delete(`/schedules/${id}`);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to delete schedule");
    }
  },
);

export const proposeSchedule = createAsyncThunk(
  "schedule/propose",
  async (id: number, { rejectWithValue }) => {
    try {
      return await api.post<ScheduleItem>(`/schedules/${id}/propose`);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to propose schedule");
    }
  },
);

export const approveSchedule = createAsyncThunk(
  "schedule/approve",
  async (id: number, { rejectWithValue }) => {
    try {
      return await api.post<ScheduleItem>(`/schedules/${id}/approve`);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to approve schedule");
    }
  },
);

export const rejectSchedule = createAsyncThunk(
  "schedule/reject",
  async (id: number, { rejectWithValue }) => {
    try {
      return await api.post<ScheduleItem>(`/schedules/${id}/reject`);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to reject schedule");
    }
  },
);

export const bulkApproveSchedules = createAsyncThunk(
  "schedule/bulkApprove",
  async (data: { group_id?: number | null; week_start: string }, { rejectWithValue }) => {
    try {
      return await api.post("/schedules/bulk-approve", data);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to bulk approve schedules");
    }
  },
);

export const fetchWaves = createAsyncThunk(
  "schedule/fetchWaves",
  async (params?: { group_id?: number }) => {
    const qs = new URLSearchParams();
    if (params?.group_id) qs.set("group_id", String(params.group_id));
    return api.get<Wave[]>(`/schedules/waves?${qs.toString()}`);
  },
);

export const createWave = createAsyncThunk(
  "schedule/createWave",
  async (data: any, { rejectWithValue }) => {
    try {
      return await api.post<Wave>("/schedules/waves", data);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create wave");
    }
  },
);

export const deleteWave = createAsyncThunk(
  "schedule/deleteWave",
  async (id: number, { rejectWithValue }) => {
    try {
      return await api.delete(`/schedules/waves/${id}`);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to delete wave");
    }
  },
);

const scheduleSlice = createSlice({
  name: "schedule",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSchedules.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSchedules.fulfilled, (state, action) => {
        state.schedules = action.payload;
        state.loading = false;
      })
      .addCase(fetchSchedules.rejected, (state) => {
        state.loading = false;
      })
      .addCase(fetchWaves.fulfilled, (state, action) => {
        state.waves = action.payload;
      });
  },
});

export default scheduleSlice.reducer;
