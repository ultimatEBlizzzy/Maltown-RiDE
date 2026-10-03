import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { iso } from "@/lib/dto";
import { handle, requireUser } from "@/lib/http";
import type { NotificationDto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const { user } = await requireUser(req);
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(20);
    const items: NotificationDto[] = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: iso(n.createdAt) ?? "",
    }));
    return Response.json({ notifications: items });
  });
}

/** POST marks all of the caller's notifications as read. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const { user } = await requireUser(req);
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, user.id));
    return Response.json({ ok: true });
  });
}
