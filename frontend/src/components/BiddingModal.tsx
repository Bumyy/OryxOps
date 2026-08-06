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
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-gray-900 border-b border-gray-800 flex justify-between items-center">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-400">
              Fleet Bidding Session #{session.id}
            </span>
            <h2 className="text-xl font-bold text-white">
              {session.group_name} ({session.slots_offered} {session.slots_offered === 1 ? "Slot" : "Slots"})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5 text-gray-200 text-sm">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-xl text-red-300 text-xs">
              ⚠️ {error}
            </div>
          )}

          {/* Fee Breakdown Card */}
          <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/60 space-y-3">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Financial Breakdown
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-300">Bidding Entry Fee (Non-refundable)</span>
              <span className="font-semibold text-amber-400">{biddingFee.toLocaleString()} QAR</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-300 flex items-center gap-1.5">
                Path Switch Fee
                {session.user_path_switch_required && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                    Airbus ↔ Boeing
                  </span>
                )}
              </span>
              <span className={`font-semibold ${session.user_path_switch_required ? "text-purple-300" : "text-gray-500"}`}>
                {session.user_path_switch_required ? `${pathSwitchFee.toLocaleString()} QAR` : "0 QAR (Same Path)"}
              </span>
            </div>

            <div className="pt-2 border-t border-gray-700/60 flex justify-between items-center font-bold text-base">
              <span>Total Upfront Cost</span>
              <span className="text-emerald-400">{totalCost.toLocaleString()} QAR</span>
            </div>
          </div>

          {/* Refund Notice */}
          <div className="p-3.5 bg-blue-950/40 border border-blue-800/50 rounded-xl text-xs space-y-1.5 text-blue-200">
            <div className="font-semibold text-blue-300">🛡️ Financial Protection & Refund Guarantee</div>
            <ul className="list-disc list-inside space-y-1 text-blue-300/90">
              <li>If your bid is <strong>unsuccessful</strong>, your <strong>Path Switch Fee ({pathSwitchFee.toLocaleString()} QAR)</strong> is 100% refunded!</li>
              <li>If you withdraw early, you receive a <strong>50% refund on Bidding Fee</strong> and <strong>100% refund on Path Switch Fee</strong>.</li>
            </ul>
          </div>

          {/* Balance Status */}
          <div className="flex justify-between items-center text-xs px-1">
            <span className="text-gray-400">Your Current QAR Balance:</span>
            <span className={`font-bold ${canAfford ? "text-emerald-400" : "text-red-400"}`}>
              {userBalance.toLocaleString()} QAR
            </span>
          </div>

          {!canAfford && !isSubmitted && (
            <div className="p-2.5 bg-red-950/40 border border-red-800/40 rounded-xl text-red-300 text-xs">
              ❌ Insufficient QAR balance to place this bid. Earn QAR by completing flights!
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Close
            </button>

            {isSubmitted ? (
              <button
                onClick={handleWithdraw}
                disabled={loading}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-red-900/30 disabled:opacity-50"
              >
                {loading ? "Processing..." : "Withdraw Bid (50% Refund)"}
              </button>
            ) : (
              <button
                onClick={handleApply}
                disabled={loading || !canAfford}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
