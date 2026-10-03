import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ---------------------------------- enums --------------------------------- */

export const userRoleEnum = pgEnum("user_role", ["RIDER", "DRIVER", "ADMIN"]);

export const rideStatusEnum = pgEnum("ride_status", [
  "REQUESTED",
  "SEARCHING",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "DRIVER_ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "SEDAN",
  "HATCHBACK",
  "SUV",
  "MINIBUS",
  "MOTO",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "SUCCESS",
  "FAILED",
  "REFUNDED",
]);

export const paymentMethodEnum = pgEnum("payment_method", ["CASH", "CARD", "MOBILE_MONEY"]);

export const verificationEnum = pgEnum("verification_status", ["PENDING", "VERIFIED", "REJECTED"]);

/* ---------------------------------- users --------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("RIDER"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), index("users_role_idx").on(t.role)],
);

export const riderProfiles = pgTable("rider_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  homeAddress: text("home_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const driverProfiles = pgTable(
  "driver_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    licenseNumber: text("license_number").notNull(),
    verificationStatus: verificationEnum("verification_status").notNull().default("VERIFIED"),
    isOnline: boolean("is_online").notNull().default(false),
    rating: numeric("rating", { precision: 3, scale: 2, mode: "number" }).notNull().default(5),
    totalTrips: integer("total_trips").notNull().default(0),
    totalEarnings: numeric("total_earnings", { precision: 14, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("driver_profiles_online_idx").on(t.isOnline)],
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => driverProfiles.id, { onDelete: "cascade" }),
    make: text("make").notNull(),
    model: text("model").notNull(),
    year: integer("year").notNull(),
    color: text("color").notNull(),
    registration: varchar("registration", { length: 32 }).notNull(),
    vehicleType: vehicleTypeEnum("vehicle_type").notNull().default("SEDAN"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("vehicles_registration_idx").on(t.registration)],
);

/**
 * One row per driver — last known location.
 * Note: stored as lat/lng doubles with a haversine query layer because this
 * environment has no PostGIS extension. The schema is PostGIS-ready: add a
 * generated geography column + GIST index when the extension is available.
 */
export const driverLocations = pgTable(
  "driver_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverId: uuid("driver_id")
      .notNull()
      .unique()
      .references(() => driverProfiles.id, { onDelete: "cascade" }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    heading: integer("heading"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("driver_locations_coord_idx").on(t.lat, t.lng)],
);

/* ---------------------------------- rides --------------------------------- */

export const rides = pgTable(
  "rides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riderId: uuid("rider_id")
      .notNull()
      .references(() => users.id),
    driverId: uuid("driver_id").references(() => users.id),
    pickupLat: doublePrecision("pickup_lat").notNull(),
    pickupLng: doublePrecision("pickup_lng").notNull(),
    pickupAddress: text("pickup_address").notNull(),
    destLat: doublePrecision("dest_lat").notNull(),
    destLng: doublePrecision("dest_lng").notNull(),
    destAddress: text("dest_address").notNull(),
    vehiclePref: varchar("vehicle_pref", { length: 16 }).notNull().default("STANDARD"),
    distanceKm: numeric("distance_km", { precision: 10, scale: 2, mode: "number" }).notNull(),
    durationMin: numeric("duration_min", { precision: 10, scale: 1, mode: "number" }).notNull(),
    estFare: numeric("est_fare", { precision: 12, scale: 2, mode: "number" }).notNull(),
    finalFare: numeric("final_fare", { precision: 12, scale: 2, mode: "number" }),
    status: rideStatusEnum("status").notNull().default("REQUESTED"),
    routeLine: jsonb("route_line").$type<[number, number][]>(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByRole: varchar("cancelled_by_role", { length: 16 }),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("rides_status_idx").on(t.status),
    index("rides_rider_idx").on(t.riderId),
    index("rides_driver_idx").on(t.driverId),
    index("rides_requested_at_idx").on(t.requestedAt),
  ],
);

export const rideStatusHistory = pgTable(
  "ride_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rideId: uuid("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    status: rideStatusEnum("status").notNull(),
    actorRole: varchar("actor_role", { length: 16 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ride_history_ride_idx").on(t.rideId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rideId: uuid("ride_id")
      .notNull()
      .unique()
      .references(() => rides.id),
    provider: varchar("provider", { length: 32 }).notNull().default("MOCK"),
    method: paymentMethodEnum("method").notNull().default("CASH"),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    status: paymentStatusEnum("status").notNull().default("PENDING"),
    providerRef: varchar("provider_ref", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_status_idx").on(t.status)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.read)],
);

export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rideId: uuid("ride_id")
      .notNull()
      .unique()
      .references(() => rides.id, { onDelete: "cascade" }),
    riderId: uuid("rider_id")
      .notNull()
      .references(() => users.id),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => users.id),
    score: integer("score").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ratings_driver_idx").on(t.driverId)],
);

export const adminActions = pgTable("admin_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  targetType: varchar("target_type", { length: 40 }),
  targetId: varchar("target_id", { length: 64 }),
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------- inferred types --------------------------- */

export type User = typeof users.$inferSelect;
export type RiderProfile = typeof riderProfiles.$inferSelect;
export type DriverProfile = typeof driverProfiles.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type DriverLocation = typeof driverLocations.$inferSelect;
export type Ride = typeof rides.$inferSelect;
export type RideStatusHistoryRow = typeof rideStatusHistory.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Rating = typeof ratings.$inferSelect;
