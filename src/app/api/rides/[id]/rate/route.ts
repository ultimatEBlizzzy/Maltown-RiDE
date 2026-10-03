import { NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/http";
import { rateRide } from "@/lib/rides-service";
import { rateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Rider rates a completed ride (1–5 stars). */
export async function POST(req: NextRequest, ctx: RouteContext) {
  return handle(async () => {
    const { user } = await requireUser(req, ["RIDER"]);
    const { id } = await ctx.params;
    const body = rateSchema.parse(await req.json());
    await rateRide(user, id, body.score, body.comment);
    return Response.json({ ok: true });
  });
}
