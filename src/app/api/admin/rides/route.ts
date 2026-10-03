import { NextRequest } from "next/server";
import { fetchAdminRides } from "@/lib/admin-service";
import { handle, requireUser } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req, ["ADMIN"]);
    const params = req.nextUrl.searchParams;
    const rides = await fetchAdminRides({
      search: params.get("search") ?? undefined,
      status: params.get("status") ?? undefined,
      limit: Math.min(100, Number(params.get("limit") ?? 50) || 50),
    });
    return Response.json({ rides });
  });
}
