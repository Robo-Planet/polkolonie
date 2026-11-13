import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDay, formatPlDate, fullYearsBetween, parseDay } from "@/lib/day";
import { formatGrosze, parsePlnToGrosze } from "@/lib/money";
import { isValidNip, isValidPesel, normalizePhone, isValidTime, isValidPostalCode } from "@/lib/validators";
import { CODE_PATTERN } from "@/lib/codes";
import { holdsPlace, isClosed } from "@/lib/status";
import { decryptField, encryptField, sha256Hex } from "@/lib/crypto";
import { newTotpSecret, totpUri, verifyTotp } from "@/lib/totp";
import { hashToken, newToken } from "@/lib/tokens";
import { schemaSafe } from "./helpers";
import { shortApplicationSchema, turnusSchema } from "@/lib/schemas";
import * as OTPAuth from "otpauth";

describe("daty (północ UTC)", () => {
  it("parsuje dzień jako północ UTC", () => {
    expect(parseDay("2027-02-01").toISOString()).toBe("2027-02-01T00:00:00.000Z");
    expect(formatDay(parseDay("2027-02-08"))).toBe("2027-02-08");
  });
  it("odrzuca niepoprawne i nieistniejące daty", () => {
    expect(() => parseDay("2027-02-30")).toThrow();
    expect(() => parseDay("01.02.2027")).toThrow();
  });
  it("liczy dni i dodaje dni bez przesunięć strefą", () => {
    const start = parseDay("2027-01-25");
    expect(daysBetween(parseDay("2027-01-18"), start)).toBe(7);
    expect(formatDay(addDays(start, 3))).toBe("2027-01-28");
  });
  it("formatuje datę po polsku", () => {
    expect(formatPlDate(parseDay("2027-02-01"))).toBe("1 lutego 2027");
  });
  it("wylicza pełne lata do minimalnego wieku 5 lat", () => {
    const birth = parseDay("2021-02-02");
    expect(fullYearsBetween(birth, parseDay("2027-02-01"))).toBe(5); // dzień przed 6. urodzinami
    expect(fullYearsBetween(birth, parseDay("2027-02-02"))).toBe(6);
  });
});

describe("kwoty w groszach", () => {
  it("zamienia kwoty wejściowe na grosze", () => {
    expect(parsePlnToGrosze("920")).toBe(92000);
    expect(parsePlnToGrosze("920,50")).toBe(92050);
    expect(parsePlnToGrosze("200.5")).toBe(20050);
    expect(() => parsePlnToGrosze("abc")).toThrow();
    expect(() => parsePlnToGrosze("-5")).toThrow();
  });
  it("formatuje grosze jako złote", () => {
    expect(formatGrosze(92000)).toMatch(/920,00\s?zł/);
  });
});

describe("walidacje", () => {
  it("NIP z specyfikacji jest poprawny; zmieniona cyfra nie", () => {
    expect(isValidNip("957-113-76-36")).toBe(true);
    expect(isValidNip("957-113-76-37")).toBe(false);
  });
  it("PESEL z sumą kontrolną", () => {
    expect(isValidPesel("44051401359")).toBe(true);
    expect(isValidPesel("44051401358")).toBe(false);
    expect(isValidPesel("4405140135")).toBe(false);
  });
  it("telefon: 9 cyfr z opcjonalnym +48", () => {
    expect(normalizePhone("600 123 456")).toBe("600123456");
    expect(normalizePhone("+48 600-123-456")).toBe("600123456");
    expect(normalizePhone("12345")).toBeNull();
  });
  it("godzina i kod pocztowy", () => {
    expect(isValidTime("07:45")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidPostalCode("80-288")).toBe(true);
    expect(isValidPostalCode("80288")).toBe(false);
  });
});

