import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { applicationByToken } from "@/lib/application-by-token";
import { formatPlDate } from "@/lib/day";
import { SignatureForm } from "@/components/SignatureForm";
import { sendSignCode, signWithScreen } from "./actions";

export const metadata: Metadata = { title: "Podpis umowy – RoboPlanet", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PodpisPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicationByToken(token);
  if (!app) notFound();
  if (!app.emailConfirmedAt) redirect(`/zgloszenie/${token}`);

  if (app.contractSignedAt) {
    return (
      <main className="page">
        <h1>Umowa zawarta</h1>
        <p>Zgłoszenie {app.code} · zawarta {formatPlDate(app.contractSignedAt)}.</p>
        <p><a className="button" href={`/zgloszenie/${token}/umowa-podpisana`}>Pobierz podpisaną umowę (PDF)</a></p>
      </main>
    );
  }
  if (!app.formSubmittedAt) {
    return (
      <main className="page">
        <h1>Najpierw formularz</h1>
        <p>Przed podpisem wypełnij pełny formularz.</p>
        <p><a className="button" href={`/zgloszenie/${token}/formularz`}>Przejdź do formularza</a></p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Podpis umowy · {app.code}</h1>
      <p className="lead">
        Przeczytaj umowę przed podpisem: <a href={`/zgloszenie/${token}/umowa`}>podgląd umowy (PDF)</a>.
        Podpis na ekranie wymaga kodu z e-maila. Dzień podpisu staje się datą zawarcia umowy.
      </p>
      <SignatureForm sendCode={sendSignCode.bind(null, token)} signAction={signWithScreen.bind(null, token)} />
    </main>
  );
}
