import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPlDate } from "@/lib/day";
import { formatGrosze } from "@/lib/money";
import { seatsTaken } from "@/lib/places";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const turnusy = await prisma.turnus.findMany({ orderBy: [{ season: "asc" }, { startDate: "asc" }] });
  const rows = await Promise.all(
    turnusy.map(async (t) => ({
      t,
      taken: await seatsTaken(t.id),
      zgloszenia: await prisma.application.count({ where: { turnusId: t.id } }),
    })),
  );

  return (
    <>
      <div className="toolbar">
        <h1>Turnusy</h1>
        <Link className="button" href="/admin/turnusy/nowy">Nowy turnus</Link>
      </div>
      {rows.length === 0 ? (
        <p>Brak turnusów. Dodaj pierwszy turnus.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Sezon</th>
              <th>Turnus</th>
              <th>Termin</th>
              <th>Cena</th>
              <th>Miejsca (zajęte / limit)</th>
              <th>Zgłoszenia</th>
              <th>Przyjmuje</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, taken, zgloszenia }) => (
              <tr key={t.id}>
                <td>{t.season}</td>
                <td><Link href={`/admin/turnusy/${t.id}`}>{t.number}</Link></td>
                <td>{formatPlDate(t.startDate)} – {formatPlDate(t.endDate)}</td>
                <td>{formatGrosze(t.priceGrosze)}</td>
                <td>{taken} / {t.placeLimit}</td>
                <td>{zgloszenia}</td>
                <td>{t.active ? "tak" : "nie"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
