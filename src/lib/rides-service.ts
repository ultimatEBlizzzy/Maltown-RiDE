import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  driverLocations,
  driverProfiles,
  payments,
  payments as paymentsTable,
  ratings,
  rideStatusHistory,
  rides,
  users,
  vehicles,
  type Ride,
  type User,
} from "@/db/schema";
import { config } from "./config";
import { iso, toDriverInfoDto } from "./dto";
import { driverPayout, estimateFare } from "./fare";
import { ApiError } from "./http";
import { findNearbyDrivers, type CandidateDriver } from "./matching";
import { notifyUser } from "./notify";
import { getPaymentProvider } from "./payments";
import { publishToAdmin, publishToRide } from "./realtime";
import { assertTransition, CANCELLABLE_STATUSES } from "./ride-machine";
import { getRoutingProvider } from "./routing";
import {
  ACTIVE_RIDE_STATUSES,
  formatZAR,
  type FareBreakdown,
  type RideDto,
  type RideStatus,
  type VehicleClassId,
} from "./types";
import type { RideRequestInput } from "./validation";

/* ------------------------------ helpers ---------------------------------- */

async function addHistory(
  rideId: string,
  status: RideStatus,
  actorRole: string,
  note?: string,
): Promise<void> {
  await db.insert(rideStatusHistory).values({ rideId, status, actorRole, note });
}

export async function getActiveRideFor(userId: string, role: "RIDER" | "DRIVER"): Promise<Ride | null> {
  const column = role === "RIDER" ? rides.riderId : rides.driverId;
  const [ride] = await db
    .select()
    .from(rides)
    .where(and(eq(column, userId), inArray(rides.status, ACTIVE_RIDE_STATUSES)))
    .orderBy(desc(rides.requestedAt))
    .limit(1);
  return ride ?? null;
}

export async function buildRideDto(ride: Ride): Promise<RideDto> {
  let driver: RideDto["driver"] = null;
  let driverLocation: RideDto["driverLocation"] = null;

  if (ride.driverId) {
    const [driverUser] = await db.select().from(users).where(eq(users.id, ride.driverId)).limit(1);
    if (driverUser) {
      const [profile] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, driverUser.id))
        .limit(1);
      if (profile) {
        const [vehicle] = await db
          .select()
          .from(vehicles)
          .where(eq(vehicles.driverId, profile.id))
          .limit(1);
        const [loc] = await db
          .select()
          .from(driverLocations)
          .where(eq(driverLocations.driverId, profile.id))
          .limit(1);
        driver = toDriverInfoDto(driverUser, profile, vehicle);
        if (loc) driverLocation = { lat: loc.lat, lng: loc.lng, updatedAt: iso(loc.updatedAt) ?? "" };
      }
    }
  }

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.rideId, ride.id)).limit(1);
  const [rating] = await db.select().from(ratings).where(eq(ratings.rideId, ride.id)).limit(1);

  return {
    id: ride.id,
    status: ride.status,
    pickup: { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress },
    destination: { lat: ride.destLat, lng: ride.destLng, address: ride.destAddress },
    vehiclePref: ride.vehiclePref as VehicleClassId,
    distanceKm: ride.distanceKm,
    durationMin: ride.durationMin,
    estFare: ride.estFare,
    finalFare: ride.finalFare,
    requestedAt: iso(ride.requestedAt) ?? "",
    acceptedAt: iso(ride.acceptedAt),
    startedAt: iso(ride.startedAt),
    completedAt: iso(ride.completedAt),
    cancelledAt: iso(ride.cancelledAt),
    cancelledByRole: ride.cancelledByRole,
    driver,
    driverLocation,
    routeLine: ride.routeLine,
    payment: payment
      ? {
          id: payment.id,
          rideId: payment.rideId,
          amount: payment.amount,
          status: payment.status,
          method: payment.method,
          provider: payment.provider,
          providerRef: payment.providerRef,
          createdAt: iso(payment.createdAt) ?? "",
        }
      : null,
    rating: rating ? { score: rating.score, comment: rating.comment } : null,
  };
}

async function loadRide(rideId: string): Promise<Ride> {
  const [ride] = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
  if (!ride) throw new ApiError(404, "Ride not found", "NOT_FOUND");
  return ride;
}

/* --------------------------- ride creation -------------------------------- */

export interface CreateRideResult {
  ride: Ride;
  fare: FareBreakdown;
  candidates: CandidateDriver[];
  routingProvider: string;
}

