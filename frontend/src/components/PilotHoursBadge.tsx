import React, { useState } from "react";
import type { Booking } from "../store/slices/bookingSlice";
import { calculatePilotBookingHours } from "../utils/pilotHours";
import type { PilotHoursSummary } from "../utils/pilotHours";

interface PilotHoursBadgeProps {
  pilotId: number;
  bookings: Booking[];
  summary?: PilotHoursSummary;
  showBreakdownOnHover?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const PilotHoursBadge: React.FC<PilotHoursBadgeProps> = ({
  pilotId,
  bookings,
  summary: propSummary,
  showBreakdownOnHover = true,
  size = "md",
  className = "",
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const summary = propSummary || calculatePilotBookingHours(bookings, pilotId);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-sm gap-1.5",
    lg: "px-4 py-1.5 text-base gap-2",
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Main Badge */}
      <div
        className={`inline-flex items-center rounded-full font-semibold bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-blue-500/20 text-amber-300 border border-amber-500/30 shadow-sm cursor-help backdrop-blur-sm transition-all hover:border-amber-400 ${sizeClasses[size]}`}
      >
        <span className="text-amber-400">⏱️</span>
        <span>{summary.totalHours} hrs</span>
      </div>

      {/* Reusable Breakdown Tooltip / Popover */}
      {showBreakdownOnHover && showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900/95 text-gray-100 rounded-xl border border-gray-700/80 shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 pb-1 border-b border-gray-800">
            Flight Hours Breakdown
          </div>

          <div className="space-y-2 text-xs">
            {/* Type 1: Full Book */}
            <div className="flex justify-between items-center bg-gray-800/50 px-2.5 py-1.5 rounded-lg border border-gray-700/40">
              <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                <span>✈️</span> Full Book
              </span>
              <span className="font-bold text-gray-100">
                {summary.fullBookHours}h <span className="text-gray-500 font-normal">({summary.fullBookCount} flts)</span>
              </span>
            </div>

            {/* Type 2: Only Dep */}
            <div className="flex justify-between items-center bg-gray-800/50 px-2.5 py-1.5 rounded-lg border border-gray-700/40">
              <span className="flex items-center gap-1.5 text-blue-300 font-medium">
                <span>🛫</span> Departure Only
              </span>
              <span className="font-bold text-gray-100">
                {summary.onlyDepHours}h <span className="text-gray-500 font-normal">({summary.onlyDepCount} flts)</span>
              </span>
            </div>

            {/* Type 3: Only Arri */}
            <div className="flex justify-between items-center bg-gray-800/50 px-2.5 py-1.5 rounded-lg border border-gray-700/40">
              <span className="flex items-center gap-1.5 text-purple-300 font-medium">
                <span>🛬</span> Arrival Only
              </span>
              <span className="font-bold text-gray-100">
                {summary.onlyArriHours}h <span className="text-gray-500 font-normal">({summary.onlyArriCount} flts)</span>
              </span>
            </div>
          </div>

          {/* Total Footer */}
          <div className="mt-2 pt-2 border-t border-gray-800 flex justify-between items-center font-bold text-xs">
            <span className="text-gray-300">Total Logged</span>
            <span className="text-amber-400">{summary.totalHours} hrs ({summary.totalBookingsCount} total)</span>
          </div>

          {/* Tooltip Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};
export default PilotHoursBadge;
