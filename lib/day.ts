// Daty turnusów są zapisywane jako północ UTC (lib/day.ts jest jedyną kopią tej logiki w projekcie).
// Dzięki temu "1 lutego 2027" to zawsze 2027-02-01T00:00:00Z, niezależnie od strefy serwera.

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2027-02-01" -> Date(2027-02-01T00:00:00Z). Rzuca błąd dla niepoprawnych dat. */
export function parseDay(input: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!m) throw new Error(`Niepoprawny format daty: ${input}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new Error(`Nieistniejąca data: ${input}`);
  }
  return date;
}

/** Date -> "2027-02-01" (wg daty UTC). */
export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Dzisiejsza data jako północ UTC. */
export function todayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Liczba pełnych dni od `from` do `to` (oba jako północ UTC). Ujemna, gdy `to` wcześniej. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Dodaje dni do daty (północ UTC). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Pełne lata między `birth` a `on` (dla minimalnego wieku 5 lat). */
export function fullYearsBetween(birth: Date, on: Date): number {
  let years = on.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < birth.getUTCMonth() ||
    (on.getUTCMonth() === birth.getUTCMonth() && on.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years;
}

const plDate = new Intl.DateTimeFormat("pl-PL", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

/** Date (UTC) -> "1 lutego 2027". */
export function formatPlDate(date: Date): string {
  return plDate.format(date);
}
