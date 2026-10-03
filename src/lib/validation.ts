import { z } from "zod";

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const geoPointSchema = latLngSchema.extend({
  address: z.string().trim().min(2).max(200),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  phone: z.string().trim().min(7).max(32),
  password: z.string().min(8).max(128),
  role: z.enum(["RIDER", "DRIVER"]),
  licenseNumber: z.string().trim().min(4).max(60).optional(),
  vehicle: z
    .object({
      make: z.string().trim().min(2).max(60),
      model: z.string().trim().min(1).max(60),
      year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
      color: z.string().trim().min(2).max(40),
      registration: z.string().trim().min(4).max(32),
      vehicleType: z.enum(["SEDAN", "HATCHBACK", "SUV", "MINIBUS", "MOTO"]),
    })
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const locationUpdateSchema = latLngSchema.extend({
  heading: z.number().min(0).max(360).optional(),
});

export const rideRequestSchema = z.object({
  pickup: geoPointSchema,
  destination: geoPointSchema,
  vehiclePref: z.enum(["STANDARD", "COMFORT", "BODA"]).default("STANDARD"),
});

export const estimateSchema = z.object({
  pickup: latLngSchema,
  destination: latLngSchema,
});

export const rateSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export const cancelSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RideRequestInput = z.infer<typeof rideRequestSchema>;
