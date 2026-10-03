import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { toUserDto } from "@/lib/dto";
import { ApiError, clientIp, handle, rateLimit } from "@/lib/http";
import { applySessionCookie, signSession, verifyPassword } from "@/lib/security";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(async () => {
    rateLimit(`login:${clientIp(req)}`, 10, 5);
    const input = loginSchema.parse(await req.json());

    const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!user || !valid) throw new ApiError(401, "Invalid email or password", "INVALID_CREDENTIALS");

    const token = await signSession({ sub: user.id, role: user.role });
    const res = NextResponse.json({ user: toUserDto(user), token });
    return applySessionCookie(res, token);
  });
}
