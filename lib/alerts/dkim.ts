import { createHash, createVerify } from "node:crypto";
import { promises as dns } from "node:dns";

// Weryfikacja DKIM (RFC 6376) dla alertów bankowych: najpierw hash treści (bh), potem podpis RSA-SHA256
// z kluczem publicznym z DNS (selektor._domainkey.domena). Obsługiwane kanonizacje: simple i relaxed.
// Dane wejściowe to surowa wiadomość jako string latin1 (bajt = znak), żeby hash liczył się po bajtach.

export type DkimResult = { ok: true; domain: string; selector: string } | { ok: false; reason: string };

export type KeyResolver = (selector: string, domain: string) => Promise<string | null>;

type Header = { name: string; value: string; raw: string };

/** Rozdziela surową wiadomość na nagłówki (z zachowaniem surowej postaci) i treść. */
export function splitMessage(raw: string): { headers: Header[]; body: string } {
  const m = /\r?\n\r?\n/.exec(raw);
  const headBlock = m ? raw.slice(0, m.index) : raw;
  const body = m ? raw.slice(m.index + m[0].length) : "";
  const headers: Header[] = [];
  for (const line of headBlock.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && headers.length > 0) {
      const last = headers[headers.length - 1];
      last.raw += `\r\n${line}`;
      last.value += ` ${line.trim()}`;
    } else {
      const idx = line.indexOf(":");
      if (idx > 0) {
        headers.push({ name: line.slice(0, idx), value: line.slice(idx + 1).trim(), raw: line });
      }
    }
  }
  return { headers, body };
}

function canonHeaderRelaxed(h: Header): string {
  const value = h.value.replace(/\s+/g, " ").trim();
  return `${h.name.toLowerCase()}:${value}`;
}

function canonHeaderSimple(h: Header): string {
  return h.raw;
}

/** Kanonizacja treści; wejście z zakończeniami CRLF (po normalizacji). */
export function canonBody(body: string, mode: "simple" | "relaxed"): string {
  const normalized = body.replace(/\r?\n/g, "\r\n");
  if (mode === "relaxed") {
    const lines = normalized.split("\r\n").map((l) => l.replace(/[ \t]+/g, " ").replace(/[ \t]+$/, ""));
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return lines.length ? lines.join("\r\n") + "\r\n" : "";
  }
  let out = normalized.replace(/(\r\n)+$/, "");
  return out === "" ? "\r\n" : out + "\r\n";
}

function parseTags(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of value.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).replace(/\s+/g, "");
  }
  return out;
}

const defaultResolver: KeyResolver = async (selector, domain) => {
  try {
    const records = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
    return records.map((r) => r.join("")).join("");
  } catch {
    return null;
  }
};

/**
 * Sprawdza DKIM. Kolejność: (1) wymagane tagi, (2) hash treści bh, (3) podpis RSA.
 * `allowedDomains` ogranicza podpisującego (np. ["erste.pl"]). `resolveKey` pozwala podać klucz bez DNS (testy).
 */
export async function verifyDkim(
  raw: string,
  opts: { allowedDomains: string[]; resolveKey?: KeyResolver },
): Promise<DkimResult> {
  const { headers, body } = splitMessage(raw);
  const sigs = headers.filter((h) => h.name.toLowerCase() === "dkim-signature");
  if (sigs.length === 0) return { ok: false, reason: "brak nagłówka DKIM-Signature" };

  for (const sig of sigs) {
    const tags = parseTags(sig.value);
    const domain = (tags.d ?? "").toLowerCase();
    const selector = tags.s ?? "";
    if (!opts.allowedDomains.includes(domain)) continue;
    if (tags.a !== "rsa-sha256") return { ok: false, reason: `nieobsługiwany algorytm: ${tags.a}` };
    if (!tags.bh || !tags.b || !tags.h || !selector) return { ok: false, reason: "niekompletny DKIM-Signature" };

    const [hdrMode, bodyMode] = (tags.c ?? "simple/simple").split("/");
    const canonBodyText = canonBody(body, (bodyMode as "simple" | "relaxed") ?? "simple");
    const bodyHash = createHash("sha256").update(Buffer.from(canonBodyText, "latin1")).digest("base64");
    if (bodyHash !== tags.bh) return { ok: false, reason: "treść wiadomości została zmieniona (bh nie zgadza się)" };

    // Podpis: nagłówki z listy h (od dołu), plus sam nagłówek DKIM-Signature z pustym b=.
    const used = new Set<number>();
    const parts: string[] = [];
    for (const name of tags.h.split(":").map((n) => n.toLowerCase())) {
      let idx = -1;
      for (let i = headers.length - 1; i >= 0; i--) {
        if (!used.has(i) && headers[i].name.toLowerCase() === name) { idx = i; break; }
      }
      if (idx === -1) continue;
      used.add(idx);
      parts.push(hdrMode === "relaxed" ? canonHeaderRelaxed(headers[idx]) : canonHeaderSimple(headers[idx]));
    }
    const sigHeader = { ...sig, value: sig.value.replace(/([;\s]b=)[^;]*/, "$1") };
    const sigCanon = hdrMode === "relaxed" ? canonHeaderRelaxed(sigHeader) : sigHeader.raw.replace(/([;\s]b=)[^;]*/, "$1");
    parts.push(sigCanon.replace(/\r\n$/, ""));

    const resolveKey = opts.resolveKey ?? defaultResolver;
    const keyRecord = await resolveKey(selector, domain);
    if (!keyRecord) return { ok: false, reason: `brak klucza DKIM ${selector}._domainkey.${domain}` };
    const keyTags = parseTags(keyRecord);
    if (!keyTags.p) return { ok: false, reason: "klucz DKIM odwołany (pusty p=)" };
    const pem = `-----BEGIN PUBLIC KEY-----\n${keyTags.p.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----\n`;

    const verifier = createVerify("RSA-SHA256");
    verifier.update(parts.join("\r\n"), "utf8");
    const valid = verifier.verify(pem, tags.b, "base64");
    return valid ? { ok: true, domain, selector } : { ok: false, reason: "podpis DKIM nieprawidłowy" };
  }
  return { ok: false, reason: `brak podpisu DKIM od dozwolonej domeny (${opts.allowedDomains.join(", ")})` };
}
