import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Block } from "@/lib/documents/umowa-render";

// Rysowanie bloków umowy w PDF (A4, DejaVu Sans z polskimi znakami). Układ prosty: nagłówki, akapity,
// punkty, tabela podpisów. Treść przychodzi już gotowa z renderera (lib/documents/umowa-render.ts).

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const WIDTH = PAGE_W - 2 * MARGIN;

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const hard of text.split("\n")) {
    let line = "";
    for (const word of hard.split(/\s+/).filter(Boolean)) {
      const cand = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(cand, size) <= maxWidth) line = cand;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export async function buildUmowaPdf(blocks: Block[], footer: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await readFile(path.join(process.cwd(), "lib/pdf/fonts/DejaVuSans.ttf")), { subset: true });
  const bold = await doc.embedFont(await readFile(path.join(process.cwd(), "lib/pdf/fonts/DejaVuSans-Bold.ttf")), { subset: true });

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const ensure = (h: number) => {
    if (y - h < MARGIN + 24) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };
  const writeLines = (text: string, f: PDFFont, size: number, x: number, maxW: number, gap = 4) => {
    for (const line of wrapLine(text, f, size, maxW)) {
      ensure(size + gap);
      page.drawText(line, { x, y: y - size, size, font: f, color: rgb(0, 0, 0) });
      y -= size + gap;
    }
  };

  for (const b of blocks) {
    if (b.type === "h1") {
      y -= 4;
      writeLines(b.text, bold, 14, MARGIN, WIDTH, 6);
      y -= 6;
    } else if (b.type === "h2") {
      y -= 8;
      writeLines(b.text, bold, 11, MARGIN, WIDTH, 5);
      y -= 2;
    } else if (b.type === "p") {
      writeLines(b.text, b.bold ? bold : font, 10, MARGIN + (b.indent ? 14 : 0), WIDTH - (b.indent ? 14 : 0));
      y -= 6;
    } else if (b.type === "bullet") {
      writeLines(`•  ${b.text}`, font, 10, MARGIN + 10, WIDTH - 10);
      y -= 4;
    } else if (b.type === "table") {
      // Tabela podpisów: dwie kolumny, pod nagłówkami puste pola na podpis (wydruk) albo podpis elektroniczny.
      const colW = WIDTH / Math.max(1, b.rows[0]?.length ?? 2);
      ensure(90);
      b.rows.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          const x = MARGIN + ci * colW;
          const lines = wrapLine(cell, ri === 0 ? bold : font, 10, colW - 12);
          let yy = y;
          for (const line of lines) {
            page.drawText(line, { x, y: yy - 10, size: 10, font: ri === 0 ? bold : font });
            yy -= 14;
          }
          if (ri > 0) page.drawLine({ start: { x, y: y - 56 }, end: { x: x + colW - 16, y: y - 56 }, thickness: 0.5, color: rgb(0.4, 0.4, 0.4) });
        });
        y -= ri === 0 ? 18 : 62;
      });
      y -= 6;
    }
  }

  // Stopka na każdej stronie.
  for (const p of doc.getPages()) {
    p.drawText(footer, { x: MARGIN, y: MARGIN / 2, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  }
  return doc.save();
}
