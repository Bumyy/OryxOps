import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import careerReducer from "./slices/careerSlice";
import groupReducer from "./slices/groupSlice";
import aircraftReducer from "./slices/aircraftSlice";
import scheduleReducer from "./slices/scheduleSlice";
import bookingReducer from "./slices/bookingSlice";
import transferReducer from "./slices/transferSlice";
import pilotReducer from "./slices/pilotSlice";
import discoveryReducer from "./slices/discoverySlice";
import adminReducer from "./slices/adminSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    career: careerReducer,
    group: groupReducer,
    aircraft: aircraftReducer,
    schedule: scheduleReducer,
    booking: bookingReducer,
    transfer: transferReducer,
    pilot: pilotReducer,
    discovery: discoveryReducer,
    admin: adminReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
