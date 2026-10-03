import { NextRequest } from "next/server";
import { config } from "@/lib/config";
import { estimateFare } from "@/lib/fare";
import { handle, requireUser } from "@/lib/http";
import { findNearbyDrivers } from "@/lib/matching";
import { getRoutingProvider } from "@/lib/routing";
import { VEHICLE_CLASSES, type EstimateResponse } from "@/lib/types";
import { estimateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Backend-authoritative fare + ETA estimate (never computed on the client). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(req, ["RIDER", "DRIVER", "ADMIN"]);
    const input = estimateSchema.parse(await req.json());

    const provider = getRoutingProvider();
    const route = await provider.route(input.pickup, input.destination);
    const candidates = await findNearbyDrivers({
      lat: input.pickup.lat,
      lng: input.pickup.lng,
      radiusKm: config.matching.radiusKm,
    });
    const etaToPickupMin = candidates.length > 0 ? candidates[0].etaMin + 2 : 5;

    const response: EstimateResponse = {
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      etaToPickupMin,
      onlineDriversNearby: candidates.length,
      routingProvider: provider.name,
      options: VEHICLE_CLASSES.map((klass) => ({
        classId: klass.id,
        name: klass.name,
        description: klass.description,
        seats: klass.seats,
        multiplier: klass.multiplier,
        fare: estimateFare(route.distanceKm, route.durationMin, klass.id),
      })),
    };
    return Response.json(response);
  });
}
