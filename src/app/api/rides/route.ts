import { NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/http";
import { buildRideDto, createRideRequest, listRidesForUser } from "@/lib/rides-service";
import { rideRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** POST /api/rides — rider requests a ride (route, fare, matching, notify). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const { user } = await requireUser(req, ["RIDER"]);
    const input = rideRequestSchema.parse(await req.json());
    const result = await createRideRequest(user, input);
    const ride = await buildRideDto(result.ride);
    return Response.json(
      {
        ride,
        fare: result.fare,
        nearbyCandidates: result.candidates.length,
        routingProvider: result.routingProvider,
      },
      { status: 201 },
    );
  });
}

/** GET /api/rides?scope=active|history|all — caller's rides. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const { user } = await requireUser(req, ["RIDER", "DRIVER"]);
    const scopeParam = req.nextUrl.searchParams.get("scope") ?? "all";
    const scope = scopeParam === "active" || scopeParam === "history" ? scopeParam : "all";
    const rides = await listRidesForUser(user, scope);
    return Response.json({ rides });
  });
}
