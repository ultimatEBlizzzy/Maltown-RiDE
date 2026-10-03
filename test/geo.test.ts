import { describe, expect, it } from "vitest";
import { bearingDeg, boundingBox, haversineKm, isValidLatLng, moveTowards } from "../src/lib/geo";

describe("geo utilities", () => {
  const malamulele = { lat: -23.002718, lng: 30.6946597 };
  const xigalo = { lat: -22.9369282, lng: 30.7204003 };

  it("returns zero distance for the same point", () => {
    expect(haversineKm(malamulele, malamulele)).toBe(0);
  });

  it("measures Malamulele town centre → Xigalo as about 7.8 km", () => {
    const d = haversineKm(malamulele, xigalo);
    expect(d).toBeGreaterThan(7.5);
    expect(d).toBeLessThan(8.1);
  });

  it("bounding box contains the origin and grows with radius", () => {
    const small = boundingBox(malamulele, 1);
    const large = boundingBox(malamulele, 5);
    expect(small.minLat).toBeLessThan(malamulele.lat);
    expect(small.maxLat).toBeGreaterThan(malamulele.lat);
    expect(large.maxLng - large.minLng).toBeGreaterThan(small.maxLng - small.minLng);
  });

  it("moveTowards reaches the target when the step covers the remainder", () => {
    const next = moveTowards(malamulele, xigalo, 100);
    expect(next).toEqual(xigalo);
  });

  it("moveTowards moves closer without overshooting", () => {
    const next = moveTowards(malamulele, xigalo, 2);
    const before = haversineKm(malamulele, xigalo);
    const after = haversineKm(next, xigalo);
    expect(after).toBeLessThan(before);
    expect(before - after).toBeLessThanOrEqual(2.001);
  });

  it("bearing is ~north for a destination due north", () => {
    const north = { lat: malamulele.lat + 0.01, lng: malamulele.lng };
    expect(bearingDeg(malamulele, north)).toBeLessThan(2);
  });

  it("validates coordinates", () => {
    expect(isValidLatLng(-23.0027, 30.6947)).toBe(true);
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(0, 181)).toBe(false);
    expect(isValidLatLng("a", 0)).toBe(false);
  });
});
