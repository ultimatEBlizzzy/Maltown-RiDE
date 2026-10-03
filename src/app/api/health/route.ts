import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getRoutingProvider } from "@/lib/routing";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = true;
  try {
    await db.execute(sql`select 1`);
  } catch {
    dbOk = false;
  }
  return Response.json(
    {
      ok: dbOk,
      service: "maltown-ride-api",
      db: dbOk ? "ok" : "degraded",
      routingProvider: getRoutingProvider().name,
      uptimeSec: Math.round(process.uptime()),
      time: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  );
}
