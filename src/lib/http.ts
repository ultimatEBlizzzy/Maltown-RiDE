import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { readSession, type SessionPayload } from "./security";
import type { UserRole } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "ERROR",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Wraps a route handler with unified error handling:
 * ApiError → mapped status, ZodError → 400, InvalidTransitionError → 409.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return Response.json({ error: { message: err.message, code: err.code } }, { status: err.status });
    }
    if (err instanceof ZodError) {
      return Response.json(
        {
          error: {
            message: "Validation failed",
            code: "VALIDATION",
            issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
        },
        { status: 400 },
      );
    }
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 409) {
      const message = err instanceof Error ? err.message : "Conflict";
      return Response.json({ error: { message, code: "CONFLICT" } }, { status: 409 });
    }
    console.error("[api] unhandled error:", err);
    return Response.json({ error: { message: "Internal server error", code: "INTERNAL" } }, { status: 500 });
  }
}

export function json<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export interface AuthedContext {
  user: User;
  session: SessionPayload;
}

/** Authenticates the request and optionally enforces role membership. */
export async function requireUser(req: NextRequest, roles?: UserRole[]): Promise<AuthedContext> {
  const session = await readSession(req);
  if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  const [user] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
  if (!user) throw new ApiError(401, "Account no longer exists", "UNAUTHORIZED");
  if (roles && !roles.includes(user.role)) {
    throw new ApiError(403, "You do not have permission to perform this action", "FORBIDDEN");
  }
  return { user, session };
}

/* ------------------------------------------------------------------ */
/* Simple in-memory sliding-window rate limiter (auth-sensitive routes). */
/* Swap for Redis in multi-instance deployments.                       */
/* ------------------------------------------------------------------ */
const buckets = new Map<string, { tokens: number; last: number }>();

export function rateLimit(key: string, capacity: number, refillPerMin: number): void {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: capacity, last: now };
  const refill = ((now - bucket.last) / 60000) * refillPerMin;
  bucket.tokens = Math.min(capacity, bucket.tokens + refill);
  bucket.last = now;
  buckets.set(key, bucket);
  if (bucket.tokens < 1) throw new ApiError(429, "Too many requests — slow down", "RATE_LIMITED");
  bucket.tokens -= 1;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