describe("kody, statusy, tokeny", () => {
  it("kod zgłoszenia pasuje do wzoru RP-Z27-0142", () => {
    expect(CODE_PATTERN.test("RP-Z27-0142")).toBe(true);
    expect(CODE_PATTERN.test("rp-z27-0142")).toBe(false);
  });
  it("miejsce zajmują tylko statusy po zaliczce", () => {
    expect(holdsPlace("ZGLOSZONE")).toBe(false);
    expect(holdsPlace("UMOWA_ZAWARTA")).toBe(false);
    expect(holdsPlace("MIEJSCE")).toBe(true);
    expect(holdsPlace("KWALIFIKACJA")).toBe(true);
    expect(holdsPlace("REZERWA")).toBe(false);
    expect(isClosed("ODMOWA")).toBe(true);
    expect(isClosed("MIEJSCE")).toBe(false);
  });
  it("token jest losowy i w bazie tylko jego skrót", () => {
    const t = newToken();
    expect(t).not.toBe(newToken());
    expect(hashToken(t)).toBe(sha256Hex(t));
    expect(hashToken(t)).not.toContain(t);
  });
});

describe("szyfrowanie pól wrażliwych", () => {
  it("odszyfrowuje to, co zaszyfrowano, i nie zwraca tekstu jawnego", () => {
    const enc = encryptField("44051401359");
    expect(enc).not.toContain("44051401359");
    expect(decryptField(enc)).toBe("44051401359");
  });
  it("wykrywa manipulację szyfrogramem", () => {
    const buf = Buffer.from(encryptField("sekret"), "base64");
    buf[buf.length - 1] ^= 0xff;
    expect(() => decryptField(buf.toString("base64"))).toThrow();
  });
});

describe("TOTP administratora", () => {
  it("akceptuje bieżący kod i odrzuca zły", () => {
    const secret = newTotpSecret();
    const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), algorithm: "SHA1", digits: 6, period: 30 }).generate();
    expect(verifyTotp("a@b.pl", secret, code)).toBe(true);
    expect(verifyTotp("a@b.pl", secret, "000000x")).toBe(false);
    expect(verifyTotp("a@b.pl", secret, code === "000000" ? "111111" : "000000")).toBe(false);
  });
  it("URI zawiera wydawcę i e-mail", () => {
    const uri = totpUri("admin@example.pl", newTotpSecret());
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("admin%40example.pl");
  });
});

describe("schematy formularzy", () => {
  const base = {
    turnusId: "t1",
    parentFirstName: "Anna",
    parentLastName: "Nowak",
    parentEmail: "anna@example.pl",
    parentPhone: "600 123 456",
    childFirstName: "Jan",
    returningParticipant: false,
    rodoConsent: true,
  };
  it("krótkie zgłoszenie wymaga zgody RODO", () => {
    expect(schemaSafe(shortApplicationSchema, base).ok).toBe(true);
    expect(schemaSafe(shortApplicationSchema, { ...base, rodoConsent: false }).ok).toBe(false);
  });
  it("turnus: data końca nie może być przed początkiem", () => {
    const turnus = {
      number: "I", season: "Z27", startDate: "2027-02-01", endDate: "2027-01-30",
      hoursFrom: "07:45", hoursTo: "16:30", venue: "ul. Marusarzówny 2/39, Gdańsk",
      placeLimit: "20", minAge: "5", price: "920", deposit: "200", discount: "50", active: true,
    };
    expect(schemaSafe(turnusSchema, turnus).ok).toBe(false);
    expect(schemaSafe(turnusSchema, { ...turnus, endDate: "2027-02-05" }).ok).toBe(true);
  });
  it("turnus: minimalny wiek nie może być niższy niż 5", () => {
    const turnus = {
      number: "I", season: "Z27", startDate: "2027-02-01", endDate: "2027-02-05",
      hoursFrom: "07:45", hoursTo: "16:30", venue: "ul. Marusarzówny 2/39, Gdańsk",
      placeLimit: 20, minAge: 4, price: "920", deposit: "200", discount: "50", active: true,
    };
    expect(schemaSafe(turnusSchema, turnus).ok).toBe(false);
  });
});
