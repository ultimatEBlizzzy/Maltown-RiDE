import { NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/http";
import { transitionByDriver } from "@/lib/rides-service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Driver starts the trip — ride becomes IN_PROGRESS. */
export async function POST(req: NextRequest, ctx: RouteContext) {
  return handle(async () => {
    const { user } = await requireUser(req, ["DRIVER"]);
    const { id } = await ctx.params;
    const ride = await transitionByDriver(user, id, "IN_PROGRESS");
    return Response.json({ ride });
  });
}
