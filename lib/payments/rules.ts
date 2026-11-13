import type { ChargeKind } from "@/lib/generated/prisma/enums";
import { addDays, daysBetween } from "@/lib/day";

// Czysta logika płatności (bez bazy): plan należności i przypisanie wpłaty do należności.
// Specyfikacja, sekcja „Płatności”: zaliczka 7 dni od umowy, dopłata 14 dni przed startem,
// zapis później niż 14 dni przed startem – cała kwota w 3 dni.

export const KIND_ORDER: ChargeKind[] = ["ZALICZKA", "CALOSC", "DOPLATA"];

export type PlannedCharge = { kind: ChargeKind; amountGrosze: number; dueDate: Date };

export function planCharges(input: {
  priceGrosze: number;
  discountGrosze: number;
  returning: boolean;
  depositGrosze: number;
  startDate: Date;
  contractDate: Date;
}): PlannedCharge[] {
  const total = input.priceGrosze - (input.returning ? input.discountGrosze : 0);
  const late = daysBetween(input.contractDate, input.startDate) < 14;
  if (late) {
    return [{ kind: "CALOSC", amountGrosze: total, dueDate: addDays(input.contractDate, 3) }];
  }
  const deposit = Math.min(input.depositGrosze, total);
  return [
    { kind: "ZALICZKA", amountGrosze: deposit, dueDate: addDays(input.contractDate, 7) },
    { kind: "DOPLATA", amountGrosze: total - deposit, dueDate: addDays(input.startDate, -14) },
  ];
}

export type OpenCharge = { id: string; kind: ChargeKind; remainingGrosze: number };

/** Rozdziela kwotę wpłaty na należności w kolejności: zaliczka, całość, dopłata. Reszta = nadpłata. */
export function allocateAmount(
  amountGrosze: number,
  charges: OpenCharge[],
): { allocations: { chargeId: string; amountGrosze: number }[]; leftoverGrosze: number } {
  let left = amountGrosze;
  const allocations: { chargeId: string; amountGrosze: number }[] = [];
  const ordered = [...charges].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  for (const c of ordered) {
    if (left <= 0) break;
    if (c.remainingGrosze <= 0) continue;
    const pay = Math.min(left, c.remainingGrosze);
    allocations.push({ chargeId: c.id, amountGrosze: pay });
    left -= pay;
  }
  return { allocations, leftoverGrosze: left };
}

/** Kod zgłoszenia z tytułu przelewu (bez względu na wielkość liter i spacje). */
export function extractApplicationCode(title: string): string | null {
  const m = /RP\s*-\s*[A-Z0-9]{2,6}\s*-\s*\d{4,}/i.exec(title);
  return m ? m[0].replace(/\s/g, "").toUpperCase() : null;
}
