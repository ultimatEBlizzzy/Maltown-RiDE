import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  driverLocations,
  driverProfiles,
  rides,
  users,
  vehicles,
  type DriverProfile,
  type User,
  type Vehicle,
} from "@/db/schema";
import { config } from "./config";
import { iso, toUserDto, toVehicleDto } from "./dto";
import { driverPayout } from "./fare";
import { haversineKm } from "./geo";
import { ApiError } from "./http";
import { locationCache } from "./location-cache";
import { getActiveRideFor } from "./rides-service";
import { publishToAdmin, publishToRide } from "./realtime";
import type { EarningsDto, UserDto, VehicleDto } from "./types";

export interface DriverBundle {
  user: UserDto;
  profile: DriverProfile;
  vehicle: VehicleDto | null;
}

export async function getDriverBundle(userId: string): Promise<DriverBundle> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.role !== "DRIVER") throw new ApiError(404, "Driver account not found", "NOT_FOUND");
  const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId)).limit(1);
  if (!profile) throw new ApiError(404, "Driver profile not found", "NOT_FOUND");
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, profile.id)).limit(1);
  return { user: toUserDto(user), profile, vehicle: vehicle ? toVehicleDto(vehicle) : null };
}

async function upsertLocation(profileId: string, userId: string, lat: number, lng: number, heading?: number): Promise<void> {
  await db
    .insert(driverLocations)
    .values({ driverId: profileId, lat, lng, heading })
    .onConflictDoUpdate({
      target: driverLocations.driverId,
      set: { lat, lng, heading, updatedAt: new Date() },
    });
  locationCache.set(userId, { lat, lng, heading, updatedAt: Date.now() });
}

export async function goOnline(user: User, lat: number, lng: number): Promise<void> {
  const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, user.id)).limit(1);
  if (!profile) throw new ApiError(404, "Driver profile not found", "NOT_FOUND");
  await db.update(driverProfiles).set({ isOnline: true }).where(eq(driverProfiles.id, profile.id));
  await upsertLocation(profile.id, user.id, lat, lng);
  publishToAdmin("driver_online", { userId: user.id, lat, lng });
}

export async function goOffline(user: User): Promise<void> {
  const active = await getActiveRideFor(user.id, "DRIVER");
  if (active) throw new ApiError(409, "You cannot go offline during an active ride", "ACTIVE_RIDE");
  await db.update(driverProfiles).set({ isOnline: false }).where(eq(driverProfiles.userId, user.id));
  publishToAdmin("driver_offline", { userId: user.id });
}

export async function updateLocation(user: User, lat: number, lng: number, heading?: number): Promise<void> {
  const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, user.id)).limit(1);
  if (!profile) throw new ApiError(404, "Driver profile not found", "NOT_FOUND");
  await upsertLocation(profile.id, user.id, lat, lng, heading);

  // Fan out live position for the active ride (if any) + admin ops map.
  const active = await getActiveRideFor(user.id, "DRIVER");
  if (active) publishToRide(active.id, "driver_location", { lat, lng, heading });
  publishToAdmin("driver_location", { userId: user.id, lat, lng });
}

/* ----------------------------- driver requests ---------------------------- */

export interface DriverRequestDto {
  rideId: string;
  pickupAddress: string;
  destinationAddress: string;
  pickupLat: number;
  pickupLng: number;
  destLat: number;
  destLng: number;
  distanceToPickupKm: number;
  tripDistanceKm: number;
  estFare: number;
  riderName: string;
  vehiclePref: string;
  requestedAt: string;
  expiresAt: string;
}

export async function getDriverRequests(user: User): Promise<DriverRequestDto[]> {
  const bundle = await getDriverBundle(user.id);
  if (!bundle.profile.isOnline) return [];
  const busy = await getActiveRideFor(user.id, "DRIVER");
  if (busy) return [];

  const [loc] = await db
    .select()
    .from(driverLocations)
    .where(eq(driverLocations.driverId, bundle.profile.id))
    .limit(1);
  if (!loc) return [];

  const cutoff = new Date(Date.now() - config.matching.requestTtlSec * 1000 * 6);
  const open = await db
    .select()
    .from(rides)
    .where(and(eq(rides.status, "SEARCHING"), sql`${rides.requestedAt} >= ${cutoff}`))
    .orderBy(desc(rides.requestedAt))
    .limit(20);

  const maxDistance = config.matching.radiusKm * 1.5;
  const results: DriverRequestDto[] = [];
  for (const ride of open) {
    const distanceToPickupKm = haversineKm(
      { lat: loc.lat, lng: loc.lng },
      { lat: ride.pickupLat, lng: ride.pickupLng },
    );
    if (distanceToPickupKm > maxDistance) continue;
    const [rider] = await db.select().from(users).where(eq(users.id, ride.riderId)).limit(1);
    const expiresAt = new Date(ride.requestedAt.getTime() + config.matching.requestTtlSec * 1000);
    results.push({
      rideId: ride.id,
      pickupAddress: ride.pickupAddress,
      destinationAddress: ride.destAddress,
      pickupLat: ride.pickupLat,
      pickupLng: ride.pickupLng,
      destLat: ride.destLat,
      destLng: ride.destLng,
      distanceToPickupKm: Number(distanceToPickupKm.toFixed(1)),
      tripDistanceKm: ride.distanceKm,
      estFare: ride.estFare,
      riderName: rider ? rider.name.split(" ")[0] : "Rider",
      vehiclePref: ride.vehiclePref,
      requestedAt: iso(ride.requestedAt) ?? "",
      expiresAt: iso(expiresAt) ?? "",
    });
  }
  results.sort((a, b) => a.distanceToPickupKm - b.distanceToPickupKm);
  return results.slice(0, 3);
}

/* -------------------------------- earnings -------------------------------- */

export async function getEarnings(user: User): Promise<EarningsDto> {
  const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, user.id)).limit(1);
  if (!profile) throw new ApiError(404, "Driver profile not found", "NOT_FOUND");

  const completed = await db
    .select()
    .from(rides)
    .where(and(eq(rides.driverId, user.id), eq(rides.status, "COMPLETED")))
    .orderBy(desc(rides.completedAt))
    .limit(500);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let today = 0;
  let week = 0;
  for (const ride of completed) {
    const fare = ride.finalFare ?? ride.estFare;
    const when = ride.completedAt?.getTime() ?? 0;
    if (when >= startOfToday.getTime()) today += fare;
    if (when >= weekAgo.getTime()) week += fare;
  }

  return {
    today: driverPayout(today),
    week: driverPayout(week),
    total: profile.totalEarnings,
    completedTrips: profile.totalTrips,
    recent: completed.slice(0, 10).map((ride) => {
      const fare = ride.finalFare ?? ride.estFare;
      return {
        id: ride.id,
        completedAt: iso(ride.completedAt) ?? "",
        finalFare: fare,
        driverShare: driverPayout(fare),
        pickupAddress: ride.pickupAddress,
        destinationAddress: ride.destAddress,
      };
    }),
  };
}

export type { Vehicle };
