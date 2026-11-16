import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPlDate } from "@/lib/day";
import { formatGrosze } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/status";

export const dynamic = "force-dynamic";

// Etap 1: podgląd zgłoszenia i dziennik zdarzeń (tylko do odczytu).
export default async function ZgloszenieAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await prisma.application.findUnique({
    where: { id },
    include: { turnus: true, events: { orderBy: { createdAt: "asc" } }, charges: { orderBy: { dueDate: "asc" } } },
  });
  if (!app) notFound();
  const t = app.turnus;

  return (
    <>
      <h1>Zgłoszenie {app.code}</h1>
      <dl className="summary">
        <dt>Status</dt>
        <dd>{STATUS_LABEL[app.status]}</dd>
        <dt>Turnus</dt>
        <dd>{t.number}: {formatPlDate(t.startDate)} – {formatPlDate(t.endDate)}</dd>
        <dt>Cena</dt>
        <dd>{formatGrosze(t.priceGrosze - (app.returningParticipant ? t.discountGrosze : 0))}</dd>
        <dt>Dziecko</dt>
        <dd>{app.childFirstName}</dd>
        <dt>Uczestnik poprzednich edycji</dt>
        <dd>{app.returningParticipant ? "tak" : "nie"}</dd>
        <dt>Rodzic</dt>
        <dd>{app.parentFirstName} {app.parentLastName}</dd>
        <dt>E-mail</dt>
        <dd>{app.parentEmail} {app.emailConfirmedAt ? "(potwierdzony)" : "(niepotwierdzony)"}</dd>
        <dt>Telefon</dt>
        <dd>{app.parentPhone}</dd>
        <dt>Zgoda RODO</dt>
        <dd>{app.rodoConsentAt.toISOString().slice(0, 16).replace("T", " ")} UTC</dd>
      </dl>

      <h2>Należności</h2>
      {app.charges.length === 0 ? (
        <p>Brak należności (formularz nie został wysłany).</p>
      ) : (
        <table>
          <thead><tr><th>Rodzaj</th><th>Kwota</th><th>Termin</th><th>Wpłacono</th></tr></thead>
          <tbody>
            {app.charges.map((c) => (
              <tr key={c.id}>
                <td>{c.kind === "ZALICZKA" ? "kaucja rezerwacyjna" : c.kind === "DOPLATA" ? "dopłata" : "cała kwota"}</td>
                <td>{formatGrosze(c.amountGrosze)}</td>
                <td>{formatPlDate(c.dueDate)}</td>
                <td>{c.paidAt ? `tak (${formatGrosze(c.paidGrosze)})` : `nie (${formatGrosze(c.paidGrosze)})`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Dziennik zdarzeń</h2>
      <ol className="events">
        {app.events.map((ev) => (
          <li key={ev.id}>
            <time dateTime={ev.createdAt.toISOString()}>{ev.createdAt.toISOString().slice(0, 16).replace("T", " ")}</time>{" "}
            <strong>{ev.action}</strong> · {ev.actor}
            {ev.note ? ` · ${ev.note}` : ""}
          </li>
        ))}
      </ol>
    </>
  );
}
