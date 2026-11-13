import { sha256Hex } from "@/lib/crypto";
import { prisma } from "@/lib/db";

// Dławienie prób w bazie (działa na Vercel, bez pamięci współdzielonej między instancjami).
// Klucz jest skrótem – w bazie nie ma e-maili ani adresów IP w postaci jawnej.

export type ThrottleRule = {
  /** ile prób w oknie zanim nastąpi blokada */
  limit: number;
  /** długość okna liczenia prób */
  windowMs: number;
  /** jak długo trwa blokada po przekroczeniu limitu */
  blockMs: number;
};

function keyOf(scope: string, value: string): string {
  return `${scope}:${sha256Hex(value.toLowerCase().trim())}`;
}

/** Zwraca `retryAt`, gdy klucz jest w blokadzie; w przeciwnym razie `null`. */
export async function throttledUntil(scope: string, value: string, now = new Date()): Promise<Date | null> {
  const row = await prisma.rateLimit.findUnique({ where: { key: keyOf(scope, value) } });
  if (row?.blockedUntil && row.blockedUntil > now) return row.blockedUntil;
  return null;
}

/** Rejestruje próbę (np. błędne hasło albo wysłane zgłoszenie). Po przekroczeniu limitu nakłada blokadę. */
export async function registerAttempt(
  scope: string,
  value: string,
  rule: ThrottleRule,
  now = new Date(),
): Promise<void> {
  const key = keyOf(scope, value);
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  const windowOpen = row && now.getTime() - row.windowStart.getTime() < rule.windowMs;
  const count = windowOpen ? row.count + 1 : 1;
  const windowStart = windowOpen ? row.windowStart : now;
  const blockedUntil = count >= rule.limit ? new Date(now.getTime() + rule.blockMs) : null;
  await prisma.rateLimit.upsert({
    where: { key },
    create: { key, count, windowStart, blockedUntil },
    update: { count, windowStart, blockedUntil },
  });
}

/** Czyści licznik po udanym logowaniu. */
export async function clearThrottle(scope: string, value: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key: keyOf(scope, value) } });
}

/** Gotowe reguły używane w aplikacji. */
export const RULES = {
  adminLogin: { limit: 5, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
  publicApplication: { limit: 5, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
} satisfies Record<string, ThrottleRule>;
