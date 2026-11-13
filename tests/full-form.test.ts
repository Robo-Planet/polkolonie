import { describe, expect, it } from "vitest";
import { birthDateFromPesel } from "@/lib/pesel";
import { isValidPesel } from "@/lib/validators";
import { parseFullForm } from "@/lib/full-form";
import { parseDay } from "@/lib/day";

// Buduje poprawny PESEL z 10 cyfr (liczy sumę kontrolną).
function makePesel(first10: string): string {
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const sum = w.reduce((a, x, i) => a + x * Number(first10[i]), 0);
  return first10 + String((10 - (sum % 10)) % 10);
}

const START = parseDay("2027-02-01");
const OPTS = { turnusStart: START, minAge: 6 };

const complete = {
  parentFirstName: "Anna", parentLastName: "Nowak", parentAddress: "ul. Testowa 1", parentPostalCode: "80-288",
  parentCity: "Gdańsk", parentPhone: "600123456", childFirstName: "Jan", childLastName: "Nowak",
  pesel: makePesel("2023151234"), // 2020-03-15 -> 6 lat w dniu 1.02.2027
  selfReturn: "nie", pickupTime: "16:30",
};
const flagsOk = { regulaminAccepted: true, healthConsent: true, childSameAddress: true };

describe("PESEL", () => {
  it("wyznacza datę urodzenia z kodowaniem stulecia", () => {
    expect(birthDateFromPesel(makePesel("2023151234"))?.toISOString()).toBe("2020-03-15T00:00:00.000Z");
    expect(birthDateFromPesel(makePesel("0025151234"))?.toISOString()).toBe("2000-05-15T00:00:00.000Z");
  });
  it("odrzuca niepoprawną sumę kontrolną i nieistniejący miesiąc", () => {
    expect(isValidPesel("44051401358")).toBe(false);
    expect(birthDateFromPesel("00130112340")).toBeNull();
  });
});

describe("pełny formularz – wiek i wymagane pola", () => {
  it("dziecko 6-letnie przechodzi walidację wieku", () => {
    const r = parseFullForm(complete, flagsOk, { final: true, ...OPTS });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.birthDate?.toISOString()).toBe("2020-03-15T00:00:00.000Z");
  });
  it("dziecko 5-letnie jest blokowane (min. 6 lat)", () => {
    const young = { ...complete, pesel: makePesel("2123151234") }; // 2021-03-15 -> 5 lat w dniu 1.02.2027
    const r = parseFullForm(young, flagsOk, { final: true, ...OPTS });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.pesel).toContain("co najmniej 6 lat");
  });
  it("wysłanie wymaga zgód i wszystkich pól obowiązkowych", () => {
    const r = parseFullForm({ ...complete, pickupTime: "" }, { childSameAddress: true }, { final: true, ...OPTS });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.regulaminAccepted).toBeTruthy();
      expect(r.fieldErrors.healthConsent).toBeTruthy();
      expect(r.fieldErrors.pickupTime).toBeTruthy();
    }
  });
  it("szkic przyjmuje niepełne dane, ale odrzuca błędny format", () => {
    expect(parseFullForm({ childFirstName: "Jan" }, {}, { final: false, ...OPTS }).ok).toBe(true);
    expect(parseFullForm({ ...complete, parentPostalCode: "80288" }, {}, { final: false, ...OPTS }).ok).toBe(false);
  });
  it("adres dziecka jest wymagany, gdy nie jest taki sam jak rodziców", () => {
    const r = parseFullForm(complete, { regulaminAccepted: true, healthConsent: true }, { final: true, ...OPTS });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.childAddress).toBeTruthy();
  });
});
