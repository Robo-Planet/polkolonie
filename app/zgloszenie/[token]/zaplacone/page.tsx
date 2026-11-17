import type { Metadata } from "next";
import { applicationByPaymentToken } from "@/lib/payments/reported";
import { reportPaymentByToken } from "./actions";

export const metadata: Metadata = { title: "Zgłoszenie wpłaty – RoboPlanet", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ZaplaconePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { token } = await params;
  const { sent } = await searchParams;
  const app = await applicationByPaymentToken(token);
  if (!app) {
    return (
      <main className="page">
        <h1>Link jest nieaktywny</h1>
        <p>Skontaktuj się z biurem półkolonii.</p>
      </main>
    );
  }
  if (sent) {
    return (
      <main className="page">
        <h1>Dziękujemy</h1>
        <p>Zapisaliśmy zgłoszenie wpłaty za {app.code}. Biuro sprawdzi wpływ na konto; przypomnienia wstrzymają się na 3 dni robocze.</p>
      </main>
    );
  }
  return (
    <main className="page">
      <h1>Zgłoszenie wpłaty · {app.code}</h1>
      <p>
        Kliknij, jeśli wykonałeś przelew. Przypomnienia o wpłacie wstrzymają się na 3 dni robocze, a biuro sprawdzi wpływ
        na konto (tytuł przelewu: {app.code} {app.childFirstName}).
      </p>
      <form action={reportPaymentByToken.bind(null, token)}>
        <button type="submit">Już zapłaciłem</button>
      </form>
    </main>
  );
}
