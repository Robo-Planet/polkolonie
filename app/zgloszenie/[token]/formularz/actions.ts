"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { applicationByToken } from "@/lib/application-by-token";
import { encryptField } from "@/lib/crypto";
import { logEvent } from "@/lib/events";
import { formValues, type FormState } from "@/lib/form-state";
import { parseFullForm } from "@/lib/full-form";
import { ensureCharges } from "@/lib/payments/service";
import { UMOWA_TEMPLATE_VERSION, umowaTemplate } from "@/lib/documents/umowa-template";

// Zapis szkicu i wysłanie pełnego formularza. Szkic zapisuje, co przechodzi walidację formatu;
// wysłanie wymaga wszystkich pól obowiązkowych. Po wysłaniu formularz jest tylko do odczytu.

function flagsOf(formData: FormData): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const [k, v] of formData.entries()) if (v === "on") flags[k] = true;
  return flags;
}

export async function saveFullForm(token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const app = await applicationByToken(token);
  if (!app) return { error: "Link jest nieaktywny. Skontaktuj się z biurem." };
  if (!app.emailConfirmedAt) return { error: "Najpierw potwierdź adres e-mail." };
  if (app.formSubmittedAt) return { error: "Formularz został już wysłany. Zmiany zgłoś e-mailem do biura." };

  const submit = formData.get("intent") === "submit";
  const values = formValues(formData);
  const parsed = parseFullForm(values, flagsOf(formData), {
    final: submit,
    turnusStart: app.turnus.startDate,
    minAge: app.turnus.minAge,
  });
  if (!parsed.ok) {
    const first = Object.values(parsed.fieldErrors)[0];
    return {
      error: submit ? "Popraw zaznaczone pola, aby wysłać formularz." : `Szkic nie został zapisany: ${first}`,
      fieldErrors: parsed.fieldErrors,
      values,
    };
  }

  const d = parsed.data;
  const now = new Date();
  const sensitive = JSON.stringify({ health: d.health, pickupPersons: d.pickupPersons });
  await prisma.application.update({
    where: { id: app.id },
    data: {
      parentFirstName: d.parentFirstName || app.parentFirstName,
      parentLastName: d.parentLastName || app.parentLastName,
      childFirstName: d.childFirstName || app.childFirstName,
      childLastName: d.childLastName || null,
      secondParentName: d.secondParentName || null,
      parentPhoneAlt: d.parentPhoneAlt || null,
      parentAddress: d.parentAddress || null,
      parentPostalCode: d.parentPostalCode || null,
      parentCity: d.parentCity || null,
      childSameAddress: d.childSameAddress,
      childAddress: d.childAddress || null,
      childPostalCode: d.childPostalCode || null,
      childCity: d.childCity || null,
      peselEnc: d.pesel ? encryptField(d.pesel) : null,
      parentPeselEnc: d.parentPesel ? encryptField(d.parentPesel) : null,
      // Wersja wzoru umowy i skrót pliku wzorca: zapisywane przy wysłaniu (stare zgłoszenia zostają przy swojej wersji).
      ...(submit ? { contractTemplateVersion: UMOWA_TEMPLATE_VERSION, contractTemplateSha256: umowaTemplate().sha256 } : {}),
      healthEnc: encryptField(sensitive),
      selfReturn: d.selfReturn,
      pickupTime: d.pickupTime || null,
      photoConsent: d.photoConsent,
      marketingPhotoConsent: d.marketingPhotoConsent,
      regulaminAcceptedAt: d.regulaminAccepted ? now : null,
      healthConsentAt: d.healthConsent ? now : null,
      draftSavedAt: now,
      formSubmittedAt: submit ? now : undefined,
    },
  });

  // Dziennik nie zawiera treści danych wrażliwych, tylko fakt zdarzenia.
  await logEvent({
    applicationId: app.id,
    actor: "rodzic",
    action: submit ? "form.submitted" : "form.draft_saved",
    note: submit ? "pełny formularz wysłany" : "szkic zapisany",
  });
  if (submit) await ensureCharges(app.id);
  revalidatePath(`/zgloszenie/${token}`);
  revalidatePath(`/zgloszenie/${token}/formularz`);

  return {
    ok: true,
    submitted: submit,
    // Wartości wracają do formularza: React 19 czyści pola po akcji, a bez tego rodzic traciłby wpisane dane.
    values,
    message: submit
      ? "Formularz wysłany. Następny krok (umowa i karta do podpisu) pojawi się po wdrożeniu etapu 2."
      : "Szkic zapisany. Możesz wrócić do formularza przez ten sam link.",
  };
}
