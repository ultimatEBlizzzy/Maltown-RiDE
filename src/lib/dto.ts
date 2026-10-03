import type { DriverProfile, User, Vehicle } from "@/db/schema";
import type { DriverInfoDto, UserDto, VehicleDto } from "./types";

export function iso(date: Date | string | null | undefined): string | null {
  if (date == null) return null;
  return date instanceof Date ? date.toISOString() : date;
}

export function toUserDto(u: User): UserDto {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    createdAt: iso(u.createdAt) ?? "",
  };
}

export function toVehicleDto(v: Vehicle): VehicleDto {
  return {
    id: v.id,
    make: v.make,
    model: v.model,
    year: v.year,
    color: v.color,
    registration: v.registration,
    vehicleType: v.vehicleType,
  };
}

export function toDriverInfoDto(u: User, p: DriverProfile, v?: Vehicle): DriverInfoDto {
  return {
    userId: u.id,
    name: u.name,
    phone: u.phone,
    rating: p.rating,
    totalTrips: p.totalTrips,
    verificationStatus: p.verificationStatus,
    vehicle: v ? toVehicleDto(v) : undefined,
  };
}
