import { NextRequest } from "next/server";
import { getEarnings } from "@/lib/drivers-service";
import { handle, requireUser } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const { user } = await requireUser(req, ["DRIVER"]);
    const earnings = await getEarnings(user);
    return Response.json(earnings);
  });
}
