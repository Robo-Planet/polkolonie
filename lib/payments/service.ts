import { prisma } from "@/lib/db";
import { todayUtc } from "@/lib/day";
import { logEvent } from "@/lib/events";
import { seatsTaken } from "@/lib/places";
import { parseAlerty24, checkAlertEnvelope } from "@/lib/alerts/alerty24";
import { verifyDkim } from "@/lib/alerts/dkim";
import { allocateAmount, extractApplicationCode, planCharges } from "@/lib/payments/rules";

// Należności, wpływy i przypisania. Każda zmiana statusu trafia do dziennika.

/** Tworzy brakujące należności zgłoszenia (idempotentnie). Działa po wysłaniu pełnego formularza. */
export async function ensureCharges(applicationId: string): Promise<void> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { turnus: true, charges: true },
  });
  if (!app || !app.formSubmittedAt) return;
  const plan = planCharges({
    priceGrosze: app.turnus.priceGrosze,
    discountGrosze: app.turnus.discountGrosze,
    returning: app.returningParticipant,
    depositGrosze: app.turnus.depositGrosze,
    startDate: app.turnus.startDate,
    // Data umowy: dzień wysłania formularza (podpis elektroniczny). Ścieżka wydruku poda datę skanu.
    contractDate: todayUtc(app.formSubmittedAt),
  });
  const existing = new Set(app.charges.map((c) => c.kind));
  for (const p of plan) {
    if (existing.has(p.kind)) continue;
    await prisma.charge.create({
      data: { applicationId, kind: p.kind, amountGrosze: p.amountGrosze, dueDate: p.dueDate },
    });
  }
}

/** Przypisuje wpływ do należności zgłoszenia (zaliczka, potem całość/dopłata) i aktualizuje status. */
export async function allocateTransaction(transactionId: string, applicationId: string, actor: string): Promise<void> {
  await prisma.$transaction(async (db) => {
    const tx = await db.bankTransaction.findUnique({ where: { id: transactionId }, include: { allocations: true } });
    if (!tx) throw new Error("Nie znaleziono wpływu");
    const already = tx.allocations.reduce((s, a) => s + a.amountGrosze, 0);
    const toAllocate = tx.amountGrosze - already;
    if (toAllocate <= 0) return;

    const charges = await db.charge.findMany({ where: { applicationId } });
    const { allocations, leftoverGrosze } = allocateAmount(
      toAllocate,
      charges.map((c) => ({ id: c.id, kind: c.kind, remainingGrosze: c.amountGrosze - c.paidGrosze })),
    );
    for (const a of allocations) {
      await db.allocation.create({ data: { transactionId, chargeId: a.chargeId, amountGrosze: a.amountGrosze } });
      const charge = charges.find((c) => c.id === a.chargeId)!;
      const paid = charge.paidGrosze + a.amountGrosze;
      await db.charge.update({
        where: { id: charge.id },
        data: { paidGrosze: paid, paidAt: paid >= charge.amountGrosze ? new Date() : charge.paidAt },
      });
    }
    const total = already + allocations.reduce((s, a) => s + a.amountGrosze, 0);
    const matchStatus = leftoverGrosze === 0 && total >= tx.amountGrosze
      ? "MATCHED"
      : total > 0 ? "PARTIAL" : "UNMATCHED";
    await db.bankTransaction.update({ where: { id: transactionId }, data: { applicationId, matchStatus } });
    await logEvent({
      applicationId,
      actor,
      action: "payment.allocated",
      after: { transactionId, allocated: total, leftoverGrosze, matchStatus },
    });
  });
  await applyPaymentStatus(applicationId, actor);
}

