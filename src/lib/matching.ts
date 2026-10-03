import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { driverLocations, driverProfiles, rides, users, vehicles } from "@/db/schema";
import { config } from "./config";
import { toVehicleDto } from "./dto";
import { boundingBox, haversineKm } from "./geo";
import { ACTIVE_RIDE_STATUSES, vehicleClassOf, type LatLng, type VehicleClassId, type VehicleDto } from "./types";

export interface CandidateDriver {
  userId: string;
  profileId: string;
  name: string;
  phone: string;
  rating: number;
  distanceKm: number;
  etaMin: number;
  lat: number;
  lng: number;
  vehicle?: VehicleDto;
}

export interface NearbyOptions {
  lat: number;
  lng: number;
  radiusKm?: number;
  vehiclePref?: VehicleClassId;
}

/**
 * Driver matching: online + verified drivers without an active ride,
 * within the configured radius, ranked by distance. Vehicle class
 * preference filters candidates when matches exist.
 */
export async function findNearbyDrivers(opts: NearbyOptions): Promise<CandidateDriver[]> {
  const radiusKm = opts.radiusKm ?? config.matching.radiusKm;
  const origin: LatLng = { lat: opts.lat, lng: opts.lng };

  const rows = await db
    .select({ profile: driverProfiles, user: users, location: driverLocations })
    .from(driverProfiles)
    .innerJoin(users, eq(driverProfiles.userId, users.id))
    .innerJoin(driverLocations, eq(driverLocations.driverId, driverProfiles.id))
    .where(and(eq(driverProfiles.isOnline, true), eq(driverProfiles.verificationStatus, "VERIFIED")));

  if (rows.length === 0) return [];

  // Exclude drivers already committed to an active ride.
  const driverUserIds = rows.map((r) => r.user.id);
  const busyRows = await db
    .select({ driverId: rides.driverId })
    .from(rides)
    .where(and(inArray(rides.driverId, driverUserIds), inArray(rides.status, ACTIVE_RIDE_STATUSES)));
  const busy = new Set(busyRows.map((r) => r.driverId).filter(Boolean));

  const vehicleRows = await db
    .select()
    .from(vehicles)
    .where(inArray(vehicles.driverId, rows.map((r) => r.profile.id)));
  const vehicleByProfile = new Map(vehicleRows.map((v) => [v.driverId, v]));

  const box = boundingBox(origin, radiusKm);
  let candidates: CandidateDriver[] = [];

  for (const row of rows) {
    if (busy.has(row.user.id)) continue;
    const { lat, lng } = row.location;
    if (lat < box.minLat || lat > box.maxLat || lng < box.minLng || lng > box.maxLng) continue;
    const distanceKm = haversineKm(origin, { lat, lng });
    if (distanceKm > radiusKm) continue;
    const vehicle = vehicleByProfile.get(row.profile.id);
    candidates.push({
      userId: row.user.id,
      profileId: row.profile.id,
      name: row.user.name,
      phone: row.user.phone,
      rating: row.profile.rating,
      distanceKm: Number(distanceKm.toFixed(2)),
      etaMin: Math.max(1, Math.round((distanceKm / config.matching.avgSpeedKmh) * 60)),
      lat,
      lng,
      vehicle: vehicle ? toVehicleDto(vehicle) : undefined,
    });
  }

  if (opts.vehiclePref && opts.vehiclePref !== "STANDARD") {
    const filtered = candidates.filter(
      (c) => c.vehicle && vehicleClassOf(c.vehicle.vehicleType) === opts.vehiclePref,
    );
    if (filtered.length > 0) candidates = filtered;
  }

  candidates.sort((a, b) => a.distanceKm - b.distanceKm);
  return candidates.slice(0, config.matching.maxCandidates);
}
