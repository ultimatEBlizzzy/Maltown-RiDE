import { db } from "@/db";
import { notifications } from "@/db/schema";
import { publishToUser } from "./realtime";

/**
 * NotificationProvider abstraction. The development implementation persists
 * to the database and pushes over the realtime bus. Swapping in a real SMS
 * provider (e.g. Twilio) means implementing `deliver` with credentials from
 * TWILIO_* environment variables — callers stay unchanged.
 */
export interface NotificationDelivery {
  readonly channel: "inapp" | "sms";
  deliver(userId: string, title: string, body: string): Promise<void>;
}

class MockNotificationProvider implements NotificationDelivery {
  readonly channel = "inapp" as const;
  async deliver(): Promise<void> {
    /* in-app persistence below is the delivery mechanism in development */
  }
}

export const notificationDelivery: NotificationDelivery = new MockNotificationProvider();

/** Persist + push a notification to a user. */
export async function notifyUser(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId,
      type,
      title,
      body,
      data: data ?? {},
    });
    publishToUser(userId, "notification", { type, title, body, at: new Date().toISOString() });
    await notificationDelivery.deliver(userId, title, body);
  } catch (err) {
    // Notification failures must never break ride flows.
    console.error("[notify] failed:", err);
  }
}
