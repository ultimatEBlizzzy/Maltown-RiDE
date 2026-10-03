import { NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/http";
import { acceptRide } from "@/lib/rides-service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Driver accepts a SEARCHING ride — atomic, single winner. */
export async function POST(req: NextRequest, ctx: RouteContext) {
  return handle(async () => {
    const { user } = await requireUser(req, ["DRIVER"]);
    const { id } = await ctx.params;
    const ride = await acceptRide(user, id);
    return Response.json({ ride });
  });
}
