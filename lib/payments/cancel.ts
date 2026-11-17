import { prisma } from "@/lib/db";
import { daysBetween, formatPlDate, todayUtc } from "@/lib/day";
import { logEvent } from "@/lib/events";
import { sendMail } from "@/lib/mail";

// Brak kaucji rezerwacyjnej w terminie = anulowanie zgłoszenia (§ 1 ust. 2 umowy).
// System pokazuje takie zgłoszenia w „Do wyjaśnienia”; anuluje je biuro (jednym kliknięciem).
// Wpłata, która wpłynie przed anulowaniem, wstrzymuje je (zgłoszenie znika z listy).

export type OverdueDeposit = {
  applicationId: string;
  code: string;
  parentEmail: string;
  depositDue: Date;
  daysOverdue: number;
};

/** Zgłoszenia, w których kaucja nie wpłynęła w terminie (po dniu terminu). */
export async function overdueDeposits(now: Date = new Date()): Promise<OverdueDeposit[]> {
  const today = todayUtc(now);
  const apps = await prisma.application.findMany({
    where: { status: "UMOWA_ZAWARTA", contractSignedAt: { not: null } },
    include: { charges: true },
  });
  const out: OverdueDeposit[] = [];
  for (const app of apps) {
    const deposit = app.charges.find((c) => (c.kind === "ZALICZKA" || c.kind === "CALOSC") && !c.paidAt);
    if (!deposit || deposit.dueDate >= today) continue;
    out.push({
      applicationId: app.id,
      code: app.code,
      parentEmail: app.parentEmail,
      depositDue: deposit.dueDate,
      daysOverdue: daysBetween(deposit.dueDate, today),
    });
  }
  return out;
}

/** Anulowanie przez biuro. Sprawdza ponownie warunki (wpłata mogła wpłynąć w międzyczasie). */
export async function cancelForMissingDeposit(applicationId: string, actor: string, now: Date = new Date()): Promise<{ ok: boolean; error?: string }> {
  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { charges: true } });
  if (!app) return { ok: false, error: "Nie ma takiego zgłoszenia." };
  if (app.status !== "UMOWA_ZAWARTA") return { ok: false, error: "Zgłoszenie nie czeka już na kaucję." };
  const deposit = app.charges.find((c) => (c.kind === "ZALICZKA" || c.kind === "CALOSC") && !c.paidAt);
  if (!deposit) return { ok: false, error: "Kaucja jest już opłacona – zgłoszenie nie może być anulowane." };
  if (deposit.dueDate >= todayUtc(now)) return { ok: false, error: "Termin wpłaty kaucji jeszcze nie minął." };

  await prisma.application.update({
    where: { id: app.id },
    data: { status: "WYGASLA", statusChangedAt: now },
  });
  await logEvent({
    applicationId: app.id,
    actor,
    action: "application.cancelled",
    before: { status: "UMOWA_ZAWARTA" },
    after: { status: "WYGASLA" },
    note: "brak kaucji rezerwacyjnej w terminie (§ 1 ust. 2)",
  });
  await sendMail({
    to: app.parentEmail,
    subject: `Zgłoszenie anulowane – ${app.code}`,
    text: [
      "Dzień dobry,",
      "",
      `zgłoszenie ${app.code} zostało anulowane, ponieważ kaucja rezerwacyjna nie wpłynęła w terminie (${formatPlDate(deposit.dueDate)}), zgodnie z § 1 ust. 2 umowy.`,
      "Jeśli wpłata została wykonana, prosimy o kontakt z biurem.",
      "",
      "ROBOPLANET EVENTS S.C.",
    ].join("\n"),
  });
  return { ok: true };
}
