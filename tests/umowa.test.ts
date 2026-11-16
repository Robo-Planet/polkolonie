import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { umowaTemplate, umowaPlaceholders, UMOWA_TEMPLATE_VERSION } from "@/lib/documents/umowa-template";
import { buildUmowaFields, formatPlnAmount, missingFields } from "@/lib/documents/umowa-fields";
import { renderUmowaBlocks, type Block } from "@/lib/documents/umowa-render";
import { buildUmowaPdf } from "@/lib/pdf/umowa";
import { parseDay } from "@/lib/day";

const docsFile = path.join(__dirname, "..", "docs", "umowa-wzor.md");

function blocksText(blocks: Block[]): string {
  return blocks
    .map((b) => (b.type === "table" ? b.rows.map((r) => r.join(" | ")).join("\n") : b.text))
    .join("\n");
}

const input = {
  organizer: {
    name: "ROBOPLANET EVENTS S.C.", street: "ul. Marusarzówny 2/39", postalCode: "80-288", city: "Gdańsk",
    nip: "957-113-76-36", regon: "520143330", representative: "Estera Piotrowska", phone: "791 333 730",
    email: "biuro@roboplanet.pl", bankAccount: "50109025870000000165090761",
  },
  application: {
    code: "RP-Z27-0001", parentFirstName: "Anna", parentLastName: "Kowalska", parentAddress: "ul. Łąkowa 5",
    parentPostalCode: "80-288", parentCity: "Gdańsk", parentPhone: "600123456", parentPhoneAlt: null,
    parentEmail: "anna@example.pl", childFirstName: "Jan", childLastName: "Kowalski", childAddress: null,
    childPostalCode: null, childCity: null, childSameAddress: true, secondParentName: null,
  },
  turnus: { number: "I", season: "Z27", startDate: parseDay("2027-02-01"), endDate: parseDay("2027-02-05"), venue: "ul. Marusarzówny 2/39, 80-288 Gdańsk" },
  parentPesel: "44051401359",
  childPesel: "20231512341",
  childBirthDate: parseDay("2020-03-15"),
  contractDate: parseDay("2026-11-20"),
  late: false,
  totalGrosze: 88000, // 930 zł − zniżka 50 zł (uczestnik poprzedniej edycji)
  depositGrosze: 20000,
};

describe("wzór umowy v5", () => {
  it("kopia w lib/templates jest identyczna z docs/umowa-wzor.md", () => {
    const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
    expect(sha(readFileSync(docsFile))).toBe(umowaTemplate().sha256);
    expect(UMOWA_TEMPLATE_VERSION).toBe(5);
  });

  it("paragrafy przechodzą do dokumentu dosłownie (bez zmian treści)", () => {
    const text = blocksText(renderUmowaBlocks(buildUmowaFields(input), { late: false }));
    for (const sentence of [
      "Organizator zobowiązuje się do zachowania tajemnicy danych osobowych powierzonych mu w związku z wykonywaniem niniejszej umowy, a w szczególności do tego, że nie będzie w okresie obowiązywania i po jej rozwiązaniu: przekazywać, wykorzystywać lub ujawniać danych uzyskanych od osoby zawierającej umowę osobom nieupoważnionym, które nie są stroną niniejszej umowy.",
      "W sprawach nieuregulowanych niniejszą Umową zastosowanie mają przepisy Kodeksu Cywilnego.",
      "W przypadku niedojścia półkolonii do skutku z przyczyn niezależnych od Organizatora, każdy uczestnik otrzymuje zwrot całości wpłaconej kwoty (wraz z kaucją rezerwacyjną) bez odsetek.",
      "Osoba zawierająca umowę wyraża zgodę, aby w trakcie trwania półkolonii wychowawca półkolonijny wykonywał zdjęcia uczestnikowi biorącemu udział w półkolonii. Wykonane zdjęcia mogą być wykorzystywane przez firmę ROBOPLANET EVENTS S.C. do celów marketingowych.",
    ]) {
      expect(text).toContain(sentence);
    }
  });

  it("wszystkie pola wzoru są wypełnione i nie zostają znaczniki", () => {
    const fields = buildUmowaFields(input);
    expect(missingFields(fields)).toEqual([]);
    expect(umowaPlaceholders(umowaTemplate().raw).length).toBeGreaterThan(20);
    const text = blocksText(renderUmowaBlocks(fields, { late: false }));
    expect(text).not.toMatch(/\{\{|<!--/);
  });

  it("wariant standardowy: kaucja w 7 dni, dopłata 14 dni przed startem, bez wariantu późnego", () => {
    const text = blocksText(renderUmowaBlocks(buildUmowaFields(input), { late: false }));
    expect(text).toContain("kaucja rezerwacyjna (200 zł) do 27.11.2026");
    expect(text).toContain("Pozostała część ceny uczestnictwa (680 zł) płatna jest do 18.01.2027");
    expect(text).not.toContain("Termin wpłaty ceny uczestnictwa: całość");
    expect(text).not.toContain("[wariant");
  });

  it("wariant późny zapis: cała cena w 3 dni, bez kaucji", () => {
    const late = { ...input, contractDate: parseDay("2027-01-25"), late: true };
    const text = blocksText(renderUmowaBlocks(buildUmowaFields(late), { late: true }));
    expect(text).toContain("całość ceny uczestnictwa (880 zł) do 28.01.2027");
    expect(text).not.toContain("kaucja rezerwacyjna (");
  });

  it("kwoty: cena ze zniżką 880 zł, dopłata 680 zł, zaliczka 200 zł", () => {
    const f = buildUmowaFields(input);
    expect(f.cena).toBe("880");
    expect(f.kaucja).toBe("200");
    expect(f.doplata).toBe("680");
    expect(formatPlnAmount(88050)).toBe("880,50");
  });

  it("tytuł przelewu z kodem zgłoszenia i numer konta organizatora", () => {
    const text = blocksText(renderUmowaBlocks(buildUmowaFields(input), { late: false }));
    expect(text).toContain("Tytuł przelewu: RP-Z27-0001 Jan Kowalski");
    expect(text).toContain("50 1090 2587 0000 0001 6509 0761");
    expect(text).toContain("Estera Piotrowska");
  });

  it("generuje PDF z wszystkimi blokami", async () => {
    const blocks = renderUmowaBlocks(buildUmowaFields(input), { late: false });
    const bytes = await buildUmowaPdf(blocks, "test");
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
