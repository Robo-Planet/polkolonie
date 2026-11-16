import { prisma } from "@/lib/db";
import { formatPlDate, todayUtc, daysBetween } from "@/lib/day";
import { formatGrosze } from "@/lib/money";
import { logEvent } from "@/lib/events";
import { sendMail } from "@/lib/mail";
import { env } from "@/lib/env";

// Przypomnienia i powiadomienia biura wg harmonogramu ze specyfikacji. Każdy krok wysyłany raz
// (klucz w dzienniku zdarzeń). Zadanie uruchamia się codziennie (endpoint /api/cron/reminders).

const ACCOUNT_NOTE = "konto Erste ROBOPLANET EVENTS S.C.";

export type ReminderSummary = { sent: number; officeNotes: number; skipped: number };

async function alreadyDone(applicationId: string, action: string, key: string): Promise<boolean> {
  const e = await prisma.event.findFirst({ where: { applicationId, action, note: key } });
  return !!e;
}

async function sendOnce(
  app: { id: string; code: string; parentEmail: string; parentFirstName: string; childFirstName: string },
  key: string,
  text: string,
  subject: string,
): Promise<boolean> {
  if (await alreadyDone(app.id, "reminder.sent", key)) return false;
  await sendMail({ to: app.parentEmail, subject, text });
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
    where: { contractSignedAt: { not: null }, status: { in: ["ZGLOSZONE", "UMOWA_ZAWARTA", "MIEJSCE", "KWALIFIKACJA"] } },
    include: { turnus: true, charges: true },
  });

  for (const app of apps) {
    const t = app.turnus;
    const contractDay = todayUtc(app.contractSignedAt!);
    const sinceContract = daysBetween(contractDay, today);
    const link = `${env().APP_URL}`;

    // Zaliczka: 5. dzień bez wpłaty – przypomnienie rodzica; 7. dzień – decyzja biura.
    const deposit = app.charges.find((c) => c.kind === "ZALICZKA" && !c.paidAt);
    if (deposit) {
      if (sinceContract >= 5) {
        const sent = await sendOnce(
          app,
          "deposit-5",
          `Dzień dobry,\n\nprzypominamy o wpłacie kaucji rezerwacyjnej ${formatGrosze(deposit.amountGrosze)} za zgłoszenie ${app.code} (turnus ${t.number}).\nTermin: ${formatPlDate(deposit.dueDate)}.\nNumer konta: ${ACCOUNT_NOTE}. W tytule przelewu podaj: ${app.code} ${app.childFirstName}.\n\nMiejsce zostaje zarezerwowane po wpłacie zaliczki.\n\nROBOPLANET EVENTS S.C.`,
          `Przypomnienie o kaucji rezerwacyjnej – ${app.code}`,
        );
        sent ? summary.sent++ : summary.skipped++;
      }
      if (sinceContract >= 7 && (await officeOnce(app.id, "deposit-7", "brak zaliczki po 7 dniach – do decyzji"))) summary.officeNotes++;
    }

    // Dopłata: 21 dni przed startem – informacja; 14 dni – przypomnienie; 7 dni – lista zaległości dla biura.
    const doplata = app.charges.find((c) => c.kind === "DOPLATA" && !c.paidAt);
    if (doplata && (app.status === "MIEJSCE" || app.status === "KWALIFIKACJA")) {
      const toStart = daysBetween(today, t.startDate);
      if (toStart <= 21) {
        const sent = await sendOnce(
          app,
          "doplata-21",
          `Dzień dobry,\n\nprzypominamy, że dopłata ${formatGrosze(doplata.amountGrosze)} za zgłoszenie ${app.code} jest płatna do ${formatPlDate(doplata.dueDate)}.\nTytuł przelewu: ${app.code} ${app.childFirstName}.\n\nROBOPLANET EVENTS S.C.`,
          `Informacja o dopłacie – ${app.code}`,
        );
        sent ? summary.sent++ : summary.skipped++;
      }
      if (toStart <= 14) {
        const sent = await sendOnce(
          app,
          "doplata-14",
          `Dzień dobry,\n\nw dniu ${formatPlDate(doplata.dueDate)} mija termin dopłaty ${formatGrosze(doplata.amountGrosze)} za zgłoszenie ${app.code}.\nTytuł przelewu: ${app.code} ${app.childFirstName}.\n\nROBOPLANET EVENTS S.C.`,
          `Przypomnienie o dopłacie – ${app.code}`,
        );
        sent ? summary.sent++ : summary.skipped++;
      }
      if (toStart <= 7 && (await officeOnce(app.id, "doplata-7", "brak dopłaty 7 dni przed startem – lista zaległości"))) summary.officeNotes++;
    }
  }
  return summary;
}
