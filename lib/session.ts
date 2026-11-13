import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

// Sesja administratora: podpisany JWT (HS256) w cookie httpOnly. Ważność 8 godzin.

export const SESSION_COOKIE = "pk_admin";
export const SESSION_MAX_AGE_S = 8 * 60 * 60;

const secret = () => new TextEncoder().encode(env().SESSION_SECRET);

export async function signSession(adminId: string): Promise<string> {
  return new SignJWT({ sub: adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(secret());
}

/** Zwraca id administratora z poprawnej i niewygasłej sesji, inaczej `null`. */
export async function readSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
