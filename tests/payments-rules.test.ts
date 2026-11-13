import { describe, expect, it } from "vitest";
import { allocateAmount, extractApplicationCode, planCharges } from "@/lib/payments/rules";
import { parseDay, formatDay } from "@/lib/day";

const base = { priceGrosze: 93000, discountGrosze: 5000, depositGrosze: 20000, startDate: parseDay("2027-02-01") };

describe("plan należności", () => {
  it("standard: zaliczka 200 zł w 7 dni, dopłata 730 zł w 14 dni przed startem", () => {
    const plan = planCharges({ ...base, returning: false, contractDate: parseDay("2026-11-20") });
    expect(plan.map((p) => [p.kind, p.amountGrosze, formatDay(p.dueDate)])).toEqual([
      ["ZALICZKA", 20000, "2026-11-27"],
      ["DOPLATA", 73000, "2027-01-18"],
    ]);
  });
  it("zniżka 50 zł dla uczestników poprzednich edycji: dopłata 680 zł", () => {
    const plan = planCharges({ ...base, returning: true, contractDate: parseDay("2026-11-20") });
    expect(plan.find((p) => p.kind === "DOPLATA")?.amountGrosze).toBe(68000);
  });
  it("późny zapis (mniej niż 14 dni przed startem): cała kwota w 3 dni", () => {
    const plan = planCharges({ ...base, returning: false, contractDate: parseDay("2027-01-25") });
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe("CALOSC");
    expect(plan[0].amountGrosze).toBe(93000);
    expect(formatDay(plan[0].dueDate)).toBe("2027-01-28");
  });
});

describe("przypisanie wpłaty", () => {
  const charges = [
    { id: "d", kind: "DOPLATA" as const, remainingGrosze: 73000 },
    { id: "z", kind: "ZALICZKA" as const, remainingGrosze: 20000 },
  ];
  it("najpierw zaliczka, potem dopłata", () => {
    const r = allocateAmount(25000, charges);
    expect(r.allocations).toEqual([{ chargeId: "z", amountGrosze: 20000 }, { chargeId: "d", amountGrosze: 5000 }]);
    expect(r.leftoverGrosze).toBe(0);
  });
  it("nadpłata zostaje jako reszta", () => {
    const r = allocateAmount(30000, [{ id: "z", kind: "ZALICZKA", remainingGrosze: 20000 }]);
    expect(r.leftoverGrosze).toBe(10000);
  });
  it("wpłata 1 zł przypisuje się częściowo", () => {
    const r = allocateAmount(100, charges);
    expect(r.allocations).toEqual([{ chargeId: "z", amountGrosze: 100 }]);
  });
});

describe("kod zgłoszenia w tytule", () => {
  it("znajduje kod niezależnie od wielkości liter i spacji", () => {
    expect(extractApplicationCode("RP-Z27-0142 Jan Nowak")).toBe("RP-Z27-0142");
    expect(extractApplicationCode("rp - z27 - 0142")).toBe("RP-Z27-0142");
    expect(extractApplicationCode("przelew")).toBeNull();
  });
});
