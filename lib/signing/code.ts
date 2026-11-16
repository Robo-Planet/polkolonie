import { createHash, randomInt } from "node:crypto";

// Kod potwierdzający podpis na ekranie: 6 cyfr, ważny 10 minut, najwyżej 5 prób na kod.
export const SIGN_CODE_TTL_MS = 10 * 60_000;
export const SIGN_CODE_MAX_ATTEMPTS = 5;

export function newSignCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Skrót kodu z identyfikatorem zgłoszenia jako solą (kod nie jest zapisywany jawnie). */
export function hashSignCode(code: string, applicationId: string): string {
  return createHash("sha256").update(`${applicationId}:${code}`).digest("hex");
}

export type CodeCheck =
  | { ok: true }
  | { ok: false; reason: "expired" | "locked" | "mismatch" };

/** Ocena próby potwierdzenia (bez zapisu). Próba liczy się przy każdym błędnym wpisaniu. */
export function checkSignCode(
  record: { codeHash: string; expiresAt: Date; attempts: number },
  code: string,
  applicationId: string,
  now: Date,
): CodeCheck {
  if (record.expiresAt <= now) return { ok: false, reason: "expired" };
  if (record.attempts >= SIGN_CODE_MAX_ATTEMPTS) return { ok: false, reason: "locked" };
  return hashSignCode(code.trim(), applicationId) === record.codeHash ? { ok: true } : { ok: false, reason: "mismatch" };
}
