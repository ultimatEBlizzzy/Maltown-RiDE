import type { RideStatus } from "./types";

/**
 * Strict ride lifecycle state machine. Every transition is validated on the
 * backend; clients can never force an invalid state change.
 *
 *   REQUESTED → SEARCHING → ACCEPTED → DRIVER_ARRIVING → DRIVER_ARRIVED
 *     → IN_PROGRESS → COMPLETED
 * Cancellation is allowed until the trip is IN_PROGRESS.
 */
const TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  REQUESTED: ["SEARCHING", "CANCELLED"],
  SEARCHING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["DRIVER_ARRIVING", "CANCELLED"],
  DRIVER_ARRIVING: ["DRIVER_ARRIVED", "CANCELLED"],
  DRIVER_ARRIVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: RideStatus, to: RideStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidTransitionError extends Error {
  readonly status = 409;
  constructor(from: RideStatus, to: RideStatus) {
    super(`Invalid ride transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: RideStatus, to: RideStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** Statuses where cancellation is allowed (by rider or assigned driver). */
export const CANCELLABLE_STATUSES: RideStatus[] = [
  "REQUESTED",
  "SEARCHING",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "DRIVER_ARRIVED",
];

export const TERMINAL_STATUSES: RideStatus[] = ["COMPLETED", "CANCELLED"];
