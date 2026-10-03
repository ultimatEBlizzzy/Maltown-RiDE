import { NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/http";
import { completeRide } from "@/lib/rides-service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Driver completes the trip — final fare, payment, earnings recorded. */
export async function POST(req: NextRequest, ctx: RouteContext) {
  return handle(async () => {
    const { user } = await requireUser(req, ["DRIVER"]);
    const { id } = await ctx.params;
    const ride = await completeRide(user, id);
    return Response.json({ ride });
  });
}
