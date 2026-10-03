import { describe, expect, it } from "vitest";
import { driverPayout, estimateFare } from "../src/lib/fare";
import { formatZAR } from "../src/lib/types";

describe("fare engine", () => {
  it("computes base + distance + time + booking fee for STANDARD", () => {
    const fare = estimateFare(10, 20, "STANDARD");
    // R15 + 10*R6 + 20*R0.80 = R91 metered, + R5 booking
    expect(fare.total).toBe(96);
    expect(fare.currency).toBe("ZAR");
    expect(fare.multiplier).toBe(1);
    expect(fare.distanceCost).toBe(60);
    expect(fare.timeCost).toBe(16);
    expect(fare.bookingFee).toBe(5);
  });

  it("applies the COMFORT class multiplier to metered components only", () => {
    const fare = estimateFare(10, 20, "COMFORT");
    expect(fare.multiplier).toBeCloseTo(1.35);
    expect(fare.total).toBe(Math.round(91 * 1.35) + 5);
  });

  it("applies the BODA class discount", () => {
    const fare = estimateFare(10, 20, "BODA");
    expect(fare.total).toBe(Math.round(91 * 0.6) + 5);
  });

  it("enforces the minimum fare", () => {
    const fare = estimateFare(0.1, 1, "STANDARD");
    expect(fare.total).toBe(25);
  });

  it("never returns negative components", () => {
    const fare = estimateFare(-5, -10, "STANDARD");
    expect(fare.distanceCost).toBe(0);
    expect(fare.timeCost).toBe(0);
    expect(fare.total).toBeGreaterThanOrEqual(25);
  });

  it("formats whole-rand amounts with the South African rand symbol", () => {
    expect(formatZAR(12345.4)).toBe("R 12\u00a0345");
  });

  it("pays drivers the configured share (80%)", () => {
    expect(driverPayout(10000)).toBe(8000);
    expect(driverPayout(4250)).toBe(3400);
  });
});
