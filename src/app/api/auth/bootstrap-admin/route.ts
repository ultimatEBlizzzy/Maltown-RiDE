import { timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { toUserDto } from "@/lib/dto";
import { ApiError, clientIp, handle, rateLimit } from "@/lib/http";
import { applySessionCookie, hashPassword, signSession } from "@/lib/security";

export const dynamic = "force-dynamic";

const bootstrapSchema = z.object({
  bootstrapToken: z.string().min(32).max(256),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  phone: z.string().trim().min(7).max(32),
  password: z.string().min(12).max(128),
});

function matchesSecret(expected: string, provided: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

/** Creates and signs in the first administrator only. Requires a Render-only bootstrap secret. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    rateLimit(`admin-bootstrap:${clientIp(req)}`, 5, 0.2);
    const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!expectedToken || expectedToken.length < 32) {
      throw new ApiError(503, "Initial admin setup is not enabled on this deployment", "BOOTSTRAP_DISABLED");
    }

    const input = bootstrapSchema.parse(await req.json());
    if (!matchesSecret(expectedToken, input.bootstrapToken)) {
      throw new ApiError(401, "Invalid setup token", "INVALID_BOOTSTRAP_TOKEN");
    }

    const passwordHash = await hashPassword(input.password);
    const admin = await db.transaction(async (tx) => {
      // Serialize first-admin requests so two simultaneous requests can't both win.
      await tx.execute(sql`select pg_advisory_xact_lock(726914203)`);
      const [existingAdmin] = await tx.select({ id: users.id }).from(users).where(eq(users.role, "ADMIN")).limit(1);
      if (existingAdmin) throw new ApiError(409, "An administrator already exists; first-admin setup is closed", "ADMIN_ALREADY_EXISTS");

      const [existingEmail] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
      if (existingEmail) throw new ApiError(409, "An account with this email already exists", "EMAIL_TAKEN");

      const [created] = await tx
        .insert(users)
        .values({ name: input.name, email: input.email, phone: input.phone, passwordHash, role: "ADMIN" })
        .returning();
      return created;
    });

    const sessionToken = await signSession({ sub: admin.id, role: "ADMIN" });
    const response = NextResponse.json({ user: toUserDto(admin) }, { status: 201 });
    return applySessionCookie(response, sessionToken);
  });
}