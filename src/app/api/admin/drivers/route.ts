import { NextRequest } from "next/server";
import { fetchAdminDrivers } from "@/lib/admin-service";
import { handle, requireUser } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req, ["ADMIN"]);
    const drivers = await fetchAdminDrivers(req.nextUrl.searchParams.get("search") ?? undefined);
    return Response.json({ drivers });
  });
}
