/**
 * Central, environment-driven configuration for MALTown RiDE.
 * Nothing secret is ever exposed to the client bundle — this module is
 * imported only from server code (route handlers / lib services).
 */
import { MARKET_CENTER } from "./market";

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",

  auth: {
    jwtSecret: process.env.JWT_SECRET || "maltown-dev-insecure-secret-change-me",
    jwtIssuer: "maltown-ride",
    sessionDays: 7,
    cookieName: "maltown.session",
  },

  /** Fare engine rates (South African rand). Backend is authoritative. */
  fare: {
    currency: "ZAR",
    base: num("FARE_BASE", 15),
    perKm: num("FARE_PER_KM", 6),
    perMin: num("FARE_PER_MIN", 0.8),
    bookingFee: num("FARE_BOOKING_FEE", 5),
    minFare: num("FARE_MIN", 25),
  },

  /** Driver matching — radius configurable, never hard-coded elsewhere. */
  matching: {
    radiusKm: num("MATCH_RADIUS_KM", 15),
    maxCandidates: Math.max(1, Math.round(num("MATCH_MAX_CANDIDATES", 10))),
    requestTtlSec: num("MATCH_REQUEST_TTL_SEC", 45),
    avgSpeedKmh: num("DRIVER_AVG_SPEED_KMH", 26),
  },

  routing: {
    osrmBaseUrl: (process.env.OSRM_BASE_URL || "").replace(/\/$/, ""),
    roadFactor: num("ROUTING_ROAD_FACTOR", 1.3),
  },

  /** Share of each completed fare paid out to the driver. */
  driverShare: Math.min(1, Math.max(0, num("DRIVER_SHARE", 0.8))),

  maps: {
    tileUrl:
      process.env.MAP_TILE_URL ||
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      process.env.MAP_ATTRIBUTION ||
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },

  /** Development epicenter: Malamulele, South Africa. Seed/demo data only. */
  devCenter: { lat: MARKET_CENTER.lat, lng: MARKET_CENTER.lng },
} as const;

export type AppConfig = typeof config;
