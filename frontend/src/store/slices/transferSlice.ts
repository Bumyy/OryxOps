import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

interface Transfer {
  id: number;
  pilot_id: number;
  pilot_callsign: string;
  transfer_type: string;
  from_value: string | null;
  to_value: string;
  reason: string | null;
  status: string;
  requested_at: string;
  reviewed_by_name: string | null;
}

interface TransferState {
  transfers: Transfer[];
  loading: boolean;
}

const initialState: TransferState = {
  transfers: [],
  loading: false,
};

export const fetchTransfers = createAsyncThunk("transfer/fetchAll", () =>
  api.get<Transfer[]>("/transfers"),
);

export const createTransfer = createAsyncThunk(
  "transfer/create",
  (data: { transfer_type: string; from_value?: string; to_value: string; reason?: string }) =>
    api.post<Transfer>("/transfers", data),
);

export const reviewTransfer = createAsyncThunk(
  "transfer/review",
  ({ id, status }: { id: number; status: string }) =>
    api.patch<Transfer>(`/transfers/${id}`, { status }),
);

const transferSlice = createSlice({
  name: "transfer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchTransfers.fulfilled, (state, action) => {
      state.transfers = action.payload;
    });
  },
});

export default transferSlice.reducer;
