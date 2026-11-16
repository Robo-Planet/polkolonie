import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { applicationByToken } from "@/lib/application-by-token";
import { decryptField } from "@/lib/crypto";
import { formatPlDate } from "@/lib/day";
import { FullForm } from "@/components/FullForm";
import { saveFullForm } from "./actions";

export const metadata: Metadata = { title: "Pełny formularz – RoboPlanet", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function FormularzPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicationByToken(token);
  if (!app) notFound();
  if (!app.emailConfirmedAt) redirect(`/zgloszenie/${token}`);

  const sensitive = app.healthEnc
    ? (JSON.parse(decryptField(app.healthEnc)) as {
        health: Record<string, unknown>;
        pickupPersons: { name: string; phone: string }[];
      })
    : { health: {}, pickupPersons: [] };
  const pesel = app.peselEnc ? decryptField(app.peselEnc) : "";
  const parentPesel = app.parentPeselEnc ? decryptField(app.parentPeselEnc) : "";
  const t = app.turnus;

  if (app.formSubmittedAt) {
    return (
      <main className="page">
        <h1>Formularz wysłany</h1>
        <p>
          Zgłoszenie {app.code}, turnus {t.number} ({formatPlDate(t.startDate)} – {formatPlDate(t.endDate)}).
          Dane są tylko do odczytu. Zmiany zgłoś e-mailem do biura.
        </p>
        <p>PESEL: {pesel ? `***********${pesel.slice(-1)}` : "—"}</p>
        <p><a className="button" href={`/zgloszenie/${token}/karta`}>Podgląd karty (PDF)</a></p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Pełny formularz · {app.code}</h1>
      <p className="lead">
        Wypełnij dane do umowy i karty kwalifikacyjnej. Możesz zapisać szkic i wrócić przez ten sam link.
        Wysłanie wymaga wszystkich pól oznaczonych jako wymagane.
      </p>
      <p><a href={`/zgloszenie/${token}/umowa`}>Podgląd umowy (PDF)</a> · <a href={`/zgloszenie/${token}/karta`}>Podgląd karty kwalifikacyjnej (PDF)</a></p>
      <FullForm
        action={saveFullForm.bind(null, token)}
        minAge={t.minAge}
        defaults={{
          parentFirstName: app.parentFirstName,
          parentLastName: app.parentLastName,
          secondParentName: app.secondParentName ?? "",
          parentPhone: app.parentPhone,
          parentPhoneAlt: app.parentPhoneAlt ?? "",
          parentEmail: app.parentEmail,
          parentAddress: app.parentAddress ?? "",
          parentPostalCode: app.parentPostalCode ?? "",
          parentCity: app.parentCity ?? "",
          childFirstName: app.childFirstName,
          childLastName: app.childLastName ?? "",
          pesel,
          parentPesel,
          childSameAddress: app.childSameAddress ? "on" : "",
          childAddress: app.childAddress ?? "",
          childPostalCode: app.childPostalCode ?? "",
          childCity: app.childCity ?? "",
          selfReturn: app.selfReturn === null ? "" : app.selfReturn ? "tak" : "nie",
          pickupTime: app.pickupTime ?? "",
          photoConsent: app.photoConsent ? "on" : "",
          marketingPhotoConsent: app.marketingPhotoConsent ? "on" : "",
          ...Object.fromEntries(
            Object.entries(sensitive.health).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, v as string]),
          ),
          allergyTypes: JSON.stringify((sensitive.health.allergyTypes as string[] | undefined) ?? []),
          flags: JSON.stringify(Object.fromEntries(
            Object.entries(sensitive.health)
              .filter(([, v]) => typeof v === "boolean" && v)
              .map(([k]) => [k, "on"]),
          )),
          pickupPersons: JSON.stringify(sensitive.pickupPersons),
          regulaminAccepted: app.regulaminAcceptedAt ? "on" : "",
          healthConsent: app.healthConsentAt ? "on" : "",
        }}
      />
    </main>
  );
}
