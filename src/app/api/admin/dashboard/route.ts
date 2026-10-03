import { NextRequest } from "next/server";
import { fetchDashboard } from "@/lib/admin-service";
import { handle, requireUser } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req, ["ADMIN"]);
    return Response.json(await fetchDashboard());
  });
}
