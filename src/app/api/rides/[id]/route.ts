import { NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/http";
import { getRideDtoForUser } from "@/lib/rides-service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/rides/:id — full ride state (rider owner, assigned driver, admin). */
export async function GET(req: NextRequest, ctx: RouteContext) {
  return handle(async () => {
    const { user } = await requireUser(req, ["RIDER", "DRIVER", "ADMIN"]);
    const { id } = await ctx.params;
    const ride = await getRideDtoForUser(user, id);
    return Response.json({ ride });
  });
}
