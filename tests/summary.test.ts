import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildSummary } from "@/lib/documents/summary";
import { buildKartaPdf, type KartaData } from "@/lib/pdf/karta";
import { parseDay } from "@/lib/day";

const org = { name: "ROBOPLANET EVENTS S.C.", street: "ul. Marusarzówny 2/39", postalCode: "80-288", city: "Gdańsk", nip: "957-113-76-36", phone: "791 333 730", email: "biuro@roboplanet.pl" };
const base = { priceGrosze: 93000, discountGrosze: 5000, depositGrosze: 20000, startDate: parseDay("2027-02-01"), turnusNumber: "I", organizer: org };

describe("podsumowanie przed podpisem", () => {
  it("standard: kaucja 200 zł do 27.11.2026, dopłata 730 zł do 18.01.2027, zwrot 465 zł", () => {
    const s = buildSummary({ ...base, returning: false, contractDate: parseDay("2026-11-20") });
    const text = s.items.join("\n").replace(/\s/g, " ");
    expect(text).toContain("Kaucja rezerwacyjna: 200,00 zł, do 27 listopada 2026");
    expect(text).toContain("Dopłata: 730,00 zł, do 18 stycznia 2027");
    expect(text).toContain("zwrot 50% ceny, czyli 465,00 zł");
    expect(text).toContain("art. 38 ust. 1 pkt 12");
    expect(s.total.replace(/\s/g, " ")).toBe("930,00 zł");
  });
  it("zniżka dla uczestnika poprzedniej edycji: do zapłaty 880 zł, dopłata 680 zł, zwrot 440 zł", () => {
    const s = buildSummary({ ...base, returning: true, contractDate: parseDay("2026-11-20") });
    const text = s.items.join("\n").replace(/\s/g, " ");
    expect(text).toContain("Zniżka dla uczestnika poprzedniej edycji: −50,00 zł");
    expect(text).toContain("Dopłata: 680,00 zł");
    expect(text).toContain("czyli 440,00 zł");
    expect(s.total.replace(/\s/g, " ")).toBe("880,00 zł");
  });
  it("późny zapis: cała kwota w 3 dni, bez dopłaty", () => {
    const s = buildSummary({ ...base, returning: false, contractDate: parseDay("2027-01-25") });
    const text = s.items.join("\n").replace(/\s/g, " ");
    expect(text).toContain("całość 930,00 zł do 28 stycznia 2027");
    expect(text).not.toContain("Dopłata:");
  });
});

describe("karta z podpisem rodzica", () => {
  it("generuje PDF z obrazem podpisu w części II", async () => {
    // Minimalny poprawny PNG 1×1 (przezroczysty).
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    const data: KartaData = {
      code: "RP-Z27-0001",
      turnus: { number: "I", startDate: parseDay("2027-02-01"), endDate: parseDay("2027-02-05"), venue: "ul. Marusarzówny 2/39" },
      child: { firstName: "Jan", lastName: "Kowalski", birthYear: 2020, pesel: "20231512341", address: "ul. Łąkowa 5", postal: "80-288", city: "Gdańsk" },
      parents: { names: "Anna Kowalska", address: "ul. Łąkowa 5", postal: "80-288", city: "Gdańsk", phones: "600123456" },
      health: { specialNeeds: "", allergies: "", allergyTypes: [], chronic: "", motionSickness: false, medications: "", glassesOrBraces: "", diet: "", emotions: "", heightFear: false, waterFear: false, otherInfo: "", vaccinations: "" },
    };
    const bytes = await buildKartaPdf(data, { signaturePng: png });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
