import { NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/http";
import { declineRide } from "@/lib/rides-service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return handle(async () => {
    const { user } = await requireUser(req, ["DRIVER"]);
    const { id } = await ctx.params;
    await declineRide(user, id);
    return Response.json({ ok: true });
  });
}
