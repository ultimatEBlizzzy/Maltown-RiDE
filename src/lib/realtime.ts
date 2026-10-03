/**
 * In-process realtime event bus + SSE delivery.
 *
 * The platform runtime is serverless-friendly Next.js, so realtime push is
 * delivered over Server-Sent Events (the WebSocket-equivalent server-push
 * channel available here). Channels:
 *   - user:{userId}  → notifications, ride_request events
 *   - ride:{rideId}  → ride lifecycle + driver location updates
 *   - admin          → operations feed
 *
 * Swapping this bus for Redis pub/sub + a WebSocket gateway requires no
 * changes in calling code — only `publish`/`subscribe` implementations.
 */

export interface RealtimeEvent {
  type: string;
  payload: unknown;
  at: string;
}

type Listener = (event: RealtimeEvent) => void;

class EventBus {
  private channels = new Map<string, Set<Listener>>();

  subscribe(channel: string, listener: Listener): () => void {
    let set = this.channels.get(channel);
    if (!set) {
      set = new Set();
      this.channels.set(channel, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.channels.delete(channel);
    };
  }

  publish(channel: string, type: string, payload: unknown): void {
    const set = this.channels.get(channel);
    if (!set || set.size === 0) return;
    const event: RealtimeEvent = { type, payload, at: new Date().toISOString() };
    for (const listener of Array.from(set)) {
      try {
        listener(event);
      } catch {
        /* listener errors must not break publishers */
      }
    }
  }

  subscriberCount(channel: string): number {
    return this.channels.get(channel)?.size ?? 0;
  }
}

const globalForBus = globalThis as typeof globalThis & { __maltownBus?: EventBus };
export const bus: EventBus = globalForBus.__maltownBus ?? new EventBus();
globalForBus.__maltownBus = bus;

export function publishToUser(userId: string, type: string, payload: unknown): void {
  bus.publish(`user:${userId}`, type, payload);
}

export function publishToRide(rideId: string, type: string, payload: unknown): void {
  bus.publish(`ride:${rideId}`, type, payload);
}

export function publishToAdmin(type: string, payload: unknown): void {
  bus.publish("admin", type, payload);
}
