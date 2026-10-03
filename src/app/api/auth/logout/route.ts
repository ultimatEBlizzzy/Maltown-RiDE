import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/security";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle(async () => {
    return clearSessionCookie(NextResponse.json({ ok: true }));
  });
}
