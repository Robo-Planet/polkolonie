import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { formatPlDate } from "@/lib/day";

// Karta kwalifikacyjna uczestnika wypoczynku wg wzoru z Dz.U. 2026 poz. 704 (docs/karta-mapowanie.md).
// Części I–II wypełnia system (z danych zgłoszenia), część III zostaje pusta do decyzji biura.
// Części IV–VI wypełnia kadra na papierze – nie są drukowane.

export type KartaData = {
  code: string;
  turnus: { number: string; startDate: Date; endDate: Date; venue: string };
  child: { firstName: string; lastName: string; birthYear: number | null; pesel: string; address: string; postal: string; city: string };
  parents: { names: string; address: string; postal: string; city: string; phones: string };
  health: {
    specialNeeds: string;
    allergies: string;
    allergyTypes: string[];
    chronic: string;
    motionSickness: boolean;
    medications: string;
    glassesOrBraces: string;
    diet: string;
    emotions: string;
    heightFear: boolean;
    waterFear: boolean;
    otherInfo: string;
    vaccinations: string;
  };
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const ALLERGY_LABEL: Record<string, string> = { lek: "leki", pyłki: "pyłki", pokarm: "pokarmy", jad: "jad owadów" };

/** Tekst punktu II.9 składany z pól formularza (jeden czytelny opis). */
export function healthNarrative(h: KartaData["health"]): string {
  const parts: string[] = [];
  if (h.allergyTypes.length || h.allergies) {
    const types = h.allergyTypes.map((t) => ALLERGY_LABEL[t] ?? t).join(", ");
    parts.push(`uczulenia${types ? ` (${types})` : ""}${h.allergies ? `: ${h.allergies}` : ""}`);
  }
  if (h.motionSickness) parts.push("choroba lokomocyjna");
  if (h.medications) parts.push(`leki przyjmowane na stałe: ${h.medications}`);
  if (h.chronic) parts.push(`choroby przewlekłe: ${h.chronic}`);
  if (h.glassesOrBraces) parts.push(`aparat ortodontyczny / okulary / soczewki: ${h.glassesOrBraces}`);
  if (h.diet) parts.push(`dieta: ${h.diet}`);
  if (h.emotions) parts.push(`problemy z wyrażaniem emocji lub funkcjonowaniem w grupie: ${h.emotions}`);
  if (h.heightFear) parts.push("lęk wysokości");
  if (h.waterFear) parts.push("hydrofobia");
  if (h.otherInfo) parts.push(`inne: ${h.otherInfo}`);
  return parts.length ? parts.join("; ") + "." : "brak istotnych informacji.";
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

class Cursor {
  page: PDFPage;
  y: number;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont) {
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }
  newPageIfNeeded(needed: number) {
    if (this.y - needed < MARGIN + 30) {
      this.page = this.doc.addPage([PAGE_W, PAGE_H]);
      this.y = PAGE_H - MARGIN;
    }
  }
  text(value: string, opts: { size?: number; bold?: boolean; x?: number; indent?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const x = MARGIN + (opts.indent ?? 0);
    const lines = wrap(value, font, size, CONTENT_W - (opts.indent ?? 0));
    for (const line of lines) {
      this.newPageIfNeeded(size + 4);
      this.page.drawText(line, { x: opts.x ?? x, y: this.y - size, size, font, color: rgb(0, 0, 0) });
      this.y -= size + 4;
    }
  }
  /** Linia do uzupełnienia (pusta na papierze) albo wartość nad linią. */
  field(label: string, value: string, opts: { indent?: number } = {}) {
    const indent = opts.indent ?? 0;
    this.newPageIfNeeded(30);
    this.page.drawText(label, { x: MARGIN + indent, y: this.y - 10, size: 9, font: this.font, color: rgb(0.35, 0.35, 0.35) });
    this.y -= 14;
    const text = value || "";
    if (text) {
      const lines = wrap(text, this.font, 10, CONTENT_W - indent);
      for (const line of lines) {
        this.newPageIfNeeded(16);
        this.page.drawText(line, { x: MARGIN + indent, y: this.y - 10, size: 10, font: this.font });
        this.y -= 14;
      }
    }
    this.page.drawLine({ start: { x: MARGIN + indent, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
    this.y -= 8;
  }
  rule() {
    this.y -= 4;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 1.2, color: rgb(0, 0, 0) });
    this.y -= 10;
  }
  space(h: number) {
    this.y -= h;
  }
}

async function loadFont(doc: PDFDocument, file: string) {
  doc.registerFontkit(fontkit);
  const bytes = await readFile(path.join(process.cwd(), "lib/pdf/fonts", file));
  return doc.embedFont(bytes, { subset: true });
}

/** Buduje PDF karty (części I–III). Zwraca bajty PDF. */
export async function buildKartaPdf(data: KartaData, opts: { signaturePng?: Uint8Array } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await loadFont(doc, "DejaVuSans.ttf");
  const bold = await loadFont(doc, "DejaVuSans-Bold.ttf");
  const c = new Cursor(doc, font, bold);

  c.text("KARTA KWALIFIKACYJNA UCZESTNIKA WYPOCZYNKU", { size: 13, bold: true });
  c.text(`Załącznik nr 6 do rozporządzenia Ministra Edukacji z dnia 27 maja 2026 r. (Dz.U. 2026 poz. 704). Zgłoszenie ${data.code}.`, { size: 8 });
  c.space(6);

  c.text("I. Informacje dotyczące wypoczynku", { bold: true, size: 11 });
  c.text("1. Forma wypoczynku: [X] półkolonia", { indent: 8 });
  c.text(`2. Termin wypoczynku: ${formatPlDate(data.turnus.startDate)} – ${formatPlDate(data.turnus.endDate)} (turnus ${data.turnus.number})`, { indent: 8 });
  c.text(`3. Adres wypoczynku: ${data.turnus.venue}`, { indent: 8 });
  c.space(4);
  c.rule();

  c.text("II. Informacje dotyczące uczestnika wypoczynku", { bold: true, size: 11 });
  c.field("1. Imię (imiona) i nazwisko", `${data.child.firstName} ${data.child.lastName}`, { indent: 8 });
  c.field("2. Imiona i nazwiska rodziców", data.parents.names, { indent: 8 });
  c.field("3. Rok urodzenia", data.child.birthYear ? String(data.child.birthYear) : "", { indent: 8 });
  c.newPageIfNeeded(40);
  c.text("4. Numer PESEL", { indent: 8 });
  const boxSize = 16;
  const pesel = data.child.pesel.padEnd(11, " ");
  for (let i = 0; i < 11; i++) {
    const x = MARGIN + 16 + i * boxSize;
    c.page.drawRectangle({ x, y: c.y - boxSize, width: boxSize, height: boxSize, borderWidth: 0.6, borderColor: rgb(0, 0, 0) });
    c.page.drawText(pesel[i] ?? "", { x: x + 4.5, y: c.y - boxSize + 4, size: 10, font });
  }
  c.y -= boxSize + 10;
  c.field("5. Adres zamieszkania uczestnika", `${data.child.address}${data.child.postal ? `, ${data.child.postal} ${data.child.city}` : ""}`, { indent: 8 });
  c.field("6. Adres zamieszkania lub pobytu rodziców", `${data.parents.address}${data.parents.postal ? `, ${data.parents.postal} ${data.parents.city}` : ""}`, { indent: 8 });
  c.field("7. Telefony rodziców dostępne w czasie trwania wypoczynku", data.parents.phones, { indent: 8 });
  c.field("8. Specjalne potrzeby edukacyjne (niepełnosprawność, niedostosowanie społeczne)", data.health.specialNeeds, { indent: 8 });
  c.field("9. Istotne dane o stanie zdrowia, rozwoju psychofizycznym i stosowanej diecie", healthNarrative(data.health), { indent: 8 });
  c.field("Szczepienia ochronne (tężec, błonica, inne – z rokiem)", data.health.vaccinations, { indent: 8 });
  c.space(14);
  const signatureSpot = { page: c.page, y: c.y }; // miejsce na podpis rodzica (nad linią)
  c.text("…………………………………… (data)                    ……………………………………………… (podpis rodziców / pełnoletniego uczestnika wypoczynku)", { size: 9 });
  c.space(6);
  c.rule();

  if (opts.signaturePng) {
    const img = await doc.embedPng(opts.signaturePng);
    const scale = Math.min(150 / img.width, 40 / img.height);
    signatureSpot.page.drawImage(img, { x: MARGIN + 300, y: signatureSpot.y - 40, width: img.width * scale, height: img.height * scale });
  }

  c.text("III. Decyzja organizatora wypoczynku o zakwalifikowaniu uczestnika do udziału w wypoczynku", { bold: true, size: 11 });
  c.text("Postanawiam: [  ] zakwalifikować i skierować uczestnika na wypoczynek", { indent: 8 });
  c.text("[  ] odmówić skierowania uczestnika na wypoczynek ze względu na: ……………………………………………………………", { indent: 8 });
  c.space(10);
  c.text("…………………………………… (data)                    ……………………………………………… (podpis organizatora wypoczynku)", { size: 9 });

  return doc.save();
}
