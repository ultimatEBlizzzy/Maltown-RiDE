import { NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/http";
import { cancelRide } from "@/lib/rides-service";
import { cancelSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Rider or assigned driver cancels (before the trip starts). */
export async function POST(req: NextRequest, ctx: RouteContext) {
  return handle(async () => {
    const { user } = await requireUser(req, ["RIDER", "DRIVER"]);
    const { id } = await ctx.params;
    const body = cancelSchema.parse(await req.json().catch(() => ({})));
    const ride = await cancelRide(user, id, body.reason);
    return Response.json({ ride });
  });
}
