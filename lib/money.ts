// Kwoty przechowujemy w groszach (Int), żeby uniknąć błędów zaokrągleń przy złotych.

const nf = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

/** 92000 -> "920,00 zł" */
export function formatGrosze(grosze: number): string {
  return nf.format(grosze / 100);
}

/** "920", "920,5", "920.50" -> grosze. Rzuca błąd dla niepoprawnych wartości. */
export function parsePlnToGrosze(input: string): number {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Niepoprawna kwota: ${input}`);
  }
  return Math.round(Number(normalized) * 100);
}
