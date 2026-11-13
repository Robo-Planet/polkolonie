"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { nextApplicationCode } from "@/lib/codes";
import { todayUtc, formatPlDate } from "@/lib/day";
import { logEvent } from "@/lib/events";
import { sendMail } from "@/lib/mail";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { shortApplicationSchema } from "@/lib/schemas";
import { hashToken, newToken } from "@/lib/tokens";
import { RULES, registerAttempt, throttledUntil } from "@/lib/throttle";

// Krótkie zgłoszenie z formularza publicznego (etap 1): turnus, dane rodzica i dziecka, zgoda RODO.
// Tworzy zgłoszenie ze statusem ZGLOSZONE i wysyła e-mail z linkiem do pełnego formularza.

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function submitShortApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);

  // Pułapka na boty: ukryte pole "website" musi być puste. Bot dostaje udawany sukces.
  if (values.website) return { ok: true, message: "Dziękujemy." };

  const ip = await clientIp();
  if (await throttledUntil("public-application", ip)) {
    return { error: "Zbyt wiele zgłoszeń z tego adresu. Spróbuj ponownie później.", values };
  }
  await registerAttempt("public-application", ip, RULES.publicApplication);

  const parsed = shortApplicationSchema.safeParse({
    turnusId: values.turnusId ?? "",
    parentFirstName: values.parentFirstName ?? "",
    parentLastName: values.parentLastName ?? "",
    parentEmail: values.parentEmail ?? "",
    parentPhone: values.parentPhone ?? "",
    childFirstName: values.childFirstName ?? "",
    returningParticipant: formData.get("returningParticipant") === "on",
    rodoConsent: formData.get("rodoConsent") === "on",
  });
  if (!parsed.success) {
    return { error: "Popraw zaznaczone pola.", fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }
  const data = parsed.data;

  const turnus = await prisma.turnus.findFirst({
    where: { id: data.turnusId, active: true, startDate: { gte: todayUtc() } },
  });
  if (!turnus) {
    return { error: "Wybrany turnus nie przyjmuje już zgłoszeń.", fieldErrors: { turnusId: "Wybierz turnus" }, values };
  }

  const code = await nextApplicationCode(turnus.season);
  const token = newToken();
  const now = new Date();

  const application = await prisma.application.create({
    data: {
      code,
      turnusId: turnus.id,
      parentFirstName: data.parentFirstName,
      parentLastName: data.parentLastName,
      parentEmail: data.parentEmail,
      parentPhone: data.parentPhone,
      childFirstName: data.childFirstName,
      returningParticipant: data.returningParticipant,
      rodoConsentAt: now,
      linkTokenHash: hashToken(token),
      linkExpiresAt: turnus.startDate,
    },
  });
  await logEvent({
    applicationId: application.id,
    actor: "rodzic",
    action: "application.created",
    after: { status: "ZGLOSZONE", code, turnus: turnus.number },
  });

  const link = `${env().APP_URL}/zgloszenie/${token}`;
  try {
    await sendMail({
      to: data.parentEmail,
      subject: `Zgłoszenie na półkolonie ${code} – dokończ formularz`,
      text: [
        `Dzień dobry,`,
        ``,
        `dziękujemy za zgłoszenie dziecka na półkolonie (turnus ${turnus.number}, ${formatPlDate(turnus.startDate)} – ${formatPlDate(turnus.endDate)}).`,
        `Kod zgłoszenia: ${code}`,
        ``,
        `Aby dokończyć zgłoszenie (umowa i karta kwalifikacyjna), otwórz link:`,
        link,
        ``,
        `Miejsce zostaje zarezerwowane po wpłacie zaliczki. Link jest ważny do rozpoczęcia turnusu.`,
        ``,
        `ROBOPLANET EVENTS S.C.`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("Nie udało się wysłać e-maila z linkiem", err);
    await logEvent({ applicationId: application.id, actor: "system", action: "mail.failed", note: "link do formularza" });
    return {
      error: `Zgłoszenie ${code} zostało zapisane, ale nie udało się wysłać e-maila. Skontaktuj się z biurem, podając kod.`,
      values,
    };
  }

  return {
    ok: true,
    message: `Wysłaliśmy link do dokończenia zgłoszenia na adres ${data.parentEmail}. Kod zgłoszenia: ${code}.`,
  };
}
