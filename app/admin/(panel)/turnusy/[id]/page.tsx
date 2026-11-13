import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDay, formatPlDate } from "@/lib/day";
import { formatGrosze } from "@/lib/money";
import { seatsTaken } from "@/lib/places";
import { STATUS_LABEL } from "@/lib/status";
import { TurnusForm } from "@/components/TurnusForm";
import { updateTurnus } from "./../actions";

export const dynamic = "force-dynamic";

export default async function TurnusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await prisma.turnus.findUnique({ where: { id } });
  if (!t) notFound();

  const [apps, taken] = await Promise.all([
    prisma.application.findMany({ where: { turnusId: id }, orderBy: { createdAt: "asc" } }),
    seatsTaken(id),
  ]);

  return (
    <>
      <h1>Turnus {t.number} · sezon {t.season}</h1>
      <p>
        {formatPlDate(t.startDate)} – {formatPlDate(t.endDate)} · zajęte miejsca: {taken} z {t.placeLimit} · cena {formatGrosze(t.priceGrosze)}
      </p>

      <h2>Dane turnusu</h2>
      <TurnusForm
        action={updateTurnus.bind(null, id)}
        defaults={{
          number: t.number,
          season: t.season,
          startDate: formatDay(t.startDate),
          endDate: formatDay(t.endDate),
          hoursFrom: t.hoursFrom,
          hoursTo: t.hoursTo,
          venue: t.venue,
          placeLimit: String(t.placeLimit),
          minAge: String(t.minAge),
          price: String(t.priceGrosze / 100),
          deposit: String(t.depositGrosze / 100),
          discount: String(t.discountGrosze / 100),
          active: t.active ? "on" : "",
        }}
      />

      <h2>Zgłoszenia ({apps.length})</h2>
      {apps.length === 0 ? (
        <p>Brak zgłoszeń na ten turnus.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Dziecko</th>
              <th>Rodzic</th>
              <th>Telefon</th>
              <th>Status</th>
              <th>E-mail potwierdzony</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <td><Link href={`/admin/zgloszenia/${a.id}`}>{a.code}</Link></td>
                <td>{a.childFirstName}</td>
                <td>{a.parentFirstName} {a.parentLastName}</td>
                <td>{a.parentPhone}</td>
                <td>{STATUS_LABEL[a.status]}</td>
                <td>{a.emailConfirmedAt ? "tak" : "nie"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
