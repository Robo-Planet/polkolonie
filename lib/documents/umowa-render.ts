import { umowaTemplate } from "@/lib/documents/umowa-template";

// Zamiana wzoru umowy na bloki tekstu: usuwa komentarze, wybiera wariant (§ 1 ust. 2),
// wstawia pola {{…}} i dzieli na nagłówki, akapity, punkty i tabelę podpisów.
// Treść paragrafów nie jest zmieniana: renderer tylko składa tekst z pliku wzorca.

export type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "p"; text: string; bold?: boolean; indent?: boolean }
  | { type: "bullet"; text: string }
  | { type: "table"; rows: string[][] };

/** Wartości pól umowy. Brakujące pole = błąd (nie zostawiamy {{…}} w dokumencie). */
export function renderUmowaBlocks(fields: Record<string, string>, opts: { late: boolean }): Block[] {
  const raw = umowaTemplate().raw.replace(/<!--[\s\S]*?-->/g, "");
  const lines: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    // Warianty § 1 ust. 2: zostaje tylko linia pasująca do zapisu.
    if (line.includes("[wariant standardowy]")) {
      if (opts.late) continue;
      lines.push(line.replace("[wariant standardowy] ", ""));
      continue;
    }
    if (line.includes("[wariant późny zapis]")) {
      if (!opts.late) continue;
      // Wariant późny zapis zastępuje punkt 2 (§ 1 ust. 2), więc dostaje jego numer.
      lines.push("2. " + line.trim().replace("[wariant późny zapis] ", ""));
      continue;
    }
    lines.push(line);
  }

  const text = lines.join("\n").replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, key: string) => {
    if (!(key in fields)) throw new Error(`Umowa: brak wartości pola ${key}`);
    return fields[key];
  });
  if (text.includes("{{")) throw new Error("Umowa: pozostał nierozwiązany znacznik");

  const blocks: Block[] = [];
  let para: string[] = [];
  let table: string[][] = [];
  let paraIndent = false;
  const flush = () => {
    if (para.length) {
      const joined = para.join("\n").trim();
      const bold = /^\*\*.*\*\*$/.test(joined);
      blocks.push({ type: "p", text: joined.replace(/\*\*/g, ""), bold, indent: paraIndent });
    }
    para = [];
    paraIndent = false;
  };
  const flushTable = () => {
    if (table.length) blocks.push({ type: "table", rows: table });
    table = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (line.startsWith("|")) {
      flush();
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (!cells.every((c) => /^-+$/.test(c))) table.push(cells);
      continue;
    }
    flushTable();
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (line.startsWith("# ")) {
      flush();
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      continue;
    }
    if (/^\s*- /.test(line)) {
      flush();
      blocks.push({ type: "bullet", text: line.replace(/^\s*- /, "").replace(/\*\*/g, "") });
      continue;
    }
    // Nowy punkt (1., 2., …) i linia wcięta (np. dane przelewu) zaczynają nowy akapit;
    // pozostałe linie (np. dane organizatora) zostają w swoich wierszach.
    if (/^\d+\.\s/.test(line.trim()) || /^\s{2,}/.test(line)) {
      flush();
      paraIndent = /^\s{2,}/.test(line);
    }
    para.push(line.trim());
  }
  flush();
  flushTable();
  return blocks;
}