export async function createRideRequest(rider: User, input: RideRequestInput): Promise<CreateRideResult> {
  const existing = await getActiveRideFor(rider.id, "RIDER");
  if (existing) throw new ApiError(409, "You already have an active ride request", "ACTIVE_RIDE");

  const provider = getRoutingProvider();
  const route = await provider.route(
    { lat: input.pickup.lat, lng: input.pickup.lng },
    { lat: input.destination.lat, lng: input.destination.lng },
  );
  const fare = estimateFare(route.distanceKm, route.durationMin, input.vehiclePref);

  const [ride] = await db
    .insert(rides)
    .values({
      riderId: rider.id,
      pickupLat: input.pickup.lat,
      pickupLng: input.pickup.lng,
      pickupAddress: input.pickup.address,
      destLat: input.destination.lat,
      destLng: input.destination.lng,
      destAddress: input.destination.address,
      vehiclePref: input.vehiclePref,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      estFare: fare.total,
      status: "REQUESTED",
      routeLine: route.geometry,
    })
    .returning();
  await addHistory(ride.id, "REQUESTED", "RIDER", "Ride created");

  const [searching] = await db
    .update(rides)
    .set({ status: "SEARCHING" })
    .where(and(eq(rides.id, ride.id), eq(rides.status, "REQUESTED")))
    .returning();
  await addHistory(ride.id, "SEARCHING", "SYSTEM", "Matching nearby drivers");

  // Driver matching: rank nearby online drivers and notify them.
  const candidates = await findNearbyDrivers({
    lat: input.pickup.lat,
    lng: input.pickup.lng,
    radiusKm: config.matching.radiusKm,
    vehiclePref: input.vehiclePref,
  });
  await Promise.all(
    candidates.map((c) =>
      notifyUser(
        c.userId,
        "RIDE_REQUEST",
        "New ride request",
        `${input.pickup.address} → ${input.destination.address} • ${formatZAR(fare.total)}`,
        { rideId: ride.id },
      ),
    ),
  );

  publishToAdmin("ride_created", {
    rideId: ride.id,
    pickup: { lat: input.pickup.lat, lng: input.pickup.lng },
    destination: { lat: input.destination.lat, lng: input.destination.lng },
  });
  publishToRide(ride.id, "ride_status", { status: "SEARCHING" });

  return { ride: searching, fare, candidates, routingProvider: provider.name };
}

/* ---------------------------- ride queries -------------------------------- */

export async function listRidesForUser(
  user: User,
  scope: "active" | "history" | "all",
  limit = 30,
): Promise<RideDto[]> {
  const column = user.role === "DRIVER" ? rides.driverId : rides.riderId;
  const statuses =
    scope === "active" ? ACTIVE_RIDE_STATUSES : scope === "history" ? (["COMPLETED", "CANCELLED"] as RideStatus[]) : undefined;
  const rows = await db
    .select()
    .from(rides)
    .where(and(eq(column, user.id), statuses ? inArray(rides.status, statuses) : undefined))
    .orderBy(desc(rides.requestedAt))
    .limit(limit);
  return Promise.all(rows.map(buildRideDto));
}

export async function getRideDtoForUser(user: User, rideId: string): Promise<RideDto> {
  const ride = await loadRide(rideId);
  const isRider = ride.riderId === user.id;
  const isDriver = ride.driverId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isRider && !isDriver && !isAdmin) throw new ApiError(403, "You cannot access this ride", "FORBIDDEN");
  return buildRideDto(ride);
}

/* --------------------------- driver acceptance ---------------------------- */

