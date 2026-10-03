import type { VehicleType } from "./types";

export interface VehicleModelOption {
  name: string;
  vehicleType: VehicleType;
}

export interface VehicleMakeOption {
  make: string;
  models: VehicleModelOption[];
}

const models = (vehicleType: VehicleType, names: string[]): VehicleModelOption[] =>
  names.map((name) => ({ name, vehicleType }));

export const VEHICLE_CATALOG: VehicleMakeOption[] = [
  { make: "Toyota", models: [...models("SEDAN", ["Corolla Quest", "Corolla", "Etios"]), ...models("HATCHBACK", ["Starlet", "Yaris"])] },
  { make: "Volkswagen", models: [...models("HATCHBACK", ["Polo", "Polo Vivo"]), ...models("SEDAN", ["Virtus"])] },
  { make: "Hyundai", models: [...models("HATCHBACK", ["Grand i10", "i20"]), ...models("SEDAN", ["Accent", "Elantra"])] },
  { make: "Kia", models: [...models("HATCHBACK", ["Picanto", "Rio"]), ...models("SEDAN", ["Cerato", "Pegas"])] },
  { make: "Nissan", models: [...models("SEDAN", ["Almera", "Sunny"]), ...models("HATCHBACK", ["Micra"])] },
  { make: "Suzuki", models: [...models("HATCHBACK", ["Swift", "Baleno"]), ...models("SEDAN", ["Dzire", "Ciaz"])] },
  { make: "Renault", models: [...models("HATCHBACK", ["Kwid", "Sandero", "Clio"]), ...models("SEDAN", ["Logan"])] },
  { make: "Honda", models: [...models("HATCHBACK", ["Brio"]), ...models("SEDAN", ["Amaze", "Ballade", "Civic"])] },
  { make: "Ford", models: [...models("HATCHBACK", ["Figo", "Fiesta"]), ...models("SEDAN", ["Focus"])] },
  { make: "Mazda", models: [...models("HATCHBACK", ["Mazda2"]), ...models("SEDAN", ["Mazda3"])] },
  { make: "Chery", models: models("SUV", ["Tiggo 4 Pro", "Tiggo 7 Pro"]) },
  { make: "Haval", models: models("SUV", ["Jolion"]) },
  { make: "Mahindra", models: models("SUV", ["XUV300", "XUV500"]) },
  { make: "Other", models: [...models("SEDAN", ["Other car"]), ...models("MINIBUS", ["Minibus / Quantum"]), ...models("MOTO", ["Motorbike"])] },
];

export const VEHICLE_COLORS = [
  { name: "White", hex: "#f1f5f9" },
  { name: "Silver", hex: "#aeb8c6" },
  { name: "Grey", hex: "#64748b" },
  { name: "Black", hex: "#202938" },
  { name: "Red", hex: "#dc4654" },
  { name: "Blue", hex: "#3c83d5" },
  { name: "Midnight Blue", hex: "#253c6c" },
  { name: "Green", hex: "#39806a" },
  { name: "Brown", hex: "#896650" },
] as const;

export function vehicleColorHex(color: string): string {
  const normalized = color.trim().toLowerCase();
  return VEHICLE_COLORS.find((option) => option.name.toLowerCase() === normalized)?.hex ?? "#91a4bb";
}

export function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}