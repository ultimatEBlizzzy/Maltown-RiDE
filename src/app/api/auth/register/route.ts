import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { driverProfiles, riderProfiles, users, vehicles } from "@/db/schema";
import { toUserDto } from "@/lib/dto";
import { ApiError, clientIp, handle, rateLimit } from "@/lib/http";
import { generateOtp, MockOtpProvider, otpProvider } from "@/lib/otp";
import { applySessionCookie, hashPassword, signSession } from "@/lib/security";
import { registerSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(async () => {
    rateLimit(`register:${clientIp(req)}`, 10, 5);
    const input = registerSchema.parse(await req.json());

    const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (existing) throw new ApiError(409, "An account with this email already exists", "EMAIL_TAKEN");

    const passwordHash = await hashPassword(input.password);
    const [user] = await db
      .insert(users)
      .values({ name: input.name, email: input.email, phone: input.phone, passwordHash, role: input.role })
      .returning();

    if (input.role === "RIDER") {
      await db.insert(riderProfiles).values({ userId: user.id });
    } else {
      const [profile] = await db
        .insert(driverProfiles)
        .values({
          userId: user.id,
          licenseNumber: input.licenseNumber ?? "MW-PENDING-0000",
          // MVP: drivers are auto-verified at registration; an admin
          // verification flow is the documented post-MVP extension.
          verificationStatus: "VERIFIED",
        })
        .returning();
      if (input.vehicle) {
        await db.insert(vehicles).values({ driverId: profile.id, ...input.vehicle });
      }
    }

    // OTP handshake (mock provider in development — code surfaced for demos).
    const code = generateOtp();
    await otpProvider.send(input.phone, code);

    const token = await signSession({ sub: user.id, role: user.role });
    const res = NextResponse.json(
      {
        user: toUserDto(user),
        token,
        ...(otpProvider instanceof MockOtpProvider && process.env.NODE_ENV !== "production"
          ? { otpDev: code }
          : {}),
      },
      { status: 201 },
    );
    return applySessionCookie(res, token);
  });
}
