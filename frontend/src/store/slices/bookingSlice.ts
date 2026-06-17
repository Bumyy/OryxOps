import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

interface Booking {
  id: number;
  schedule_id: number;
  pilot_id: number;
  pilot_callsign: string;
  pilot_avatar?: string;
  booking_type: string;
  token_cost: number;
  booked_at: string;
  status: string;
  completed_pirep_id: number | null;
  taken_over_by_name: string | null;
  flight_departure: string;
  flight_arrival: string;
  flight_scheduled_dep: string;
  aircraft_registration: string;
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
    api.post<Booking>("/bookings", { schedule_id: scheduleId, booking_type: bookingType }),
);

export const cancelBooking = createAsyncThunk(
  "booking/cancel",
  (id: number) => api.delete(`/bookings/${id}`),
);

export const completeBooking = createAsyncThunk(
  "booking/complete",
  ({ id, pirepId }: { id: number; pirepId: number }) =>
    api.post<Booking>(`/bookings/${id}/complete`, { pirep_id: pirepId }),
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
    builder.addCase(fetchBookings.fulfilled, (state, action) => {
      state.bookings = action.payload;
    });
  },
});

export default bookingSlice.reducer;
