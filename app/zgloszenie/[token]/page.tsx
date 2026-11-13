import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatPlDate, todayUtc } from "@/lib/day";
import { formatGrosze } from "@/lib/money";
import { hashToken } from "@/lib/tokens";
import { STATUS_LABEL } from "@/lib/status";
import { confirmParentEmail } from "./actions";

export const metadata: Metadata = {
  title: "Zgłoszenie – RoboPlanet",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ZgloszenieTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await prisma.application.findUnique({
    where: { linkTokenHash: hashToken(token) },
    include: { turnus: true },
  });

  if (!app || app.linkExpiresAt < todayUtc()) {
    return (
      <main className="page">
        <h1>Link jest nieaktywny</h1>
        <p>Link do zgłoszenia wygasł albo jest nieprawidłowy. Skontaktuj się z biurem półkolonii.</p>
      </main>
    );
  }

  const t = app.turnus;
  return (
    <main className="page">
      <h1>Zgłoszenie {app.code}</h1>
      <dl className="summary">
        <dt>Turnus</dt>
        <dd>
          {t.number}: {formatPlDate(t.startDate)} – {formatPlDate(t.endDate)}, {t.hoursFrom}–{t.hoursTo}
        </dd>
        <dt>Miejsce</dt>
        <dd>{t.venue}</dd>
        <dt>Cena</dt>
        <dd>
          {formatGrosze(t.priceGrosze - (app.returningParticipant ? t.discountGrosze : 0))}
          {app.returningParticipant ? " (ze zniżką 50 zł)" : ""}
        </dd>
        <dt>Dziecko</dt>
        <dd>{app.childFirstName}</dd>
        <dt>Status</dt>
        <dd>{STATUS_LABEL[app.status]}</dd>
      </dl>

      {app.emailConfirmedAt && !app.formSubmittedAt && (
        <p><a className="button" href={`/zgloszenie/${token}/formularz`}>Uzupełnij pełny formularz</a></p>
      )}

      {!app.emailConfirmedAt ? (
        <form action={confirmParentEmail} className="stack">
          <input type="hidden" name="token" value={token} />
          <p>Potwierdź, że adres {app.parentEmail} jest poprawny.</p>
          <button type="submit">Potwierdzam adres e-mail</button>
        </form>
      ) : (
        <div className="notice success">
          <p>Adres e-mail potwierdzony.</p>
          <p>
            Pełny formularz (dane do umowy i karty kwalifikacyjnej) zostanie udostępniony w kolejnym etapie wdrożenia.
            Do tego czasu zgłoszenie jest widoczne w biurze.
          </p>
        </div>
      )}
    </main>
  );
}
