import { splitMessage } from "@/lib/alerts/dkim";

// Parser alertu Alerty24 „Wpływ na konto” (format z tabeli „Format alertu Alerty24” w specyfikacji).
// Parser NIE weryfikuje podpisu – to robi verifyDkim, zanim wiadomość trafi tutaj.
// Saldo jest świadomie pomijane (specyfikacja: nie zapisywać).

export const ALERT_SENDER_DOMAIN = "erste.pl";
export const ALERT_SUBJECT = "Alerty24: Wpływ na konto";

export type Alerty24Payment = {
  sender: string; // "ROBOPLANET SPÓŁKA CYWILNA" (bez numeru konta nadawcy)
  title: string; // tytuł przelewu (np. kod RP-Z27-NNNN)
  amountGrosze: number; // 100 = 1,00 PLN
  recipientAccount: string; // 26 cyfr, konto odbiorcy
  identifier: string; // "Identyfikator wiadomości" ze stopki (klucz przeciw duplikatom)
  messageId: string; // nagłówek Message-ID
  receivedAt: Date | null; // nagłówek Date
};

/** Dekoduje treść jako UTF-8 (charset z nagłówka Content-Type; meta w HTML bywa błędna). */
function decodeBody(bodyLatin1: string): string {
  return Buffer.from(bodyLatin1, "latin1").toString("utf8");
}

function stripWhitespace(s: string): string {
  return s.replace(/&nbsp;|&#xA0;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
}

function fieldAfterLabel(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*</p>[\\s\\S]*?<b>([\\s\\S]*?)</b>`);
  const m = re.exec(html);
  return m ? stripWhitespace(m[1]) : null;
}

/** "1,00 PLN" -> 100 (grosze). Separator tysięcy może być spacją lub spacją nierozdzielającą. */
export function parseAmountToGrosze(input: string): number {
  const cleaned = input.replace(/PLN/i, "").replace(/[\s  ]/g, "");
  if (!/^\d+(,\d{1,2})?$/.test(cleaned)) throw new Error(`Niepoprawna kwota w alercie: ${input}`);
  const [zl, gr = ""] = cleaned.split(",");
  return Number(zl) * 100 + Number(gr.padEnd(2, "0"));
}

export function parseAlerty24(raw: string): Alerty24Payment {
  const { headers, body } = splitMessage(raw);
  // Nagłówki w pliku są w UTF-8; splitMessage czyta bajty jako latin1, więc dekodujemy ponownie.
  const header = (name: string) =>
    Buffer.from(headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "", "latin1").toString("utf8");

  const html = decodeBody(body);
  const sender = fieldAfterLabel(html, "Od kogo:");
  const title = fieldAfterLabel(html, "Tytuł:");
  const amount = fieldAfterLabel(html, "Ile:");
  const account = fieldAfterLabel(html, "Na konto:");
  const identifierMatch = /Identyfikator wiadomości:\s*(-?\d+)/.exec(html);

  if (!sender || !title || !amount || !account || !identifierMatch) {
    throw new Error("Alert nie zawiera wszystkich wymaganych pól (nadawca, tytuł, kwota, konto, identyfikator)");
  }
  const accountDigits = account.replace(/\s/g, "");
  if (!/^\d{26}$/.test(accountDigits)) throw new Error(`Niepoprawny numer konta w alercie: ${account}`);

  const date = header("Date");
  const receivedAt = date ? new Date(date) : null;

  return {
    sender,
    title,
    amountGrosze: parseAmountToGrosze(amount),
    recipientAccount: accountDigits,
    identifier: identifierMatch[1],
    messageId: header("Message-ID"),
    receivedAt: receivedAt && !Number.isNaN(receivedAt.getTime()) ? receivedAt : null,
  };
}

/** Akceptacja nagłówków: nadawca z domeny banku i właściwy temat. Treść sprawdza parser. */
export function checkAlertEnvelope(raw: string): { ok: true } | { ok: false; reason: string } {
  const { headers } = splitMessage(raw);
  const utf8 = (v: string) => Buffer.from(v, "latin1").toString("utf8");
  const from = utf8(headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "");
  const subject = utf8(headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "");
  const address = /<([^>]+)>/.exec(from)?.[1] ?? from;
  if (!address.toLowerCase().endsWith(`@${ALERT_SENDER_DOMAIN}`)) return { ok: false, reason: "nadawca spoza domeny banku" };
  if (subject.trim() !== ALERT_SUBJECT) return { ok: false, reason: "inny temat wiadomości" };
  return { ok: true };
}
