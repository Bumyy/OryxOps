import type { Booking } from "../store/slices/bookingSlice";

export interface PilotHoursSummary {
  fullBookHours: number;      // Hours from full/solo bookings
  onlyDepHours: number;       // Hours from departure-only bookings
  onlyArriHours: number;      // Hours from arrival-only bookings
  totalHours: number;         // Total combined flight hours
  
  fullBookCount: number;      // Count of full/solo bookings
  onlyDepCount: number;       // Count of departure-only bookings
  onlyArriCount: number;      // Count of arrival-only bookings
  totalBookingsCount: number; // Total completed bookings count
}

/**
 * Calculates pilot flight hours from booking records broken down into 3 types:
 * 1. Full Book: Pilot flew both Departure & Arrival legs (or solo flight)
 * 2. Only Dep: Pilot flew only the Departure leg
 * 3. Only Arri: Pilot flew only the Arrival leg
 */
export function calculatePilotBookingHours(
  bookings: Booking[],
  pilotId: number
): PilotHoursSummary {
  let fullBookMins = 0;
  let onlyDepMins = 0;
  let onlyArriMins = 0;

  let fullBookCount = 0;
  let onlyDepCount = 0;
  let onlyArriCount = 0;

  if (!bookings || !Array.isArray(bookings)) {
    return {
      fullBookHours: 0,
      onlyDepHours: 0,
      onlyArriHours: 0,
      totalHours: 0,
      fullBookCount: 0,
      onlyDepCount: 0,
      onlyArriCount: 0,
      totalBookingsCount: 0,
    };
  }

  for (const b of bookings) {
    if (b.status !== "completed") continue;

    const isDepPilot = b.departure_pilot_id === pilotId;
    const isArrPilot = b.arrival_pilot_id === pilotId;

    if (!isDepPilot && !isArrPilot) continue;

    // Flight time in minutes (fallback to scheduled duration if actual not available)
    const minutes = b.flight_time_minutes || b.scheduled_duration_minutes || 0;

    if (isDepPilot && (isArrPilot || !b.arrival_pilot_id)) {
      // Full Book (solo or both legs)
      fullBookMins += minutes;
      fullBookCount++;
    } else if (isDepPilot && !isArrPilot) {
      // Departure leg only
      onlyDepMins += minutes;
      onlyDepCount++;
    } else if (isArrPilot && !isDepPilot) {
      // Arrival leg only
      onlyArriMins += minutes;
      onlyArriCount++;
    }
  }

  const fullBookHours = Number((fullBookMins / 60).toFixed(1));
  const onlyDepHours = Number((onlyDepMins / 60).toFixed(1));
  const onlyArriHours = Number((onlyArriMins / 60).toFixed(1));
  const totalHours = Number(((fullBookMins + onlyDepMins + onlyArriMins) / 60).toFixed(1));

  return {
    fullBookHours,
    onlyDepHours,
    onlyArriHours,
    totalHours,
    fullBookCount,
    onlyDepCount,
    onlyArriCount,
    totalBookingsCount: fullBookCount + onlyDepCount + onlyArriCount,
  };
}
