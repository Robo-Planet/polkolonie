import { prisma } from "@/lib/db";
import { formatPlDate } from "@/lib/day";
import { formatGrosze } from "@/lib/money";
import { AssignPaymentForm } from "@/components/AssignPaymentForm";

export const dynamic = "force-dynamic";

// „Do wyjaśnienia”: wpływy bez dopasowania albo tylko częściowo przypisane.
export default async function WplatyPage() {
  const txs = await prisma.bankTransaction.findMany({
    where: { matchStatus: { in: ["UNMATCHED", "PARTIAL"] } },
    orderBy: { bookedAt: "desc" },
  });
  return (
    <>
      <h1>Do wyjaśnienia</h1>
      <p>Wpływy bez kodu zgłoszenia w tytule albo tylko częściowo przypisane.</p>
      {txs.length === 0 ? (
        <p>Brak wpływów do wyjaśnienia.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Kwota</th>
              <th>Tytuł</th>
              <th>Nadawca</th>
              <th>Status</th>
              <th>Przypisz do kodu</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.id}>
                <td>{formatPlDate(t.bookedAt)}</td>
                <td>{formatGrosze(t.amountGrosze)}</td>
                <td>{t.title}</td>
                <td>{t.senderName}</td>
                <td>{t.matchStatus === "PARTIAL" ? "częściowo" : "brak kodu"}</td>
                <td><AssignPaymentForm transactionId={t.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
