import type { LatLng } from "./types";

export interface CachedLocation extends LatLng {
  heading?: number;
  updatedAt: number;
}

/**
 * High-frequency driver-location hot layer.
 *
 * In production this interface is backed by Redis (GEOADD / GEORADIUS) so
 * location churn never touches PostgreSQL. This environment has no Redis, so
 * an in-memory TTL cache implements the same contract. Swap the factory
 * return value when REDIS_URL is configured — no caller changes required.
 */
export interface LocationCache {
  set(driverUserId: string, loc: CachedLocation): void;
  get(driverUserId: string): CachedLocation | undefined;
  entries(): Array<{ driverUserId: string } & CachedLocation>;
}

class MemoryLocationCache implements LocationCache {
  private store = new Map<string, CachedLocation>();
  private ttlMs = 5 * 60 * 1000;

  set(driverUserId: string, loc: CachedLocation): void {
    this.store.set(driverUserId, loc);
    this.prune();
  }

  get(driverUserId: string): CachedLocation | undefined {
    const entry = this.store.get(driverUserId);
    if (!entry) return undefined;
    if (Date.now() - entry.updatedAt > this.ttlMs) {
      this.store.delete(driverUserId);
      return undefined;
    }
    return entry;
  }

  entries(): Array<{ driverUserId: string } & CachedLocation> {
    this.prune();
    return Array.from(this.store.entries()).map(([driverUserId, loc]) => ({ driverUserId, ...loc }));
  }

  private prune(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [key, loc] of this.store) {
      if (loc.updatedAt < cutoff) this.store.delete(key);
    }
  }
}

const globalForCache = globalThis as typeof globalThis & { __maltownLocCache?: LocationCache };
export const locationCache: LocationCache =
  globalForCache.__maltownLocCache ?? new MemoryLocationCache();
globalForCache.__maltownLocCache = locationCache;
