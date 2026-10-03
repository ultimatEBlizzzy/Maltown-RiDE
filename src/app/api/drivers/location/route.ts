import { NextRequest } from "next/server";
import { updateLocation } from "@/lib/drivers-service";
import { handle, requireUser } from "@/lib/http";
import { locationUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { user } = await requireUser(req, ["DRIVER"]);
    const body = locationUpdateSchema.parse(await req.json());
    await updateLocation(user, body.lat, body.lng, body.heading);
    return Response.json({ ok: true });
  });
}
