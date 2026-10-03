import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { driverLocations, driverProfiles, payments, rides, users, vehicles } from "@/db/schema";
import { iso } from "./dto";
import { ACTIVE_RIDE_STATUSES, type AdminDriverRow, type AdminPaymentRow, type AdminRideRow, type AdminRiderRow, type DashboardDto, type RideStatus } from "./types";

const RIDE_STATUSES: RideStatus[] = [
  "REQUESTED",
  "SEARCHING",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "DRIVER_ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export async function fetchAdminRides(opts: { search?: string; status?: string; limit?: number }): Promise<AdminRideRow[]> {
  const rider = alias(users, "rider");
  const driver = alias(users, "driver");
  const conditions = [];
  if (opts.status && RIDE_STATUSES.includes(opts.status as RideStatus)) {
    conditions.push(eq(rides.status, opts.status as RideStatus));
  }
  if (opts.search) {
    const s = `%${opts.search}%`;
    conditions.push(
      or(
        ilike(rides.pickupAddress, s),
        ilike(rides.destAddress, s),
        ilike(rider.name, s),
        ilike(driver.name, s),
      ),
    );
  }

  const rows = await db
    .select({
      id: rides.id,
      status: rides.status,
      pickupAddress: rides.pickupAddress,
      destAddress: rides.destAddress,
      estFare: rides.estFare,
      finalFare: rides.finalFare,
      requestedAt: rides.requestedAt,
      riderName: rider.name,
      driverName: driver.name,
      paymentStatus: payments.status,
    })
    .from(rides)
    .leftJoin(rider, eq(rides.riderId, rider.id))
    .leftJoin(driver, eq(rides.driverId, driver.id))
    .leftJoin(payments, eq(payments.rideId, rides.id))
    .where(and(...conditions))
    .orderBy(desc(rides.requestedAt))
    .limit(opts.limit ?? 50);

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    riderName: r.riderName ?? "—",
    driverName: r.driverName,
    pickupAddress: r.pickupAddress,
    destinationAddress: r.destAddress,
    estFare: r.estFare,
    finalFare: r.finalFare,
    requestedAt: iso(r.requestedAt) ?? "",
    paymentStatus: r.paymentStatus,
  }));
}

export async function fetchAdminDrivers(search?: string): Promise<AdminDriverRow[]> {
  const conditions = [];
  if (search) {
    const s = `%${search}%`;
    conditions.push(or(ilike(users.name, s), ilike(users.email, s), ilike(vehicles.registration, s)));
  }
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isOnline: driverProfiles.isOnline,
      verificationStatus: driverProfiles.verificationStatus,
      rating: driverProfiles.rating,
      totalTrips: driverProfiles.totalTrips,
      totalEarnings: driverProfiles.totalEarnings,
      make: vehicles.make,
      model: vehicles.model,
      registration: vehicles.registration,
    })
    .from(users)
    .innerJoin(driverProfiles, eq(driverProfiles.userId, users.id))
    .leftJoin(vehicles, eq(vehicles.driverId, driverProfiles.id))
    .where(and(...conditions))
    .orderBy(desc(driverProfiles.isOnline))
    .limit(100);

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    phone: r.phone,
    isOnline: r.isOnline,
    verificationStatus: r.verificationStatus,
    rating: r.rating,
    totalTrips: r.totalTrips,
    totalEarnings: r.totalEarnings,
    vehicle: r.make ? `${r.make} ${r.model ?? ""}`.trim() : null,
    registration: r.registration,
  }));
}

export async function fetchAdminRiders(search?: string): Promise<AdminRiderRow[]> {
  const conditions: Array<SQL<unknown> | undefined> = [eq(users.role, "RIDER" as const)];
  if (search) {
    const s = `%${search}%`;
    conditions.push(or(ilike(users.name, s), ilike(users.email, s), ilike(users.phone, s)));
  }
  const rows = await db
    .select()
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(100);

  const counts = await db
    .select({ riderId: rides.riderId, count: sql<number>`count(*)::int` })
    .from(rides)
    .groupBy(rides.riderId);
  const countByRider = new Map(counts.map((c) => [c.riderId, c.count]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    createdAt: iso(r.createdAt) ?? "",
    totalRides: countByRider.get(r.id) ?? 0,
  }));
}

export async function fetchAdminPayments(search?: string): Promise<AdminPaymentRow[]> {
  const rider = alias(users, "rider");
  const conditions = [];
  if (search) {
    const s = `%${search}%`;
    conditions.push(or(ilike(payments.providerRef, s), ilike(rider.name, s)));
  }
  const rows = await db
    .select({
      id: payments.id,
      rideId: payments.rideId,
      amount: payments.amount,
      status: payments.status,
      method: payments.method,
      provider: payments.provider,
      providerRef: payments.providerRef,
      createdAt: payments.createdAt,
      riderName: rider.name,
    })
    .from(payments)
    .innerJoin(rides, eq(rides.id, payments.rideId))
    .leftJoin(rider, eq(rides.riderId, rider.id))
    .where(and(...conditions))
    .orderBy(desc(payments.createdAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    rideId: r.rideId,
    riderName: r.riderName ?? "—",
    amount: r.amount,
    status: r.status,
    method: r.method,
    provider: r.provider,
    providerRef: r.providerRef,
    createdAt: iso(r.createdAt) ?? "",
  }));
}

