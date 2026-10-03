import { NextRequest } from "next/server";
import { goOnline } from "@/lib/drivers-service";
import { handle, requireUser } from "@/lib/http";
import { locationUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { user } = await requireUser(req, ["DRIVER"]);
    const body = locationUpdateSchema.parse(await req.json());
    await goOnline(user, body.lat, body.lng);
    return Response.json({ ok: true, online: true });
  });
}
