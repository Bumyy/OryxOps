import React, { useState } from "react";
import { biddingApi } from "../api/biddingApi";
import type { BiddingSession } from "../api/biddingApi";

interface BiddingModalProps {
  session: BiddingSession;
  userBalance?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BiddingModal: React.FC<BiddingModalProps> = ({
  session,
  userBalance = 0,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const biddingFee = session.bidding_fee_qar;
  const pathSwitchFee = session.user_path_switch_required ? session.path_switch_fee_qar : 0;
  const totalCost = biddingFee + pathSwitchFee;
  const canAfford = userBalance >= totalCost;
  const isSubmitted = session.user_applicant_status === "submitted";

  const handleApply = async () => {
    try {
      setLoading(true);
      setError(null);
      await biddingApi.applyForBid(session.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit bid.");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!window.confirm("Are you sure you want to withdraw your bid? You will receive a 50% refund on the bidding fee and a 100% refund on the path switch fee.")) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await biddingApi.withdrawBid(session.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to withdraw bid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white border border-brand-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-transparent border-b border-brand-border flex justify-between items-center">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-brand">
              Fleet Bidding Session #{session.id}
            </span>
            <h2 className="text-xl font-extrabold text-gray-800">
              {session.group_name} ({session.slots_offered} {session.slots_offered === 1 ? "Slot" : "Slots"})
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5 text-gray-700 text-sm">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-xl text-red-300 text-xs">
              ⚠️ {error}
            </div>
          )}

          {/* Fee Breakdown Card */}
          <div className="bg-gray-50 rounded-xl p-4 border border-brand-border space-y-3">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Financial Breakdown
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-semibold">Bidding Entry Fee (Non-refundable)</span>
              <span className="font-extrabold text-amber-600 dark:text-amber-400">{biddingFee.toLocaleString()} QAR</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-semibold flex items-center gap-1.5">
                Path Switch Fee
                {session.user_path_switch_required && (
                  <span className="px-2 py-0.5 text-[10px] bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50 rounded-full font-bold">
                    Airbus ↔ Boeing
                  </span>
                )}
              </span>
              <span className={`font-extrabold ${session.user_path_switch_required ? "text-purple-600 dark:text-purple-400" : "text-gray-400"}`}>
                {session.user_path_switch_required ? `${pathSwitchFee.toLocaleString()} QAR` : "0 QAR (Same Path)"}
              </span>
            </div>

            <div className="pt-2.5 border-t border-brand-border flex justify-between items-center font-black text-base text-gray-800">
              <span>Total Upfront Cost</span>
              <span className="text-emerald-600 dark:text-emerald-400">{totalCost.toLocaleString()} QAR</span>
            </div>
          </div>

          {/* Refund Notice */}
          <div className="p-3.5 bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800/50 rounded-xl text-xs space-y-1.5 text-blue-800 dark:text-blue-200">
            <div className="font-bold text-blue-900 dark:text-blue-300">🛡️ Financial Protection & Refund Guarantee</div>
            <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300/90">
              <li>If your bid is <strong>unsuccessful</strong>, your <strong>Path Switch Fee ({pathSwitchFee.toLocaleString()} QAR)</strong> is 100% refunded!</li>
              <li>If you withdraw early, you receive a <strong>50% refund on Bidding Fee</strong> and <strong>100% refund on Path Switch Fee</strong>.</li>
            </ul>
          </div>

          {/* Balance Status */}
          <div className="flex justify-between items-center text-xs px-1">
            <span className="text-gray-500 font-semibold">Your Current QAR Balance:</span>
            <span className={`font-black ${canAfford ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {userBalance.toLocaleString()} QAR
            </span>
          </div>

          {!canAfford && !isSubmitted && (
            <div className="p-2.5 bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-800/40 rounded-xl text-red-700 dark:text-red-300 text-xs font-semibold">
              ❌ Insufficient QAR balance to place this bid. Earn QAR by completing flights!
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
            >
              Close
            </button>

            {isSubmitted ? (
              <button
                onClick={handleWithdraw}
                disabled={loading}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {loading ? "Processing..." : "Withdraw Bid (50% Refund)"}
              </button>
            ) : (
              <button
                onClick={handleApply}
                disabled={loading || !canAfford}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Submitting..." : `Submit Bid (${totalCost.toLocaleString()} QAR)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