export async function fetchDashboard(): Promise<DashboardDto> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [ridersRow] = await db.select({ v: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "RIDER"));
  const [driversRow] = await db.select({ v: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "DRIVER"));
  const [onlineRow] = await db.select({ v: sql<number>`count(*)::int` }).from(driverProfiles).where(eq(driverProfiles.isOnline, true));
  const [activeRow] = await db.select({ v: sql<number>`count(*)::int` }).from(rides).where(inArray(rides.status, ACTIVE_RIDE_STATUSES));
  const [searchingRow] = await db.select({ v: sql<number>`count(*)::int` }).from(rides).where(eq(rides.status, "SEARCHING"));
  const [completedTodayRow] = await db
    .select({ v: sql<number>`count(*)::int` })
    .from(rides)
    .where(and(eq(rides.status, "COMPLETED"), sql`${rides.completedAt} >= ${startOfToday}`));
  const [completedTotalRow] = await db.select({ v: sql<number>`count(*)::int` }).from(rides).where(eq(rides.status, "COMPLETED"));
  const [cancelledRow] = await db.select({ v: sql<number>`count(*)::int` }).from(rides).where(eq(rides.status, "CANCELLED"));
  const [revenueRow] = await db
    .select({ v: sql<number>`coalesce(sum(${rides.finalFare}), 0)::float8` })
    .from(rides)
    .where(eq(rides.status, "COMPLETED"));

  // Live rides with positions for the ops map.
  const riderAlias = alias(users, "rider");
  const driverAlias = alias(users, "driver");
  const activeRides = await db
    .select({
      id: rides.id,
      status: rides.status,
      pickupLat: rides.pickupLat,
      pickupLng: rides.pickupLng,
      destLat: rides.destLat,
      destLng: rides.destLng,
      driverId: rides.driverId,
      riderName: riderAlias.name,
      driverName: driverAlias.name,
    })
    .from(rides)
    .leftJoin(riderAlias, eq(rides.riderId, riderAlias.id))
    .leftJoin(driverAlias, eq(rides.driverId, driverAlias.id))
    .where(inArray(rides.status, ACTIVE_RIDE_STATUSES))
    .orderBy(desc(rides.requestedAt))
    .limit(50);

  const assignedDriverIds = activeRides.map((r) => r.driverId).filter((d): d is string => Boolean(d));
  let locByDriver = new Map<string, { lat: number; lng: number }>();
  if (assignedDriverIds.length > 0) {
    const locs = await db
      .select({ userId: driverProfiles.userId, lat: driverLocations.lat, lng: driverLocations.lng })
      .from(driverLocations)
      .innerJoin(driverProfiles, eq(driverLocations.driverId, driverProfiles.id))
      .where(inArray(driverProfiles.userId, assignedDriverIds));
    locByDriver = new Map(locs.map((l) => [l.userId, { lat: l.lat, lng: l.lng }]));
  }

  const onlineDrivers = await db
    .select({ userId: driverProfiles.userId, name: users.name, lat: driverLocations.lat, lng: driverLocations.lng })
    .from(driverProfiles)
    .innerJoin(users, eq(driverProfiles.userId, users.id))
    .innerJoin(driverLocations, eq(driverLocations.driverId, driverProfiles.id))
    .where(eq(driverProfiles.isOnline, true))
    .limit(100);

  return {
    totals: {
      riders: ridersRow?.v ?? 0,
      drivers: driversRow?.v ?? 0,
      onlineDrivers: onlineRow?.v ?? 0,
      activeRides: activeRow?.v ?? 0,
      searchingRides: searchingRow?.v ?? 0,
      completedToday: completedTodayRow?.v ?? 0,
      completedTotal: completedTotalRow?.v ?? 0,
      cancelledTotal: cancelledRow?.v ?? 0,
      revenueTotal: Math.round(revenueRow?.v ?? 0),
    },
    liveRides: activeRides.map((r) => ({
      id: r.id,
      status: r.status,
      pickup: { lat: r.pickupLat, lng: r.pickupLng },
      destination: { lat: r.destLat, lng: r.destLng },
      driverLocation: r.driverId ? (locByDriver.get(r.driverId) ?? null) : null,
      riderName: r.riderName ?? "—",
      driverName: r.driverName,
    })),
    onlineDriverLocations: onlineDrivers.map((d) => ({ userId: d.userId, name: d.name, lat: d.lat, lng: d.lng })),
    recentRides: await fetchAdminRides({ limit: 8 }),
    system: {
      db: "ok",
      routingProvider: process.env.OSRM_BASE_URL ? "osrm" : "mock",
      uptimeSec: Math.round(process.uptime()),
      time: new Date().toISOString(),
    },
  };
}
