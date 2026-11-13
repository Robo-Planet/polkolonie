import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatPlDate, todayUtc } from "@/lib/day";
import { formatGrosze } from "@/lib/money";
import { seatsTaken } from "@/lib/places";
import { ShortApplicationForm } from "@/components/ShortApplicationForm";

export const metadata: Metadata = {
  title: "Zapis na półkolonie – RoboPlanet",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ZapisPage() {
  const turnusy = await prisma.turnus.findMany({
    where: { active: true, startDate: { gte: todayUtc() } },
    orderBy: { startDate: "asc" },
  });
  const options = await Promise.all(
    turnusy.map(async (t) => {
      const taken = await seatsTaken(t.id);
      return {
        id: t.id,
        label: `Turnus ${t.number}: ${formatPlDate(t.startDate)} – ${formatPlDate(t.endDate)}`,
        seatsLeft: Math.max(0, t.placeLimit - taken),
        placeLimit: t.placeLimit,
        price: formatGrosze(t.priceGrosze),
      };
    }),
  );

  return (
    <main className="page">
      <h1>Zapis na półkolonie zimowe</h1>
      {options.length === 0 ? (
        <p>Obecnie nie ma otwartych turnusów. Zapraszamy wkrótce.</p>
      ) : (
        <>
          <p className="lead">
            Wypełnij krótkie zgłoszenie. Na e-mail przyślemy link do dokończenia umowy i karty kwalifikacyjnej.
            Miejsce zostaje zarezerwowane po wpłacie zaliczki.
          </p>
          <ul className="turnusy">
            {options.map((o) => (
              <li key={o.id}>
                <strong>{o.label}</strong> · cena {o.price} · zostało {o.seatsLeft} z {o.placeLimit} miejsc
              </li>
            ))}
          </ul>
          <ShortApplicationForm turnusy={options} />
        </>
      )}
    </main>
  );
}
