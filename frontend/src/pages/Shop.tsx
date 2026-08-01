import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "../hooks/useCurrency";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchMyProfile } from "../store/slices/pilotSlice";
import { api } from "../api/client";
import useReveal from "../hooks/useReveal";

export default function Shop() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { formatAmount } = useCurrency();
  const { user } = useAppSelector((s) => s.auth);
  const { currentPilot } = useAppSelector((s) => s.pilot);
  const revealRef = useReveal();

  const pilot = currentPilot || user;
  const [balance, setBalance] = useState<number>(pilot?.token_balance || 0);
  const [quota, setQuota] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [purchasedTokenInfo, setPurchasedTokenInfo] = useState<{
    slotType: "short" | "long";
    title: string;
    cost: number;
    message: string;
    newBalance: number;
    updatedStock: number;
  } | null>(null);

  const fetchQuota = async () => {
    try {
      const today = new Date();
      // Start of week (Monday)
      const monday = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))).toISOString().split('T')[0];
      const data = await api.get<any>(`/schedules/proposal-quota?week_start=${monday}`);
      if (data) {
        setQuota(data);
        return data;
      }
    } catch (e) {
      console.error("Failed to fetch proposal quota", e);
    }
    return null;
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
    setErrorMsg(null);
    try {
      const cost = slotType === "short" ? 1000 : 2000;
      const res = await api.post<{ detail: string; balance: number }>(
        `/schedules/buy-proposal-token?slot_type=${slotType}`
      );
      if (res) {
        setBalance(res.balance);
        dispatch(fetchMyProfile());
        const updatedQuota = await fetchQuota();
        
        const newStock = slotType === "short"
          ? (updatedQuota?.purchased_short_slots ?? ((quota?.purchased_short_slots ?? 0) + 1))
          : (updatedQuota?.purchased_long_slots ?? ((quota?.purchased_long_slots ?? 0) + 1));

        setPurchasedTokenInfo({
          slotType,
          title: slotType === "short" ? "Short-Haul Proposal Slot Token (<8hrs)" : "Long-Haul Proposal Slot Token (>8hrs)",
          cost,
          message: res.detail,
          newBalance: res.balance,
          updatedStock: newStock,
        });
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

      {/* ── PURCHASE SUCCESS MODAL POPUP ── */}
      {purchasedTokenInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
          onClick={() => setPurchasedTokenInfo(null)}
        >
          <div
            className="bg-white dark:bg-[#161920] rounded-3xl border border-brand-border shadow-2xl max-w-md w-full overflow-hidden animate-scale-up relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setPurchasedTokenInfo(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300 flex items-center justify-center text-lg font-bold transition-colors cursor-pointer"
            >
              ×
            </button>

            {/* Top Celebration Banner & Icon */}
            <div className="pt-8 pb-4 px-6 text-center flex flex-col items-center">
              <div className="relative mb-4">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center shadow-lg animate-bounce-short">
                  <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="absolute -top-1 -right-1 text-xl animate-pulse">✨</span>
                <span className="absolute -bottom-1 -left-1 text-lg">🎟️</span>
              </div>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                Transaction Completed
              </span>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white mt-3">
                Token Purchased Successfully!
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs leading-relaxed">
                {purchasedTokenInfo.message || "Your proposal slot token has been added to your inventory."}
              </p>
            </div>

            {/* Receipt & Inventory Breakdown Card */}
            <div className="px-6 py-2">
              <div className="bg-brand-pale/60 dark:bg-brand-pale/10 border border-brand-border/80 dark:border-brand-border/40 rounded-2xl p-4 space-y-3">
                {/* Item Purchased */}
                <div className="flex items-center justify-between gap-2 border-b border-brand-border/40 pb-2.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{purchasedTokenInfo.slotType === "short" ? "✈️" : "🌐"}</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200 truncate">{purchasedTokenInfo.title}</span>
                  </div>
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                    +1 Token
                  </span>
                </div>

                {/* Amount Paid */}
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-500 dark:text-gray-400">Amount Paid:</span>
                  <span className="font-black text-rose-600 dark:text-rose-400 font-mono">
                    -{formatAmount(purchasedTokenInfo.cost)}
                  </span>
                </div>

                {/* Updated Balance */}
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-500 dark:text-gray-400">New Wallet Balance:</span>
                  <span className="font-extrabold text-brand-dark dark:text-brand-light font-mono text-sm">
                    {formatAmount(purchasedTokenInfo.newBalance)}
                  </span>
                </div>

                {/* Available Inventory Stock */}
                <div className="flex justify-between items-center text-xs border-t border-brand-border/40 pt-2 text-gray-700 dark:text-gray-300">
                  <span className="font-semibold text-gray-500 dark:text-gray-400">Available Stock:</span>
                  <span className="font-black text-brand dark:text-brand-light bg-brand/10 px-2 py-0.5 rounded-md">
                    {purchasedTokenInfo.updatedStock} {purchasedTokenInfo.slotType === "short" ? "Short-Haul" : "Long-Haul"} Token{purchasedTokenInfo.updatedStock !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 space-y-2">
              <button
                onClick={() => navigate("/schedule")}
                className="w-full rounded-2xl bg-gradient-to-r from-brand-dark to-brand hover:from-brand hover:to-brand-dark text-white font-black py-3.5 px-4 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                <span>Schedule a Flight Now</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
              <button
                onClick={() => setPurchasedTokenInfo(null)}
                className="w-full rounded-2xl border border-brand-border text-gray-600 dark:text-gray-300 hover:bg-brand-pale/50 font-bold py-2.5 text-xs transition-colors cursor-pointer"
              >
                Keep Shopping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

