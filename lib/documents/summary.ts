import { formatPlDate } from "@/lib/day";
import { formatGrosze } from "@/lib/money";
import { planCharges } from "@/lib/payments/rules";

// Ekran podsumowania przed podpisem (specyfikacja, krok 3 zapisu). Kwoty i terminy z tych samych reguł,
// co należności i umowa. Informacja o braku prawa odstąpienia jest podana wprost (art. 38 ust. 1 pkt 12).

export type SummaryInput = {
  priceGrosze: number; // cena turnusu przed zniżką
  discountGrosze: number;
  returning: boolean;
  depositGrosze: number;
  startDate: Date;
  contractDate: Date;
  turnusNumber: string;
  organizer: { name: string; street: string; postalCode: string; city: string; nip: string; phone: string | null; email: string | null };
};

export type Summary = { heading: string; items: string[]; total: string };

export function buildSummary(i: SummaryInput): Summary {
  const discount = i.returning ? i.discountGrosze : 0;
  const total = i.priceGrosze - discount;
  const plan = planCharges({
    priceGrosze: i.priceGrosze,
    discountGrosze: i.discountGrosze,
    returning: i.returning,
    depositGrosze: i.depositGrosze,
    startDate: i.startDate,
    contractDate: i.contractDate,
  });
  const items: string[] = [
    `Cena turnusu ${i.turnusNumber}: ${formatGrosze(i.priceGrosze)}.`,
  ];
  if (discount > 0) items.push(`Zniżka dla uczestnika poprzedniej edycji: −${formatGrosze(discount)}.`);
  items.push(`Cena do zapłaty: ${formatGrosze(total)}.`);

  const deposit = plan.find((p) => p.kind === "ZALICZKA" || p.kind === "CALOSC");
  const doplata = plan.find((p) => p.kind === "DOPLATA");
  if (doplata) {
    items.push(`Kaucja rezerwacyjna: ${formatGrosze(i.depositGrosze)}, do ${formatPlDate(plan.find((p) => p.kind === "ZALICZKA")!.dueDate)}. Jest wliczana w cenę.`);
    items.push(`Dopłata: ${formatGrosze(doplata.amountGrosze)}, do ${formatPlDate(doplata.dueDate)} (14 dni przed startem).`);
  } else {
    items.push(`Zapis później niż 14 dni przed startem: całość ${formatGrosze(deposit!.amountGrosze)} do ${formatPlDate(deposit!.dueDate)}.`);
  }
  items.push("Brak terminowej wpłaty kaucji rezerwacyjnej oznacza anulowanie zgłoszenia (§ 1 ust. 2 umowy).");
  items.push(
    `Rezygnacja po terminie dopłaty, po wpłacie całości i przed startem: zwrot 50% ceny, czyli ${formatGrosze(Math.round(total / 2))} (§ 2 ust. 1). ` +
      "Po rozpoczęciu turnusu zwrot nie przysługuje (§ 2 ust. 2). Rezygnację zgłasza się e-mailem. Rezygnacja przed terminem dopłaty: kwotę zwrotu ustala biuro.",
  );
  items.push("Gdy półkolonia nie dojdzie do skutku z przyczyn niezależnych od Organizatora, otrzymasz zwrot całości wpłat (§ 3 ust. 1).");
  items.push("Ustawowe prawo odstąpienia od umowy w ciągu 14 dni nie przysługuje (art. 38 ust. 1 pkt 12 ustawy o prawach konsumenta).");
  const o = i.organizer;
  items.push(
    `Organizator: ${o.name}, ${o.street}, ${o.postalCode} ${o.city}, NIP ${o.nip}.` +
      (o.phone ? ` Telefon: ${o.phone}.` : "") +
      (o.email ? ` E-mail: ${o.email}.` : ""),
  );
  items.push(
    "Reklamacje składa się e-mailem na adres biura. Biuro odpowiada e-mailem.",
  );
  return {
    heading: "Podsumowanie przed podpisem",
    items,
    total: formatGrosze(total),
  };
}
