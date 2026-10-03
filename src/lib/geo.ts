import type { LatLng } from "./types";

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Cheap bounding box around a point — used to pre-filter spatial queries
 * before applying the exact haversine check (PostGIS-free spatial index).
 */
export function boundingBox(center: LatLng, radiusKm: number): BoundingBox {
  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.32 * Math.max(0.2, Math.cos(toRad(center.lat))));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/** Linear interpolation between two coordinates. */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  const clamped = Math.min(1, Math.max(0, t));
  return {
    lat: a.lat + (b.lat - a.lat) * clamped,
    lng: a.lng + (b.lng - a.lng) * clamped,
  };
}

/** Move from `from` towards `to` by at most `stepKm`. */
export function moveTowards(from: LatLng, to: LatLng, stepKm: number): LatLng {
  const total = haversineKm(from, to);
  if (total <= stepKm || total === 0) return { lat: to.lat, lng: to.lng };
  return interpolate(from, to, stepKm / total);
}

export interface PolylineAdvance {
  position: LatLng;
  heading: number;
  segmentIndex: number;
  finished: boolean;
}

/** Find the route point nearest to a GPS position when resuming simulation. */
export function nearestPolylineIndex(position: LatLng, points: readonly LatLng[]): number {
  if (points.length < 2) return 0;
  let closest = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i++) {
    const candidate = haversineKm(position, points[i]);
    if (candidate < distance) {
      closest = i;
      distance = candidate;
    }
  }
  return closest;
}

/** Advance by distance along a road polyline without cutting across segments. */
export function advanceAlongPolyline(
  points: readonly LatLng[],
  segmentIndex: number,
  stepKm: number,
  currentPosition?: LatLng,
): PolylineAdvance | null {
  if (points.length < 2) return null;

  let index = Math.max(0, Math.min(points.length - 1, Math.floor(segmentIndex)));
  if (index >= points.length - 1) {
    return { position: points[points.length - 1], heading: bearingDeg(points[index - 1], points[index]), segmentIndex: index, finished: true };
  }
  let position = currentPosition ?? points[index];
  let remaining = Math.max(0, stepKm);
  let heading = bearingDeg(position, points[index + 1]);

  while (index < points.length - 1) {
    const next = points[index + 1];
    const length = haversineKm(position, next);
    if (length < 0.001) {
      position = next;
      index++;
      if (index >= points.length - 1) break;
      continue;
    }

    heading = bearingDeg(position, next);
    if (remaining >= length) {
      position = next;
      remaining -= length;
      index++;
      if (remaining === 0) break;
    } else {
      position = moveTowards(position, next, remaining);
      break;
    }
  }

  return { position, heading, segmentIndex: Math.min(index, points.length - 1), finished: index >= points.length - 1 };
}

/** Heading in degrees (0 = north, clockwise) from a to b. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
