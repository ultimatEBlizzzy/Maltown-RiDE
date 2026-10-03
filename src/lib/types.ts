/**
 * Shared, isomorphic types for MALTown RiDE.
 * Safe to import from both server modules and client components
 * (contains no server-only dependencies).
 */

export type UserRole = "RIDER" | "DRIVER" | "ADMIN";

export type RideStatus =
  | "REQUESTED"
  | "SEARCHING"
  | "ACCEPTED"
  | "DRIVER_ARRIVING"
  | "DRIVER_ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type VehicleType = "SEDAN" | "HATCHBACK" | "SUV" | "MINIBUS" | "MOTO";
export type VehicleClassId = "STANDARD" | "COMFORT" | "BODA";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
export type PaymentMethod = "CASH" | "CARD" | "MOBILE_MONEY";
export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoPoint extends LatLng {
  address: string;
}

export interface FareBreakdown {
  base: number;
  distanceKm: number;
  durationMin: number;
  distanceCost: number;
  timeCost: number;
  bookingFee: number;
  multiplier: number;
  total: number;
  currency: string;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string;
}

export interface VehicleDto {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  registration: string;
  vehicleType: VehicleType;
}

export interface DriverInfoDto {
  userId: string;
  name: string;
  phone: string;
  rating: number;
  totalTrips: number;
  verificationStatus: VerificationStatus;
  vehicle?: VehicleDto;
}

export interface NearbyDriverDto {
  userId: string;
  name: string;
  rating: number;
  distanceKm: number;
  etaMin: number;
  lat: number;
  lng: number;
  vehicle?: VehicleDto;
}

export interface PaymentDto {
  id: string;
  rideId: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  provider: string;
  providerRef: string | null;
  createdAt: string;
}

export interface RatingDto {
  score: number;
  comment: string | null;
}

export interface RideDto {
  id: string;
  status: RideStatus;
  pickup: GeoPoint;
  destination: GeoPoint;
  vehiclePref: VehicleClassId;
  distanceKm: number;
  durationMin: number;
  estFare: number;
  finalFare: number | null;
  requestedAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledByRole: string | null;
  driver: DriverInfoDto | null;
  driverLocation: (LatLng & { updatedAt: string }) | null;
  routeLine: [number, number][] | null;
  approachRouteLine: [number, number][] | null;
  payment: PaymentDto | null;
  rating: RatingDto | null;
}

export interface RideOption {
  classId: VehicleClassId;
  name: string;
  description: string;
  seats: number;
  multiplier: number;
  fare: FareBreakdown;
}

export interface EstimateResponse {
  distanceKm: number;
  durationMin: number;
  etaToPickupMin: number;
  onlineDriversNearby: number;
  routingProvider: string;
  options: RideOption[];
}

export interface EarningsDto {
  today: number;
  week: number;
  total: number;
  completedTrips: number;
  recent: Array<{
    id: string;
    completedAt: string;
    finalFare: number;
    driverShare: number;
    pickupAddress: string;
    destinationAddress: string;
  }>;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface AdminRideRow {
  id: string;
  status: RideStatus;
  riderName: string;
  driverName: string | null;
  pickupAddress: string;
  destinationAddress: string;
  estFare: number;
  finalFare: number | null;
  requestedAt: string;
  paymentStatus: PaymentStatus | null;
}

export interface AdminDriverRow {
  userId: string;
  name: string;
  email: string;
  phone: string;
  isOnline: boolean;
  verificationStatus: VerificationStatus;
  rating: number;
  totalTrips: number;
  totalEarnings: number;
  vehicle: string | null;
  registration: string | null;
}

export interface AdminRiderRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  totalRides: number;
}

export interface AdminPaymentRow {
  id: string;
  rideId: string;
  riderName: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  provider: string;
  providerRef: string | null;
  createdAt: string;
}

export interface DashboardDto {
  totals: {
    riders: number;
    drivers: number;
    onlineDrivers: number;
    activeRides: number;
    searchingRides: number;
    completedToday: number;
    completedTotal: number;
    cancelledTotal: number;
    revenueTotal: number;
  };
  liveRides: Array<{
    id: string;
    status: RideStatus;
    pickup: LatLng;
    destination: LatLng;
    driverLocation: LatLng | null;
    riderName: string;
    driverName: string | null;
  }>;
  onlineDriverLocations: Array<{ userId: string; name: string; lat: number; lng: number }>;
  recentRides: AdminRideRow[];
  system: {
    db: "ok" | "degraded";
    routingProvider: string;
    uptimeSec: number;
    time: string;
  };
}

/** Ride statuses in which a ride is still live (not terminal). */
export const ACTIVE_RIDE_STATUSES: RideStatus[] = [
  "REQUESTED",
  "SEARCHING",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "DRIVER_ARRIVED",
  "IN_PROGRESS",
];

export const STATUS_META: Record<
  RideStatus,
  { label: string; tone: "accent" | "info" | "success" | "warn" | "danger"; step: number }
> = {
  REQUESTED: { label: "Requested", tone: "info", step: 0 },
  SEARCHING: { label: "Searching", tone: "accent", step: 1 },
  ACCEPTED: { label: "Driver found", tone: "accent", step: 2 },
  DRIVER_ARRIVING: { label: "Driver en route", tone: "accent", step: 3 },
  DRIVER_ARRIVED: { label: "Driver arrived", tone: "warn", step: 4 },
  IN_PROGRESS: { label: "On trip", tone: "warn", step: 5 },
  COMPLETED: { label: "Completed", tone: "success", step: 6 },
  CANCELLED: { label: "Cancelled", tone: "danger", step: 6 },
};

export const VEHICLE_CLASSES: Array<{
  id: VehicleClassId;
  name: string;
  description: string;
  seats: number;
  multiplier: number;
}> = [
  { id: "STANDARD", name: "RiDE Go", description: "Everyday sedans & hatchbacks", seats: 4, multiplier: 1 },
  { id: "COMFORT", name: "RiDE Comfort", description: "SUVs & minibuses with extra room", seats: 6, multiplier: 1.35 },
  { id: "BODA", name: "RiDE Moto", description: "Quick motorbike rides", seats: 1, multiplier: 0.6 },
];

export function vehicleClassOf(vt: VehicleType): VehicleClassId {
  if (vt === "MOTO") return "BODA";
  if (vt === "SUV" || vt === "MINIBUS") return "COMFORT";
  return "STANDARD";
}

export function classMultiplier(id: VehicleClassId): number {
  return VEHICLE_CLASSES.find((c) => c.id === id)?.multiplier ?? 1;
}

export function formatZAR(amount: number): string {
  return `R ${Math.round(amount).toLocaleString("en-ZA")}`;
}
