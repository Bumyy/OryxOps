import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

export interface Booking {
  id: number;
  schedule_id: number;
  departure_pilot_id: number | null;
  departure_pilot_callsign: string | null;
  arrival_pilot_id: number | null;
  arrival_pilot_callsign: string | null;
  departure_pirep_id: number | null;
  arrival_pirep_id: number | null;
  booked_at: string;
  dispatched_at: string | null;
  pax_count: number | null;
  landing_fpm: number | null;
  reputation_score: number | null;
  earnings: number | null;
  expenses: number | null;
  status: string;
  pirep_accepted: number | null;

  flight_departure: string;
  flight_arrival: string;
  flight_scheduled_dep: string;
  aircraft_registration: string;
  aircraft_icao?: string;
  flight_number?: string;
  flight_time_minutes?: number | null;
  fuel_burned?: number | null;
  diverted?: boolean;
  actual_arrival?: string;
  scheduled_duration_minutes?: number | null;

  actual_departure?: string | null;
  actual_arrival_if?: string | null;
  auto_flight_time_minutes?: number | null;
}

interface BookingState {
  bookings: Booking[];
  loading: boolean;
}

const initialState: BookingState = {
  bookings: [],
  loading: false,
};

export const fetchBookings = createAsyncThunk(
  "booking/fetchAll",
  async (params?: { pilot_id?: number; schedule_id?: number; status?: string; group_id?: number }) => {
    const qs = new URLSearchParams();
    if (params?.pilot_id) qs.set("pilot_id", String(params.pilot_id));
    if (params?.schedule_id) qs.set("schedule_id", String(params.schedule_id));
    if (params?.status) qs.set("status", params.status);
    if (params?.group_id) qs.set("group_id", String(params.group_id));
    
    const data = await api.get<Booking[]>(`/bookings?${qs.toString()}`);
    
    if (params?.pilot_id) {
      return data.filter(
        (b) => b.departure_pilot_id === params.pilot_id || b.arrival_pilot_id === params.pilot_id
      );
    }
    return data;
  },
);

export const createBooking = createAsyncThunk(
  "booking/create",
  async ({ scheduleId, bookingType = "both" }: { scheduleId: number; bookingType?: string }, { rejectWithValue }) => {
    try {
      return await api.post<Booking | Booking[]>("/bookings", { schedule_id: scheduleId, booking_type: bookingType });
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create booking");
    }
  },
);

export const cancelBooking = createAsyncThunk(
  "booking/cancel",
  async (id: number, { rejectWithValue }) => {
    try {
      return await api.delete(`/bookings/${id}`);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to cancel booking");
    }
  },
);

export const dispatchBooking = createAsyncThunk(
  "booking/dispatch",
  async (id: number, { rejectWithValue }) => {
    try {
      return await api.post<Booking>(`/bookings/${id}/dispatch`);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to dispatch booking");
    }
  },
);

export const completeBooking = createAsyncThunk(
  "booking/complete",
  async ({ id, flightTimeMinutes, fuelBurned, landingFpm, actualArrival }: { id: number; flightTimeMinutes: number; fuelBurned: number; landingFpm: number; actualArrival?: string }, { rejectWithValue }) => {
    try {
      return await api.post<Booking>(`/bookings/${id}/complete`, {
        flight_time_minutes: flightTimeMinutes,
        fuel_burned: fuelBurned,
        landing_fpm: landingFpm,
        actual_arrival: actualArrival
      });
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to complete booking");
    }
  },
);

export const noShowBooking = createAsyncThunk(
  "booking/noShow",
  async (id: number, { rejectWithValue }) => {
    try {
      return await api.post<Booking>(`/bookings/${id}/no-show`);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to mark no-show");
    }
  },
);

export const takeOverBooking = createAsyncThunk(
  "booking/takeOver",
  async (id: number, { rejectWithValue }) => {
    try {
      return await api.post<Booking>(`/bookings/${id}/take-over`);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to take over booking");
    }
  },
);

export interface FlightProgress {
  booking_id: number;
  status: string;
  in_progress: boolean;
  active_on_server: boolean;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  vertical_speed: number | null;
  progress_pct: number | null;
  eta_minutes: number | null;
  distance_remaining_nm: number | null;
  total_distance_nm: number | null;
  on_ground: boolean | null;
  last_report: string | null;
  callsign: string | null;
}

export const fetchProgress = createAsyncThunk(
  "booking/fetchProgress",
  (id: number) => api.get<FlightProgress>(`/bookings/${id}/progress`),
);

export const rebookBooking = createAsyncThunk(
  "booking/rebook",
  (id: number) => api.post<Booking>(`/bookings/${id}/rebook`),
);

const bookingSlice = createSlice({
  name: "booking",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBookings.pending, (state) => {
        state.loading = true;
        state.bookings = [];
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload;
      })
      .addCase(fetchBookings.rejected, (state) => {
        state.loading = false;
        state.bookings = [];
      });
  },
});

export default bookingSlice.reducer;
