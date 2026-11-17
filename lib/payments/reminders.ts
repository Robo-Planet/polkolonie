import { prisma } from "@/lib/db";
import { formatPlDate, todayUtc, daysBetween } from "@/lib/day";
import { formatGrosze } from "@/lib/money";
import { logEvent } from "@/lib/events";
import { sendMail } from "@/lib/mail";
import { newPaymentLink, remindersSuspended } from "@/lib/payments/reported";

// Przypomnienia i powiadomienia biura wg harmonogramu ze specyfikacji. Każdy krok wysyłany raz
// (klucz w dzienniku zdarzeń). Wstrzymane, gdy rodzic zgłosił wpłatę („Już zapłaciłem”).
// Zadanie uruchamia się codziennie (endpoint /api/cron/reminders).

export type ReminderSummary = { sent: number; officeNotes: number; skipped: number };

async function alreadyDone(applicationId: string, action: string, key: string): Promise<boolean> {
  return !!(await prisma.event.findFirst({ where: { applicationId, action, note: key } }));
}

/** Wysyła wiadomość raz. Treść dostaje link „Już zapłaciłem” – generowany dopiero przy wysyłce. */
async function sendOnce(
  app: { id: string; parentEmail: string },
  key: string,
  subject: string,
  text: (payLink: string) => string,
): Promise<boolean> {
  if (await alreadyDone(app.id, "reminder.sent", key)) return false;
  const payLink = await newPaymentLink(app.id);
  await sendMail({ to: app.parentEmail, subject, text: text(payLink) });
  await logEvent({ applicationId: app.id, actor: "system", action: "reminder.sent", note: key });
  return true;
}

async function officeOnce(applicationId: string, key: string, note: string): Promise<boolean> {
  if (await alreadyDone(applicationId, "office.alert", key)) return false;
  // Klucz w note (do sprawdzania duplikatów), opis w after.
  await logEvent({ applicationId, actor: "system", action: "office.alert", note: key, after: { text: note } });
  return true;
}

export async function runReminders(now: Date = new Date()): Promise<ReminderSummary> {
  const today = todayUtc(now);
  const summary: ReminderSummary = { sent: 0, officeNotes: 0, skipped: 0 };
  const apps = await prisma.application.findMany({
    where: { contractSignedAt: { not: null }, status: { in: ["UMOWA_ZAWARTA", "MIEJSCE", "KWALIFIKACJA"] } },
    include: { turnus: true, charges: true },
  });

  for (const app of apps) {
    const t = app.turnus;
    const sinceContract = daysBetween(todayUtc(app.contractSignedAt!), today);
    const suspended = remindersSuspended(app.paymentReportedAt, now);

    // Kaucja: 5. dzień bez wpłaty – przypomnienie rodzica; 7. dzień – decyzja biura (anulowanie w panelu).
    const deposit = app.charges.find((c) => (c.kind === "ZALICZKA" || c.kind === "CALOSC") && !c.paidAt);
    if (deposit) {
      if (sinceContract >= 5) {
        if (suspended) summary.skipped++;
        else {
          const sent = await sendOnce(
            app,
            "deposit-5",
            `Przypomnienie o kaucji rezerwacyjnej – ${app.code}`,
            (payLink) =>
              `Dzień dobry,\n\nprzypominamy o wpłacie kaucji rezerwacyjnej ${formatGrosze(deposit.amountGrosze)} za zgłoszenie ${app.code} (turnus ${t.number}).\nTermin: ${formatPlDate(deposit.dueDate)}.\nTytuł przelewu: ${app.code} ${app.childFirstName}.\n\nJeśli wpłata już została wykonana, kliknij: ${payLink}\n\nROBOPLANET EVENTS S.C.`,
          );
          sent ? summary.sent++ : summary.skipped++;
        }
      }
      if (sinceContract >= 7 && (await officeOnce(app.id, "deposit-7", "brak kaucji po 7 dniach – do decyzji"))) summary.officeNotes++;
    }

    // Dopłata: 21 dni przed startem – informacja; 14 dni – przypomnienie; 7 dni – lista zaległości dla biura.
    const doplata = app.charges.find((c) => c.kind === "DOPLATA" && !c.paidAt);
    if (doplata && (app.status === "MIEJSCE" || app.status === "KWALIFIKACJA")) {
      const toStart = daysBetween(today, t.startDate);
      if (toStart <= 21) {
        if (suspended) summary.skipped++;
        else {
          const sent = await sendOnce(
            app,
            "doplata-21",
            `Informacja o dopłacie – ${app.code}`,
            (payLink) =>
              `Dzień dobry,\n\nprzypominamy, że dopłata ${formatGrosze(doplata.amountGrosze)} za zgłoszenie ${app.code} jest płatna do ${formatPlDate(doplata.dueDate)}.\nTytuł przelewu: ${app.code} ${app.childFirstName}.\n\nJeśli wpłata już została wykonana, kliknij: ${payLink}\n\nROBOPLANET EVENTS S.C.`,
          );
          sent ? summary.sent++ : summary.skipped++;
        }
      }
      if (toStart <= 14) {
        if (suspended) summary.skipped++;
        else {
          const sent = await sendOnce(
            app,
            "doplata-14",
            `Przypomnienie o dopłacie – ${app.code}`,
            (payLink) =>
              `Dzień dobry,\n\nw dniu ${formatPlDate(doplata.dueDate)} mija termin dopłaty ${formatGrosze(doplata.amountGrosze)} za zgłoszenie ${app.code}.\nTytuł przelewu: ${app.code} ${app.childFirstName}.\n\nJeśli wpłata już została wykonana, kliknij: ${payLink}\n\nROBOPLANET EVENTS S.C.`,
          );
          sent ? summary.sent++ : summary.skipped++;
        }
      }
      if (toStart <= 7 && (await officeOnce(app.id, "doplata-7", "brak dopłaty 7 dni przed startem – lista zaległości"))) summary.officeNotes++;
    }
  }
  return summary;
}
