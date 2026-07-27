import { useEffect, useState } from "react";
import { useCurrency } from "../hooks/useCurrency";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchMyProfile } from "../store/slices/pilotSlice";
import { api } from "../api/client";
import useReveal from "../hooks/useReveal";

export default function Shop() {
  const dispatch = useAppDispatch();
  const { formatAmount } = useCurrency();
  const { user } = useAppSelector((s) => s.auth);
  const { currentPilot } = useAppSelector((s) => s.pilot);
  const revealRef = useReveal();

  const pilot = currentPilot || user;
  const [balance, setBalance] = useState<number>(pilot?.token_balance || 0);
  const [quota, setQuota] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchQuota = async () => {
    try {
      const today = new Date();
      // Start of week (Monday)
      const monday = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))).toISOString().split('T')[0];
      const data = await api.get<any>(`/schedules/proposal-quota?week_start=${monday}`);
      if (data) {
        setQuota(data);
      }
    } catch (e) {
      console.error("Failed to fetch proposal quota", e);
    }
  };

  useEffect(() => {
    dispatch(fetchMyProfile());
    fetchQuota();
  }, [dispatch]);

  useEffect(() => {
    if (pilot?.token_balance !== undefined) {
      setBalance(pilot.token_balance);
    }
  }, [pilot]);

  const handleBuyToken = async (slotType: "short" | "long") => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.post<{ detail: string; balance: number }>(
        `/schedules/buy-proposal-token?slot_type=${slotType}`
      );
      if (res) {
        setBalance(res.balance);
        setSuccessMsg(res.detail);
        dispatch(fetchMyProfile());
        fetchQuota();
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || "Failed to purchase token. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in" ref={revealRef}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-5xl font-bold text-brand">OryxOps Shop</h1>
          <p className="text-gray-500 mt-2 font-medium">Pre-purchase flight proposal slot tokens to schedule extra flights beyond your rank limits.</p>
        </div>
        <div className="bg-brand-pale border border-brand-border px-6 py-4 rounded-3xl flex flex-col gap-1">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Your Balance</span>
          <span className="text-3xl font-extrabold text-brand-dark">
            {formatAmount(balance)}
          </span>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-6 py-4 rounded-2xl mb-8 flex items-center gap-3 animate-slide-in">
          <span className="text-2xl">✨</span>
          <div>
            <p className="font-bold">Purchase Successful!</p>
            <p className="text-sm text-emerald-700">{successMsg}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-6 py-4 rounded-2xl mb-8 flex items-center gap-3 animate-slide-in">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-bold">Transaction Failed</p>
            <p className="text-sm text-rose-700">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Current Quota Status */}
      <div className="bg-white rounded-3xl border border-brand-border p-6 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Your Proposal Tokens</h2>
          <p className="text-sm text-gray-500 mt-1">Tokens currently available in your account. They will be consumed automatically when proposing extra flights.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="bg-brand-pale/40 border border-brand-border/60 px-5 py-3 rounded-2xl text-center min-w-[120px]">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Short-Haul Tokens</p>
            <p className="text-2xl font-black text-brand mt-1">{quota?.purchased_short_slots ?? 0}</p>
          </div>
          <div className="bg-brand-pale/40 border border-brand-border/60 px-5 py-3 rounded-2xl text-center min-w-[120px]">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Long-Haul Tokens</p>
            <p className="text-2xl font-black text-brand mt-1">{quota?.purchased_long_slots ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Short Haul Product */}
        <div className="bg-white rounded-3xl border border-brand-border shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all duration-300 group">
          <div className="p-8">
            <div className="w-12 h-12 bg-brand-pale text-brand rounded-2xl flex items-center justify-center text-xl font-bold mb-6 group-hover:scale-110 transition-transform">
              ✈️
            </div>
            <h3 className="text-2xl font-black text-gray-800">Short-Haul Proposal Slot Token</h3>
            <p className="text-sm text-gray-400 mt-1 uppercase font-bold tracking-wider">For Flights Under 8 Hours</p>
            <p className="text-gray-500 mt-4 leading-relaxed">
              Pre-purchase short-haul proposal tokens to avoid direct charges on flight proposals. When proposing a weekly flight beyond your free limit that has a duration of less than 8 hours, one short-haul token will be consumed instead of charging 1,000 QAR from your wallet.
            </p>
          </div>
          <div className="border-t border-brand-border p-8 bg-gray-50/50 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cost</p>
              <p className="text-2xl font-black text-brand-dark">{formatAmount(1000)}</p>
            </div>
            <button
              onClick={() => handleBuyToken("short")}
              disabled={loading || balance < 1000}
              className="bg-brand hover:bg-brand-light disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold px-6 py-3 rounded-2xl shadow-md disabled:shadow-none hover:shadow-lg transition-all duration-200 cursor-pointer"
            >
              {loading ? "Processing..." : balance < 1000 ? "Insufficient Funds" : "Buy Token"}
            </button>
          </div>
        </div>

        {/* Long Haul Product */}
        <div className="bg-white rounded-3xl border border-brand-border shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all duration-300 group">
          <div className="p-8">
            <div className="w-12 h-12 bg-brand-pale text-brand rounded-2xl flex items-center justify-center text-xl font-bold mb-6 group-hover:scale-110 transition-transform">
              🌍
            </div>
            <h3 className="text-2xl font-black text-gray-800">Long-Haul Proposal Slot Token</h3>
            <p className="text-sm text-gray-400 mt-1 uppercase font-bold tracking-wider">For Flights 8 Hours or More</p>
            <p className="text-gray-500 mt-4 leading-relaxed">
              Pre-purchase long-haul proposal tokens for long flight routes. When proposing extra weekly flights of 8 hours or longer, having this long-haul token guarantees you don't get hit with the standard 2,000 QAR direct charge.
            </p>
          </div>
          <div className="border-t border-brand-border p-8 bg-gray-50/50 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cost</p>
              <p className="text-2xl font-black text-brand-dark">{formatAmount(2000)}</p>
            </div>
            <button
              onClick={() => handleBuyToken("long")}
              disabled={loading || balance < 2000}
              className="bg-brand hover:bg-brand-light disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold px-6 py-3 rounded-2xl shadow-md disabled:shadow-none hover:shadow-lg transition-all duration-200 cursor-pointer"
            >
              {loading ? "Processing..." : balance < 2000 ? "Insufficient Funds" : "Buy Token"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
