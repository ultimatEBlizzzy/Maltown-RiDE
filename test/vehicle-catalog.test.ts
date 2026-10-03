import { describe, expect, it } from "vitest";
import { escapeHtmlAttribute, VEHICLE_CATALOG, vehicleColorHex } from "../src/lib/vehicle-catalog";

describe("Malamulele vehicle catalog", () => {
  it("includes the requested makes and models", () => {
    const makes = new Map(VEHICLE_CATALOG.map((entry) => [entry.make, entry.models.map((model) => model.name)]));
    expect(makes.get("Toyota")).toEqual(expect.arrayContaining(["Corolla Quest", "Corolla", "Etios", "Starlet", "Yaris"]));
    expect(makes.get("Volkswagen")).toEqual(expect.arrayContaining(["Polo", "Polo Vivo", "Virtus"]));
    expect(makes.get("Kia")).toEqual(expect.arrayContaining(["Picanto", "Rio", "Cerato", "Pegas"]));
    expect(makes.get("Chery")).toEqual(expect.arrayContaining(["Tiggo 4 Pro", "Tiggo 7 Pro"]));
    expect(makes.get("Mahindra")).toEqual(expect.arrayContaining(["XUV300", "XUV500"]));
  });

  it("maps the selected paint color to a safe illustration color", () => {
    expect(vehicleColorHex("Midnight Blue")).toBe("#253c6c");
    expect(vehicleColorHex("unlisted color")).toBe("#91a4bb");
  });

  it("escapes user-visible map labels before inserting them into HTML", () => {
    expect(escapeHtmlAttribute('Picanto "GT" & friends')).toBe("Picanto &quot;GT&quot; &amp; friends");
  });
});