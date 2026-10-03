/**
 * Development seed data for MALTown RiDE.
 * All credentials below are DEVELOPMENT-ONLY. Never reuse in production.
 * Run: npx tsx src/db/seed.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  driverLocations,
  driverProfiles,
  payments,
  ratings,
  rideStatusHistory,
  riderProfiles,
  rides,
  users,
  vehicles,
} from "./schema";
import bcrypt from "bcryptjs";
import { MARKET_CENTER, MARKET_LANDMARKS } from "../lib/market";

const C = { lat: MARKET_CENTER.lat, lng: MARKET_CENTER.lng };
const XIGALO = MARKET_LANDMARKS[1];
const MHINGA = MARKET_LANDMARKS[2];

async function main() {
  const [existing] = await db.select().from(users).where(eq(users.email, "admin@maltown.dev")).limit(1);
  if (existing) {
    console.log("Seed already applied — skipping.");
    return;
  }

  const hash = async (p: string) => bcrypt.hash(p, 10);

  /* --------------------------------- users -------------------------------- */
  const [admin] = await db
    .insert(users)
    .values({ name: "Amara Banda", email: "admin@maltown.dev", phone: "+27820000001", passwordHash: await hash("Admin123!"), role: "ADMIN" })
    .returning();
  const [rider] = await db
    .insert(users)
    .values({ name: "Thoko Phiri", email: "rider@maltown.dev", phone: "+27820000002", passwordHash: await hash("Rider123!"), role: "RIDER" })
    .returning();
  const [rider2] = await db
    .insert(users)
    .values({ name: "Chisomo Mwale", email: "chisomo@maltown.dev", phone: "+27820000003", passwordHash: await hash("Rider123!"), role: "RIDER" })
    .returning();

  await db.insert(riderProfiles).values([{ userId: rider.id }, { userId: rider2.id }]);

  const driverSeeds = [
    { name: "Chimwemwe Kachale", email: "driver1@maltown.dev", phone: "+27820000101", license: "DL-88231", online: true, pos: { lat: C.lat + 0.006, lng: C.lng + 0.004 }, rating: 4.9, vehicle: { make: "Toyota", model: "Corolla", year: 2019, color: "Silver", registration: "LIM 234 L", vehicleType: "SEDAN" as const } },
    { name: "Dalitso Nkhoma", email: "driver2@maltown.dev", phone: "+27820000102", license: "DL-77120", online: true, pos: { lat: C.lat - 0.008, lng: C.lng + 0.007 }, rating: 4.75, vehicle: { make: "Toyota", model: "RAV4", year: 2021, color: "Midnight Blue", registration: "LIM 552 L", vehicleType: "SUV" as const } },
    { name: "Mabvuto Jere", email: "driver3@maltown.dev", phone: "+27820000103", license: "DL-65019", online: true, pos: { lat: C.lat + 0.01, lng: C.lng - 0.006 }, rating: 4.6, vehicle: { make: "Bajaj", model: "Boxer BM150", year: 2022, color: "Black", registration: "LIM 901 L", vehicleType: "MOTO" as const } },
    { name: "Zikomo Tembo", email: "driver4@maltown.dev", phone: "+27820000104", license: "DL-54408", online: false, pos: { lat: C.lat - 0.012, lng: C.lng - 0.009 }, rating: 4.8, vehicle: { make: "Hyundai", model: "Accent", year: 2018, color: "White", registration: "LIM 778 L", vehicleType: "SEDAN" as const } },
    { name: "Tamanda Nyirenda", email: "driver5@maltown.dev", phone: "+27820000105", license: "DL-43302", online: true, pos: { lat: C.lat + 0.003, lng: C.lng - 0.011 }, rating: 4.95, vehicle: { make: "Suzuki", model: "Swift", year: 2020, color: "Red", registration: "LIM 314 L", vehicleType: "HATCHBACK" as const } },
    { name: "Limbani Jere", email: "driver6@maltown.dev", phone: "+27820000106", license: "DL-32215", online: false, pos: { lat: C.lat - 0.005, lng: C.lng + 0.013 }, rating: 4.5, vehicle: { make: "Toyota", model: "Hiace", year: 2017, color: "Grey", registration: "LIM 606 L", vehicleType: "MINIBUS" as const } },
  ];

  const driverUsers: Array<{ userId: string; profileId: string; rating: number }> = [];
  for (const d of driverSeeds) {
    const [du] = await db
      .insert(users)
      .values({ name: d.name, email: d.email, phone: d.phone, passwordHash: await hash("Driver123!"), role: "DRIVER" })
      .returning();
    const [dp] = await db
      .insert(driverProfiles)
      .values({ userId: du.id, licenseNumber: d.license, verificationStatus: "VERIFIED", isOnline: d.online, rating: d.rating })
      .returning();
    await db.insert(vehicles).values({ driverId: dp.id, ...d.vehicle });
    await db.insert(driverLocations).values({ driverId: dp.id, lat: d.pos.lat, lng: d.pos.lng });
    driverUsers.push({ userId: du.id, profileId: dp.id, rating: d.rating });
  }

  /* ----------------------------- sample rides ----------------------------- */
  const daysAgo = (n: number, hour = 9) => {
    const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    d.setHours(hour, 15, 0, 0);
    return d;
  };

  interface SampleRide {
    riderId: string;
    driver: number; // index into driverUsers
    pickup: { lat: number; lng: number; address: string };
    dest: { lat: number; lng: number; address: string };
    distanceKm: number;
    durationMin: number;
    fare: number;
    status: "COMPLETED" | "CANCELLED";
    daysBack: number;
    rating?: number;
  }

  const sampleRides: SampleRide[] = [
    {
      riderId: rider.id, driver: 0,
      pickup: { lat: C.lat, lng: C.lng, address: "Malamulele town centre" },
      dest: { lat: XIGALO.lat, lng: XIGALO.lng, address: "Xigalo Village" },
      distanceKm: 10.1, durationMin: 23, fare: 99, status: "COMPLETED", daysBack: 6, rating: 5,
    },
    {
      riderId: rider.id, driver: 1,
      pickup: { lat: XIGALO.lat, lng: XIGALO.lng, address: "Xigalo Village" },
      dest: { lat: C.lat, lng: C.lng, address: "Malamulele town centre" },
      distanceKm: 10.1, durationMin: 23, fare: 99, status: "COMPLETED", daysBack: 3, rating: 4,
    },
    {
      riderId: rider2.id, driver: 0,
      pickup: { lat: C.lat, lng: C.lng, address: "Malamulele town centre" },
      dest: { lat: MHINGA.lat, lng: MHINGA.lng, address: "Ka-Mhinga Village" },
      distanceKm: 43.8, durationMin: 101, fare: 364, status: "COMPLETED", daysBack: 2, rating: 5,
    },
    {
      riderId: rider2.id, driver: 3,
      pickup: { lat: XIGALO.lat, lng: XIGALO.lng, address: "Xigalo Village" },
      dest: { lat: MHINGA.lat, lng: MHINGA.lng, address: "Ka-Mhinga Village" },
      distanceKm: 34.5, durationMin: 80, fare: 291, status: "CANCELLED", daysBack: 1,
    },
  ];

  const earningsByDriver = new Map<string, { total: number; trips: number }>();
  const ratingsByDriver = new Map<string, number[]>();

  for (const s of sampleRides) {
    const drv = driverUsers[s.driver];
    const requestedAt = daysAgo(s.daysBack);
    const completedAt = new Date(requestedAt.getTime() + s.durationMin * 60 * 1000);
    const [ride] = await db
      .insert(rides)
      .values({
        riderId: s.riderId,
        driverId: s.driver != null && s.status === "COMPLETED" ? drv.userId : s.status === "CANCELLED" ? drv.userId : null,
        pickupLat: s.pickup.lat,
        pickupLng: s.pickup.lng,
        pickupAddress: s.pickup.address,
        destLat: s.dest.lat,
        destLng: s.dest.lng,
        destAddress: s.dest.address,
        vehiclePref: "STANDARD",
        distanceKm: s.distanceKm,
        durationMin: s.durationMin,
        estFare: s.fare,
        finalFare: s.status === "COMPLETED" ? s.fare : null,
        status: s.status,
        requestedAt,
        acceptedAt: new Date(requestedAt.getTime() + 45 * 1000),
        startedAt: s.status === "COMPLETED" ? new Date(requestedAt.getTime() + 6 * 60 * 1000) : null,
        completedAt: s.status === "COMPLETED" ? completedAt : null,
        cancelledAt: s.status === "CANCELLED" ? new Date(requestedAt.getTime() + 90 * 1000) : null,
        cancelledByRole: s.status === "CANCELLED" ? "RIDER" : null,
      })
      .returning();

    await db.insert(rideStatusHistory).values([
      { rideId: ride.id, status: "REQUESTED", actorRole: "RIDER" },
      { rideId: ride.id, status: "SEARCHING", actorRole: "SYSTEM" },
      { rideId: ride.id, status: s.status === "CANCELLED" ? "CANCELLED" : "ACCEPTED", actorRole: s.status === "CANCELLED" ? "RIDER" : "DRIVER" },
      ...(s.status === "COMPLETED"
        ? ([
            { rideId: ride.id, status: "DRIVER_ARRIVING", actorRole: "SYSTEM" },
            { rideId: ride.id, status: "DRIVER_ARRIVED", actorRole: "DRIVER" },
            { rideId: ride.id, status: "IN_PROGRESS", actorRole: "DRIVER" },
            { rideId: ride.id, status: "COMPLETED", actorRole: "DRIVER" },
          ] as const)
        : []),
    ]);

    if (s.status === "COMPLETED") {
      await db.insert(payments).values({
        rideId: ride.id,
        provider: "MOCK",
        method: "CASH",
        amount: s.fare,
        status: "SUCCESS",
        providerRef: `MOCK-${ride.id.slice(0, 8).toUpperCase()}`,
        createdAt: completedAt,
      });
      const acc = earningsByDriver.get(drv.profileId) ?? { total: 0, trips: 0 };
      acc.total += Math.round(s.fare * 0.8);
      acc.trips += 1;
      earningsByDriver.set(drv.profileId, acc);
      if (s.rating) {
        await db.insert(ratings).values({ rideId: ride.id, riderId: s.riderId, driverId: drv.userId, score: s.rating });
        const list = ratingsByDriver.get(drv.userId) ?? [];
        list.push(s.rating);
        ratingsByDriver.set(drv.userId, list);
      }
    }
  }

  for (const [profileId, acc] of earningsByDriver) {
    await db
      .update(driverProfiles)
      .set({ totalEarnings: acc.total, totalTrips: acc.trips })
      .where(eq(driverProfiles.id, profileId));
  }
  for (const [userId, scores] of ratingsByDriver) {
    const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
    await db.update(driverProfiles).set({ rating: avg }).where(eq(driverProfiles.userId, userId));
  }

  console.log("✅ MALTown RiDE seed complete (development data only).\n");
  console.log("Login credentials (DEV ONLY):");
  console.log("  ADMIN  admin@maltown.dev    / Admin123!");
  console.log("  RIDER  rider@maltown.dev    / Rider123!");
  console.log("  RIDER  chisomo@maltown.dev  / Rider123!");
  console.log("  DRIVER driver1@maltown.dev  / Driver123!  (Chimwemwe — Toyota Corolla, online)");
  console.log("  DRIVER driver2@maltown.dev  / Driver123!  (Dalitso — Toyota RAV4, online)");
  console.log("  DRIVER driver3@maltown.dev  / Driver123!  (Mabvuto — Bajaj Boxer moto, online)");
  console.log("  DRIVER driver4@maltown.dev  / Driver123!  (Zikomo — offline)");
  console.log("  DRIVER driver5@maltown.dev  / Driver123!  (Tamanda — Suzuki Swift, online)");
  console.log("  DRIVER driver6@maltown.dev  / Driver123!  (Limbani — Toyota Hiace, offline)");
  console.log(`\nAdmin account id: ${admin.id} | primary rider: ${rider.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