/** Zmienia status zgłoszenia po wpłatach: zaliczka daje miejsce (albo listę rezerwową), dopłata – „opłacone”. */
export async function applyPaymentStatus(applicationId: string, actor = "system"): Promise<void> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { turnus: true, charges: true },
  });
  if (!app) return;
  const depositPaid = app.charges.some((c) => (c.kind === "ZALICZKA" || c.kind === "CALOSC") && c.paidAt);
  const doplataPaid = app.charges.some((c) => c.kind === "DOPLATA" && c.paidAt);

  if (depositPaid && (app.status === "ZGLOSZONE" || app.status === "UMOWA_ZAWARTA")) {
    const taken = await seatsTaken(app.turnusId);
    const hasPlace = taken < app.turnus.placeLimit;
    const next = hasPlace ? "MIEJSCE" : "REZERWA";
    const waitlistPosition = hasPlace
      ? null
      : (await prisma.application.count({ where: { turnusId: app.turnusId, status: "REZERWA" } })) + 1;
    await prisma.application.update({
      where: { id: app.id },
      data: { status: next, statusChangedAt: new Date(), waitlistPosition },
    });
    await logEvent({
      applicationId: app.id,
      actor,
      action: hasPlace ? "place.assigned" : "waitlist.added",
      before: { status: app.status },
      after: { status: next },
    });
    return;
  }

  if (doplataPaid && (app.status === "MIEJSCE" || app.status === "KWALIFIKACJA")) {
    await prisma.application.update({ where: { id: app.id }, data: { status: "OPLACONE", statusChangedAt: new Date() } });
    await logEvent({
      applicationId: app.id,
      actor,
      action: "payment.final",
      before: { status: app.status },
      after: { status: "OPLACONE" },
    });
  }
}

export type IngestResult =
  | { status: "created"; transactionId: string; matchStatus: string }
  | { status: "duplicate"; transactionId: string }
  | { status: "rejected"; reason: string };

/**
 * Przetwarza alert Alerty24 (surowa wiadomość). Kolejność: DKIM (jeśli wymagany) → koperta → parser →
 * konto organizatora → deduplikacja → kod w tytule → przypisanie. Saldo nie jest zapisywane.
 */
export async function ingestAlert(raw: string, opts: { requireDkim: boolean }): Promise<IngestResult> {
  if (opts.requireDkim) {
    const dkim = await verifyDkim(raw, { allowedDomains: ["erste.pl"] });
    if (!dkim.ok) return { status: "rejected", reason: dkim.reason };
  }
  const envelope = checkAlertEnvelope(raw);
  if (!envelope.ok) return { status: "rejected", reason: envelope.reason };

  let payment;
  try {
    payment = parseAlerty24(raw);
  } catch (err) {
    return { status: "rejected", reason: err instanceof Error ? err.message : "nieczytelny alert" };
  }

  const organizer = await prisma.organizer.findUnique({ where: { id: 1 } });
  if (!organizer) return { status: "rejected", reason: "brak konta organizatora w bazie" };
  if (payment.recipientAccount !== organizer.bankAccount) {
    return { status: "rejected", reason: "wpływ na inne konto niż konto organizatora" };
  }

  const dedupeKey = `alert:${payment.identifier}`;
  const existing = await prisma.bankTransaction.findUnique({ where: { dedupeKey } });
  if (existing) return { status: "duplicate", transactionId: existing.id };

  let tx;
  try {
    tx = await prisma.bankTransaction.create({
      data: {
        source: "ALERT",
        dedupeKey,
        bookedAt: payment.receivedAt ?? new Date(),
        amountGrosze: payment.amountGrosze,
        title: payment.title,
        senderName: payment.sender,
        recipientAccount: payment.recipientAccount,
        messageId: payment.messageId || null,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      const again = await prisma.bankTransaction.findUnique({ where: { dedupeKey } });
      return { status: "duplicate", transactionId: again?.id ?? "" };
    }
    throw err;
  }

  const code = extractApplicationCode(payment.title);
  if (code) {
    const app = await prisma.application.findUnique({ where: { code } });
    if (app) await allocateTransaction(tx.id, app.id, "system");
  }
  const fresh = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: tx.id } });
  return { status: "created", transactionId: tx.id, matchStatus: fresh.matchStatus };
}

/** Ręczne przypisanie wpływu do zgłoszenia wskazanego kodem (biuro). */
export async function assignTransaction(transactionId: string, code: string, actor: string): Promise<{ ok: boolean; error?: string }> {
  const app = await prisma.application.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!app) return { ok: false, error: "Nie ma zgłoszenia o tym kodzie." };
  const tx = await prisma.bankTransaction.findUnique({ where: { id: transactionId } });
  if (!tx) return { ok: false, error: "Nie ma takiego wpływu." };
  if (tx.matchStatus === "MATCHED") return { ok: false, error: "Wpływ jest już w pełni przypisany." };
  await allocateTransaction(transactionId, app.id, actor);
  return { ok: true };
}

