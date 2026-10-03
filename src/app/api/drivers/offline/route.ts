import { NextRequest } from "next/server";
import { goOffline } from "@/lib/drivers-service";
import { handle, requireUser } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { user } = await requireUser(req, ["DRIVER"]);
    await goOffline(user);
    return Response.json({ ok: true, online: false });
  });
}