export async function acceptRide(driver: User, rideId: string): Promise<RideDto> {
  const [profile] = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, driver.id))
    .limit(1);
  if (!profile) throw new ApiError(404, "Driver profile not found", "NOT_FOUND");
  if (profile.verificationStatus !== "VERIFIED") {
    throw new ApiError(403, "Driver account is not verified", "NOT_VERIFIED");
  }
  const busy = await getActiveRideFor(driver.id, "DRIVER");
  if (busy) throw new ApiError(409, "Finish your current ride before accepting another", "BUSY");

  const ride = await loadRide(rideId);
  if (ride.status !== "SEARCHING") {
    throw new ApiError(409, "This ride is no longer available", "RIDE_TAKEN");
  }

  // Atomic lock — guarantees exactly one driver can win a ride.
  const locked = await db
    .update(rides)
    .set({ status: "ACCEPTED", driverId: driver.id, acceptedAt: new Date() })
    .where(and(eq(rides.id, rideId), eq(rides.status, "SEARCHING"), isNull(rides.driverId)))
    .returning();
  if (locked.length === 0) {
    throw new ApiError(409, "Another driver accepted this ride first", "RIDE_TAKEN");
  }
  await addHistory(rideId, "ACCEPTED", "DRIVER", `${driver.name} accepted the ride`);

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, profile.id)).limit(1);
  const vehicleDesc = vehicle ? `${vehicle.color} ${vehicle.make} ${vehicle.model} (${vehicle.registration})` : "their vehicle";

  // Immediately move to DRIVER_ARRIVING — driver is heading to pickup.
  const [arriving] = await db
    .update(rides)
    .set({ status: "DRIVER_ARRIVING" })
    .where(and(eq(rides.id, rideId), eq(rides.status, "ACCEPTED")))
    .returning();
  await addHistory(rideId, "DRIVER_ARRIVING", "SYSTEM", "Driver heading to pickup");

  await notifyUser(ride.riderId, "DRIVER_FOUND", "Driver found", `${driver.name} is on the way in ${vehicleDesc}`, { rideId });
  publishToRide(rideId, "ride_status", { status: "DRIVER_ARRIVING", driverName: driver.name });
  publishToAdmin("ride_accepted", { rideId, driverId: driver.id });

  return buildRideDto(arriving);
}

export async function declineRide(driver: User, rideId: string): Promise<void> {
  const ride = await loadRide(rideId);
  if (ride.status !== "SEARCHING") return;
  await addHistory(rideId, "SEARCHING", "DRIVER", `${driver.name} declined`);
}

/* ------------------------- lifecycle transitions -------------------------- */

const DRIVER_STEP_FIELDS: Partial<Record<RideStatus, Partial<typeof rides.$inferInsert>>> = {
  DRIVER_ARRIVED: {},
  IN_PROGRESS: { startedAt: new Date() },
};

export async function transitionByDriver(
  driver: User,
  rideId: string,
  to: "DRIVER_ARRIVED" | "IN_PROGRESS",
): Promise<RideDto> {
  const ride = await loadRide(rideId);
  if (ride.driverId !== driver.id) throw new ApiError(403, "You are not assigned to this ride", "FORBIDDEN");
  assertTransition(ride.status, to);

  const [updated] = await db
    .update(rides)
    .set({ status: to, ...(DRIVER_STEP_FIELDS[to] ?? {}) })
    .where(and(eq(rides.id, rideId), eq(rides.status, ride.status)))
    .returning();
  await addHistory(
    rideId,
    to,
    "DRIVER",
    to === "DRIVER_ARRIVED" ? "Driver arrived at pickup" : "Trip started",
  );

  if (to === "DRIVER_ARRIVED") {
    await notifyUser(ride.riderId, "DRIVER_ARRIVED", "Driver arrived", "Your driver is waiting at the pickup point", { rideId });
  } else {
    await notifyUser(ride.riderId, "TRIP_STARTED", "Trip started", "Enjoy your ride — live tracking is on", { rideId });
  }
  publishToRide(rideId, "ride_status", { status: to });
  publishToAdmin("ride_progress", { rideId, status: to });
  return buildRideDto(updated);
}

