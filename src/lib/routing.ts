import { config } from "./config";
import { haversineKm, interpolate } from "./geo";
import type { LatLng } from "./types";

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  /** Route polyline as [lat, lng] pairs. */
  geometry: [number, number][];
}

/**
 * RoutingProvider abstraction. Ride logic never talks to OSRM directly —
 * swap providers via configuration. If the configured provider fails, the
 * mock development provider keeps the platform fully operational.
 */
export interface RoutingProvider {
  readonly name: string;
  route(from: LatLng, to: LatLng): Promise<RouteResult>;
}

/**
 * Development provider: great-circle distance corrected by a road factor,
 * duration from a configurable average urban speed, synthetic geometry with
 * a gentle arc so route lines look natural on the map.
 */
export class MockRoutingProvider implements RoutingProvider {
  readonly name = "mock";

  async route(from: LatLng, to: LatLng): Promise<RouteResult> {
    const straight = haversineKm(from, to);
    const distanceKm = Math.max(0.3, straight * config.routing.roadFactor);
    const durationMin = Math.max(2, (distanceKm / config.matching.avgSpeedKmh) * 60);

    const points: [number, number][] = [];
    const segments = 18;
    // Perpendicular offset creates a believable street-like arc.
    const bow = Math.min(0.0012, straight * 0.00012);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = interpolate(from, to, t);
      const offset = Math.sin(Math.PI * t) * bow;
      points.push([
        Number((p.lat + offset * 0.8).toFixed(6)),
        Number((p.lng - offset).toFixed(6)),
      ]);
    }
    return { distanceKm: Number(distanceKm.toFixed(2)), durationMin: Number(durationMin.toFixed(1)), geometry: points };
  }
}

/** OSRM-compatible provider (self-hosted or compatible routing server). */
export class OsrmRoutingProvider implements RoutingProvider {
  readonly name = "osrm";
  constructor(private baseUrl: string) {}

  async route(from: LatLng, to: LatLng): Promise<RouteResult> {
    const url = `${this.baseUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`OSRM responded ${res.status}`);
      const data = (await res.json()) as {
        code?: string;
        routes?: Array<{ distance: number; duration: number; geometry: { coordinates: [number, number][] } }>;
      };
      if (data.code !== "Ok" || !data.routes?.length) throw new Error("OSRM: no route");
      const best = data.routes[0];
      return {
        distanceKm: Number((best.distance / 1000).toFixed(2)),
        durationMin: Number((best.duration / 60).toFixed(1)),
        geometry: best.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

const mock = new MockRoutingProvider();

/** Resolves the configured provider with automatic mock fallback. */
export function getRoutingProvider(): RoutingProvider {
  if (config.routing.osrmBaseUrl) {
    const osrm = new OsrmRoutingProvider(config.routing.osrmBaseUrl);
    return {
      name: "osrm",
      async route(from, to) {
        try {
          return await osrm.route(from, to);
        } catch (err) {
          console.warn("[routing] OSRM unavailable, falling back to mock provider:", (err as Error).message);
          return mock.route(from, to);
        }
      },
    };
  }
  return mock;
}
