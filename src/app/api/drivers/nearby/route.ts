import { NextRequest } from "next/server";
import { config } from "@/lib/config";
import { handle, requireUser } from "@/lib/http";
import { findNearbyDrivers } from "@/lib/matching";

export const dynamic = "force-dynamic";

/** Nearby available drivers for map visualisation (rider + admin only). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req, ["RIDER", "ADMIN"]);
    const params = req.nextUrl.searchParams;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return Response.json({ error: { message: "lat and lng are required", code: "VALIDATION" } }, { status: 400 });
    }
    const radiusParam = Number(params.get("radiusKm") ?? String(config.matching.radiusKm));
    const radiusKm = Math.min(25, Math.max(0.5, Number.isFinite(radiusParam) ? radiusParam : config.matching.radiusKm));
    const drivers = await findNearbyDrivers({ lat, lng, radiusKm });
    return Response.json({ drivers });
  });
}
