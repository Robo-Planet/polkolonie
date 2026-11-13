import { prisma } from "@/lib/db";
import { todayUtc } from "@/lib/day";
import { hashToken } from "@/lib/tokens";

// Jedno miejsce, które zamienia token linku na zgłoszenie (ważne do startu turnusu, z potwierdzonym e-mailem).
export async function applicationByToken(token: string) {
  const app = await prisma.application.findUnique({
    where: { linkTokenHash: hashToken(token) },
    include: { turnus: true },
  });
  if (!app || app.linkExpiresAt < todayUtc()) return null;
  return app;
}
