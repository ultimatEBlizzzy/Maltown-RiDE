import { NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/http";
import { transitionByDriver } from "@/lib/rides-service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Driver marks arrival at the pickup point. */
export async function POST(req: NextRequest, ctx: RouteContext) {
  return handle(async () => {
    const { user } = await requireUser(req, ["DRIVER"]);
    const { id } = await ctx.params;
    const ride = await transitionByDriver(user, id, "DRIVER_ARRIVED");
    return Response.json({ ride });
  });
}
