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
  (params?: { pilot_id?: number; schedule_id?: number; status?: string; group_id?: number }) => {
    const qs = new URLSearchParams();
    if (params?.pilot_id) qs.set("pilot_id", String(params.pilot_id));
    if (params?.schedule_id) qs.set("schedule_id", String(params.schedule_id));
    if (params?.status) qs.set("status", params.status);
    if (params?.group_id) qs.set("group_id", String(params.group_id));
    return api.get<Booking[]>(`/bookings?${qs.toString()}`);
  },
);

export const createBooking = createAsyncThunk(
  "booking/create",
  ({ scheduleId, bookingType = "both" }: { scheduleId: number; bookingType?: string }) =>
    api.post<Booking | Booking[]>("/bookings", { schedule_id: scheduleId, booking_type: bookingType }),
);

export const cancelBooking = createAsyncThunk(
  "booking/cancel",
  (id: number) => api.delete(`/bookings/${id}`),
);

export const dispatchBooking = createAsyncThunk(
  "booking/dispatch",
  (id: number) => api.post<Booking>(`/bookings/${id}/dispatch`),
);

export const completeBooking = createAsyncThunk(
  "booking/complete",
  ({ id, flightTimeMinutes, fuelBurned, landingFpm, actualArrival }: { id: number; flightTimeMinutes: number; fuelBurned: number; landingFpm: number; actualArrival?: string }) =>
    api.post<Booking>(`/bookings/${id}/complete`, {
      flight_time_minutes: flightTimeMinutes,
      fuel_burned: fuelBurned,
      landing_fpm: landingFpm,
      actual_arrival: actualArrival
    }),
);

export const noShowBooking = createAsyncThunk(
  "booking/noShow",
  (id: number) => api.post<Booking>(`/bookings/${id}/no-show`),
);

export const takeOverBooking = createAsyncThunk(
  "booking/takeOver",
  (id: number) => api.post<Booking>(`/bookings/${id}/take-over`),
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
