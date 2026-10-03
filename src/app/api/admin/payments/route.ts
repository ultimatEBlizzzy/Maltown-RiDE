import { NextRequest } from "next/server";
import { fetchAdminPayments } from "@/lib/admin-service";
import { handle, requireUser } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req, ["ADMIN"]);
    const payments = await fetchAdminPayments(req.nextUrl.searchParams.get("search") ?? undefined);
    return Response.json({ payments });
  });
}
