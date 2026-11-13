"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decryptField } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, signSession } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";
import { clearThrottle, registerAttempt, RULES, throttledUntil } from "@/lib/throttle";

// Logowanie administratora: e-mail + hasło + kod TOTP. Dławienie prób po e-mailu.
// Przy nieistniejącym e-mailu i tak liczymy bcrypt (wyrównanie czasu odpowiedzi).

const DUMMY_HASH = bcrypt.hashSync("nieistniejace-haslo-do-wyrownania-czasu", 10);
const SCOPE = "admin-login";
const GENERIC_ERROR = "Nieprawidłowe dane logowania.";

export async function loginAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");

  if (!email || !password || !code) return { error: GENERIC_ERROR, values: { email } };

  const retryAt = await throttledUntil(SCOPE, email);
  if (retryAt) {
    const minutes = Math.max(1, Math.ceil((retryAt.getTime() - Date.now()) / 60_000));
    return { error: `Zbyt wiele nieudanych prób. Spróbuj za ${minutes} min.`, values: { email } };
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  const passwordOk = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  const codeOk = admin ? verifyTotp(admin.email, decryptField(admin.totpSecretEnc), code) : false;

  if (!admin || !passwordOk || !codeOk) {
    await registerAttempt(SCOPE, email, RULES.adminLogin);
    return { error: GENERIC_ERROR, values: { email } };
  }

  await clearThrottle(SCOPE, email);
  const token = await signSession(admin.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().APP_URL.startsWith("https://"),
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  redirect("/admin");
}

export async function logoutAdmin(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/admin/login");
}