export async function completeRide(driver: User, rideId: string): Promise<RideDto> {
  const ride = await loadRide(rideId);
  if (ride.driverId !== driver.id) throw new ApiError(403, "You are not assigned to this ride", "FORBIDDEN");
  assertTransition(ride.status, "COMPLETED");

  const finalFare = ride.estFare;
  const charge = await getPaymentProvider().charge({
    rideId,
    amount: finalFare,
    currency: config.fare.currency,
    method: "CASH",
  });
  const payout = driverPayout(finalFare);

  const [profile] = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, driver.id))
    .limit(1);

  await db.transaction(async (tx) => {
    const done = await tx
      .update(rides)
      .set({ status: "COMPLETED", finalFare, completedAt: new Date() })
      .where(and(eq(rides.id, rideId), eq(rides.status, "IN_PROGRESS")))
      .returning();
    if (done.length === 0) throw new ApiError(409, "Ride is no longer in progress", "CONFLICT");

    await tx.insert(rideStatusHistory).values({
      rideId,
      status: "COMPLETED",
      actorRole: "DRIVER",
      note: `Trip completed — ${formatZAR(finalFare)}`,
    });
    await tx.insert(payments).values({
      rideId,
      provider: charge.provider,
      method: "CASH",
      amount: finalFare,
      status: charge.status,
      providerRef: charge.providerRef,
    });
    if (profile) {
      await tx
        .update(driverProfiles)
        .set({
          totalTrips: sql`${driverProfiles.totalTrips} + 1`,
          totalEarnings: sql`${driverProfiles.totalEarnings} + ${payout}`,
        })
        .where(eq(driverProfiles.id, profile.id));
    }
  });

  await notifyUser(
    ride.riderId,
    "TRIP_COMPLETED",
    "Trip completed",
    `You arrived! Fare: ${formatZAR(finalFare)} • Payment ${charge.status.toLowerCase()}`,
    { rideId },
  );
  await notifyUser(
    ride.riderId,
    charge.status === "SUCCESS" ? "PAYMENT_SUCCESS" : "PAYMENT_FAILED",
    charge.status === "SUCCESS" ? "Payment received" : "Payment issue",
    charge.status === "SUCCESS"
      ? `${formatZAR(finalFare)} settled via ${charge.provider}`
      : "Please contact support about your payment",
    { rideId },
  );
  publishToRide(rideId, "ride_status", { status: "COMPLETED", finalFare });
  publishToAdmin("ride_completed", { rideId, finalFare });

  return buildRideDto({ ...ride, status: "COMPLETED", finalFare });
}

/* ------------------------------ cancellation ------------------------------ */

export async function cancelRide(user: User, rideId: string, reason?: string): Promise<RideDto> {
  const ride = await loadRide(rideId);
  const isRider = ride.riderId === user.id;
  const isAssignedDriver = ride.driverId === user.id;
  if (!isRider && !isAssignedDriver) throw new ApiError(403, "You cannot cancel this ride", "FORBIDDEN");
  if (!CANCELLABLE_STATUSES.includes(ride.status)) {
    throw new ApiError(409, "This ride can no longer be cancelled", "CONFLICT");
  }

  const cancelledByRole = isRider ? "RIDER" : "DRIVER";
  const [updated] = await db
    .update(rides)
    .set({
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledByRole,
      cancelReason: reason || `${cancelledByRole.toLowerCase()} cancelled`,
    })
    .where(and(eq(rides.id, rideId), inArray(rides.status, CANCELLABLE_STATUSES)))
    .returning();
  if (!updated) throw new ApiError(409, "This ride can no longer be cancelled", "CONFLICT");
  await addHistory(rideId, "CANCELLED", cancelledByRole, reason || undefined);

  if (isRider && ride.driverId) {
    await notifyUser(ride.driverId, "RIDE_CANCELLED", "Ride cancelled", "The rider cancelled this request", { rideId });
  }
  if (!isRider) {
    await notifyUser(ride.riderId, "RIDE_CANCELLED", "Ride cancelled", "Your driver had to cancel — request a new ride", { rideId });
  }
  publishToRide(rideId, "ride_status", { status: "CANCELLED" });
  publishToAdmin("ride_cancelled", { rideId, by: cancelledByRole });

  return buildRideDto(updated);
}

/* --------------------------------- rating --------------------------------- */

export async function rateRide(rider: User, rideId: string, score: number, comment?: string): Promise<void> {
  const ride = await loadRide(rideId);
  if (ride.riderId !== rider.id) throw new ApiError(403, "You can only rate your own rides", "FORBIDDEN");
  if (ride.status !== "COMPLETED") throw new ApiError(409, "Only completed rides can be rated", "CONFLICT");
  if (!ride.driverId) throw new ApiError(409, "This ride has no driver", "CONFLICT");

  const [existing] = await db.select().from(ratings).where(eq(ratings.rideId, rideId)).limit(1);
  if (existing) throw new ApiError(409, "You already rated this ride", "CONFLICT");

  await db.insert(ratings).values({ rideId, riderId: rider.id, driverId: ride.driverId, score, comment });

  const [avg] = await db
    .select({ value: sql<number>`avg(${ratings.score})` })
    .from(ratings)
    .where(eq(ratings.driverId, ride.driverId));
  const rating = Math.round(Number(avg?.value ?? score) * 100) / 100;
  await db
    .update(driverProfiles)
    .set({ rating })
    .where(eq(driverProfiles.userId, ride.driverId));

  await notifyUser(ride.driverId, "NEW_RATING", "New rating received", `You received ${score}/5 stars`, { rideId });
}
