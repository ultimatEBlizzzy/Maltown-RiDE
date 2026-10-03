import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { config } from "./config";
import type { UserRole } from "./types";

export interface SessionPayload {
  sub: string;
  role: UserRole;
}

const encoder = new TextEncoder();
function key(): Uint8Array {
  return encoder.encode(config.auth.jwtSecret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(config.auth.jwtIssuer)
    .setIssuedAt()
    .setExpirationTime(`${config.auth.sessionDays}d`)
    .sign(key());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: config.auth.jwtIssuer });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return { sub: payload.sub, role: payload.role as UserRole };
  } catch {
    return null;
  }
}

/** Reads the session from the httpOnly cookie or an Authorization bearer. */
export async function readSession(req: NextRequest): Promise<SessionPayload | null> {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return verifySession(auth.slice(7).trim());
  }
  return verifySession(req.cookies.get(config.auth.cookieName)?.value ?? "");
}

export function applySessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(config.auth.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    path: "/",
    maxAge: config.auth.sessionDays * 24 * 60 * 60,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(config.auth.cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    path: "/",
    maxAge: 0,
  });
  return res;
}
