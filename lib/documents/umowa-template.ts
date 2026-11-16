import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

// Wzór umowy, wersja 5 (obowiązuje od 16.11.2026). Plik lib/templates/umowa-v5.md jest kopią
// docs/umowa-wzor.md bajt w bajt; treść nie może się zmienić bez nowej wersji (stare zgłoszenia zostają przy swojej).

export const UMOWA_TEMPLATE_VERSION = 5;
export const UMOWA_TEMPLATE_EFFECTIVE = "2026-11-16";
const TEMPLATE_PATH = path.join(process.cwd(), "lib", "templates", "umowa-v5.md");

let cache: { raw: string; sha256: string } | undefined;

/** Surowy tekst wzoru (z komentarzami) i jego SHA-256. */
export function umowaTemplate(): { raw: string; sha256: string } {
  if (!cache) {
    const raw = readFileSync(TEMPLATE_PATH, "utf8");
    cache = { raw, sha256: createHash("sha256").update(readFileSync(TEMPLATE_PATH)).digest("hex") };
  }
  return cache;
}

/** Nazwy wszystkich pól {{…}} występujących we wzorze. */
export function umowaPlaceholders(raw: string): string[] {
  const body = raw.replace(/<!--[\s\S]*?-->/g, "");
  return [...new Set([...body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]))];
}
