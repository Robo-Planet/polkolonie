import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAlerty24, checkAlertEnvelope, parseAmountToGrosze } from "@/lib/alerts/alerty24";
import { verifyDkim, splitMessage } from "@/lib/alerts/dkim";

const fixture = readFileSync(path.join(__dirname, "fixtures", "alerty24-wplyw-zmodyfikowany.eml"), "latin1");

describe("alert Alerty24 – parser (weryfikacja DKIM wyłączona)", () => {
  it("wyciąga tytuł, nadawcę, kwotę 100 gr, konto odbiorcy i identyfikator; saldo jest ignorowane", () => {
    const p = parseAlerty24(fixture);
    expect(p.title).toBe("przelew");
    expect(p.sender).toBe("ROBOPLANET SPÓŁKA CYWILNA");
    expect(p.amountGrosze).toBe(100);
    expect(p.recipientAccount).toBe("50109025870000000165090761");
    expect(p.identifier).toBe("-1540367547");
    expect(p.messageId).toBe("<b7047f5-778-2fd8-281b-6676717bd6>");
    expect(p.receivedAt?.toISOString()).toBe("2026-11-13T12:02:09.000Z");
    // saldo (0,00 PLN) nie trafia do wyniku
    expect(Object.keys(p)).not.toContain("balance");
    expect(JSON.stringify(p)).not.toContain("0,00");
  });

  it("koperta: nadawca z domeny erste.pl i temat „Alerty24: Wpływ na konto”", () => {
    expect(checkAlertEnvelope(fixture)).toEqual({ ok: true });
  });

  it("kwoty: przecinek dziesiętny i spacje tysięcy", () => {
    expect(parseAmountToGrosze("1,00 PLN")).toBe(100);
    expect(parseAmountToGrosze("1 234,5 PLN")).toBe(123450);
    expect(parseAmountToGrosze("920 PLN")).toBe(92000);
    expect(() => parseAmountToGrosze("abc")).toThrow();
  });
});

describe("alert Alerty24 – weryfikacja DKIM włączona", () => {
  it("odrzuca alert, bo treść została zmieniona (hash bh nie zgadza się)", async () => {
    let keyLookups = 0;
    const result = await verifyDkim(fixture, {
      allowedDomains: ["erste.pl"],
      resolveKey: async () => {
        keyLookups++;
        return null;
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("treść wiadomości została zmieniona");
    // odrzucenie następuje przed sprawdzeniem klucza – nie zależy od DNS
    expect(keyLookups).toBe(0);
  });

  it("odrzuca wiadomość bez nagłówka DKIM-Signature", async () => {
    const { headers } = splitMessage(fixture);
    expect(headers.some((h) => h.name === "DKIM-Signature")).toBe(true);
    const stripped = fixture.replace(/^DKIM-Signature:[\s\S]*?(?=\r?\n[^ \t])/m, "");
    const result = await verifyDkim(stripped, { allowedDomains: ["erste.pl"] });
    expect(result.ok).toBe(false);
  });
});
