import { prisma } from "@/lib/db";
import { formatPlDate } from "@/lib/day";
import { formatGrosze } from "@/lib/money";
import { overdueDeposits } from "@/lib/payments/cancel";
import { AssignPaymentForm } from "@/components/AssignPaymentForm";
import { cancelApplication } from "./cancel-actions";

export const dynamic = "force-dynamic";

// „Do wyjaśnienia”: kaucja po terminie (do anulowania przez biuro), wpływy bez dopasowania.
export default async function WplatyPage() {
  const [overdue, txs] = await Promise.all([
    overdueDeposits(),
    prisma.bankTransaction.findMany({
      where: { matchStatus: { in: ["UNMATCHED", "PARTIAL"] } },
      orderBy: { bookedAt: "desc" },
    }),
  ]);
  return (
    <>
      <h1>Do wyjaśnienia</h1>

      <h2>Kaucja nie wpłynęła w terminie</h2>
      <p>Zgodnie z § 1 ust. 2 umowy brak terminowej kaucji oznacza anulowanie. Anulowanie wykonuje biuro.</p>
      {overdue.length === 0 ? (
        <p>Brak zgłoszeń po terminie kaucji.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Termin kaucji</th>
              <th>Dni po terminie</th>
              <th>Decyzja</th>
            </tr>
          </thead>
          <tbody>
            {overdue.map((o) => (
              <tr key={o.applicationId}>
                <td>{o.code}</td>
                <td>{formatPlDate(o.depositDue)}</td>
                <td>{o.daysOverdue}</td>
                <td>
                  <form action={cancelApplication.bind(null, o.applicationId)}>
                    <button type="submit" className="secondary">Anuluj zgłoszenie</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Wpływy bez dopasowania</h2>
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
