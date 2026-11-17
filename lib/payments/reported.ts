import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { newToken, hashToken } from "@/lib/tokens";
import { logEvent } from "@/lib/events";
import { addBusinessDays, todayUtc } from "@/lib/day";

// „Już zapłaciłem”: rodzic zgłasza wpłatę. Przypomnienia o kaucji i dopłacie wstrzymują się na 3 dni robocze,
// potem sprawa trafia do biura („Do wyjaśnienia”). Link z przypomnienia ma osobny token (w bazie skrót).

export const PAYMENT_REPORT_SUSPEND_BUSINESS_DAYS = 3;

/** Nowy link „Już zapłaciłem” dla zgłoszenia (poprzedni przestaje działać). */
export async function newPaymentLink(applicationId: string): Promise<string> {
  const token = newToken();
  await prisma.application.update({ where: { id: applicationId }, data: { paymentLinkTokenHash: hashToken(token) } });
  return `${env().APP_URL}/zgloszenie/${token}/zaplacone`;
}

/** Zgłoszenie z ważnym linkiem „Już zapłaciłem” (do startu turnusu). */
export async function applicationByPaymentToken(token: string) {
  const app = await prisma.application.findUnique({
    where: { paymentLinkTokenHash: hashToken(token) },
    include: { turnus: true },
  });
  if (!app || app.turnus.startDate < todayUtc()) return null;
  return app;
}

/** Czy przypomnienia są wstrzymane przez zgłoszenie wpłaty. */
export function remindersSuspended(paymentReportedAt: Date | null, now: Date): boolean {
  return !!paymentReportedAt && addBusinessDays(paymentReportedAt, PAYMENT_REPORT_SUSPEND_BUSINESS_DAYS) > now;
}

export async function reportPayment(applicationId: string, actor: string, now: Date = new Date()): Promise<boolean> {
  const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  if (app.paymentReportedAt) return false;
  await prisma.application.update({ where: { id: applicationId }, data: { paymentReportedAt: now } });
  await logEvent({ applicationId, actor, action: "payment.reported", note: "rodzic zgłosił wpłatę („Już zapłaciłem”)" });
  return true;
}

/** Zgłoszenia z zgłoszoną wpłatą, których należność nadal nie ma wpływu (lista dla biura). */
export async function reportedWithoutPayment() {
  return prisma.application.findMany({
    where: { paymentReportedAt: { not: null }, charges: { some: { paidAt: null } } },
    include: { charges: true },
    orderBy: { paymentReportedAt: "asc" },
  });
}
