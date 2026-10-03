import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, CANCELLABLE_STATUSES, InvalidTransitionError } from "../src/lib/ride-machine";

describe("ride state machine", () => {
  it("allows the happy-path lifecycle", () => {
    expect(canTransition("REQUESTED", "SEARCHING")).toBe(true);
    expect(canTransition("SEARCHING", "ACCEPTED")).toBe(true);
    expect(canTransition("ACCEPTED", "DRIVER_ARRIVING")).toBe(true);
    expect(canTransition("DRIVER_ARRIVING", "DRIVER_ARRIVED")).toBe(true);
    expect(canTransition("DRIVER_ARRIVED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
  });

  it("rejects COMPLETED -> REQUESTED (spec-required)", () => {
    expect(canTransition("COMPLETED", "REQUESTED")).toBe(false);
  });

  it("rejects backwards and skip transitions", () => {
    expect(canTransition("IN_PROGRESS", "SEARCHING")).toBe(false);
    expect(canTransition("SEARCHING", "IN_PROGRESS")).toBe(false);
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("CANCELLED", "SEARCHING")).toBe(false);
    expect(canTransition("REQUESTED", "COMPLETED")).toBe(false);
  });

  it("allows cancellation until the trip is in progress", () => {
    for (const status of CANCELLABLE_STATUSES) {
      expect(canTransition(status, "CANCELLED")).toBe(true);
    }
    expect(canTransition("IN_PROGRESS", "CANCELLED")).toBe(false);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
  });

  it("assertTransition throws a 409-class error on invalid transitions", () => {
    expect(() => assertTransition("COMPLETED", "REQUESTED")).toThrow(InvalidTransitionError);
    try {
      assertTransition("COMPLETED", "REQUESTED");
    } catch (err) {
      expect((err as InvalidTransitionError).status).toBe(409);
    }
  });
});
