import { NextRequest } from "next/server";
import { getDriverRequests } from "@/lib/drivers-service";
import { handle, requireUser } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Incoming ride requests for an online driver (ranked by proximity). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const { user } = await requireUser(req, ["DRIVER"]);
    const requests = await getDriverRequests(user);
    return Response.json({ requests });
  });
}
