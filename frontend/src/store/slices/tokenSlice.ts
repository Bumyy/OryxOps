import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api/client";

interface TokenBalance {
  balance: number;
  total_earned: number;
  total_spent: number;
}

interface TokenTransaction {
  id: number;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
}

interface TokenState {
  balance: TokenBalance | null;
  transactions: TokenTransaction[];
  loading: boolean;
}

const initialState: TokenState = {
  balance: null,
  transactions: [],
  loading: false,
};

export const fetchBalance = createAsyncThunk("token/fetchBalance", () =>
  api.get<TokenBalance>("/tokens/balance"),
);

export const fetchTransactions = createAsyncThunk(
  "token/fetchTransactions",
  (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    return api.get<TokenTransaction[]>(`/tokens/transactions?${qs.toString()}`);
  },
);

export const grantTokens = createAsyncThunk(
  "token/grant",
  (data: { pilot_id: number; amount: number; description?: string }) =>
    api.post<TokenBalance>("/tokens/grant", data),
);

export const removeTokens = createAsyncThunk(
  "token/remove",
  (data: { pilot_id: number; amount: number; description?: string }) =>
    api.post<TokenBalance>("/tokens/remove", data),
);

const tokenSlice = createSlice({
  name: "token",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBalance.fulfilled, (state, action) => {
        state.balance = action.payload;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.transactions = action.payload;
      });
  },
});

export default tokenSlice.reducer;
