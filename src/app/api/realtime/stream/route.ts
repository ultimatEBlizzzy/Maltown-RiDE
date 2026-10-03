import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getActiveRideFor } from "@/lib/rides-service";
import { bus, type RealtimeEvent } from "@/lib/realtime";
import { verifySession } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream — MALTown RiDE's realtime push channel.
 * EventSource cannot set headers, so the session JWT is passed as ?token=.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const session = await verifySession(token);
  if (!session) {
    return Response.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const [user] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
  if (!user) {
    return Response.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const channels = [`user:${user.id}`];
  if (user.role === "ADMIN") channels.push("admin");
  const active = await getActiveRideFor(user.id, user.role === "DRIVER" ? "DRIVER" : "RIDER");
  if (active) channels.push(`ride:${active.id}`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (event: RealtimeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* stream closed */
        }
      };
      const unsubscribes = channels.map((channel) => bus.subscribe(channel, push));
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "hello", payload: { channels }, at: new Date().toISOString() })}\n\n`,
        ),
      );
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          /* stream closed */
        }
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribes.forEach((u) => u());
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
