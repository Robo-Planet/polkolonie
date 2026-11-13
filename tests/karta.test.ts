import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildKartaPdf, healthNarrative, type KartaData } from "@/lib/pdf/karta";
import { parseDay } from "@/lib/day";

const health: KartaData["health"] = {
  specialNeeds: "", allergies: "orzechy", allergyTypes: ["pokarm"], chronic: "", motionSickness: true,
  medications: "", glassesOrBraces: "okulary", diet: "wegetariańska", emotions: "", heightFear: true,
  waterFear: false, otherInfo: "", vaccinations: "tężec 2020",
};

const data: KartaData = {
  code: "RP-Z27-0001",
  turnus: { number: "I", startDate: parseDay("2027-02-01"), endDate: parseDay("2027-02-05"), venue: "ul. Marusarzówny 2/39, 80-288 Gdańsk" },
  child: { firstName: "Jan", lastName: "Żółć", birthYear: 2020, pesel: "20231512341", address: "ul. Łąkowa 5", postal: "80-288", city: "Gdańsk" },
  parents: { names: "Anna Nowak, Piotr Nowak", address: "ul. Łąkowa 5", postal: "80-288", city: "Gdańsk", phones: "600123456" },
  health,
};

describe("karta kwalifikacyjna (PDF)", () => {
  it("opis punktu II.9 zawiera uczulenia, lokomocję, dietę i lęk wysokości", () => {
    const text = healthNarrative(health);
    expect(text).toContain("uczulenia (pokarmy): orzechy");
    expect(text).toContain("choroba lokomocyjna");
    expect(text).toContain("dieta: wegetariańska");
    expect(text).toContain("lęk wysokości");
    expect(text).not.toContain("hydrofobia");
  });

  it("buduje poprawny PDF z częściami I–III", async () => {
    const bytes = await buildKartaPdf(data);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("dla pustego zdrowia zapisuje „brak istotnych informacji”", () => {
    const empty = { ...health, allergies: "", allergyTypes: [], motionSickness: false, glassesOrBraces: "", diet: "", heightFear: false, vaccinations: "" };
    expect(healthNarrative(empty)).toBe("brak istotnych informacji.");
  });
});
