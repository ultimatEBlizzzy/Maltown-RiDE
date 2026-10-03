import { config } from "./config";
import { classMultiplier, type FareBreakdown, type VehicleClassId } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Configurable fare engine. The backend is the single source of truth for
 * fares — clients only ever display values produced here.
 *
 *   total = (base + distance*perKm + duration*perMin) * classMultiplier + bookingFee
 */
export function estimateFare(
  distanceKm: number,
  durationMin: number,
  vehicleClass: VehicleClassId = "STANDARD",
): FareBreakdown {
  const f = config.fare;
  const multiplier = classMultiplier(vehicleClass);
  const distanceCost = Math.max(0, distanceKm) * f.perKm;
  const timeCost = Math.max(0, durationMin) * f.perMin;
  const metered = (f.base + distanceCost + timeCost) * multiplier;
  const total = Math.max(f.minFare, Math.round(metered + f.bookingFee));
  return {
    base: round2(f.base * multiplier),
    distanceKm: round2(distanceKm),
    durationMin: round2(durationMin),
    distanceCost: round2(distanceCost * multiplier),
    timeCost: round2(timeCost * multiplier),
    bookingFee: round2(f.bookingFee),
    multiplier,
    total,
    currency: f.currency,
  };
}

/** Driver payout for a completed fare. */
export function driverPayout(fare: number): number {
  return Math.round(fare * config.driverShare);
}
