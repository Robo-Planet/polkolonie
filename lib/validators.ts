// Walidacje identyfikatorów i danych kontaktowych (bez zależności zewnętrznych).

/** NIP: 10 cyfr, suma kontrolna wagami 6,5,7,2,3,4,5,6,7. Myślniki i spacje ignorowane. */
export function isValidNip(input: string): boolean {
  const digits = input.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(digits)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  return sum % 11 === Number(digits[9]);
}

/** PESEL: 11 cyfr, suma kontrolna wagami 1,3,7,9 (mod 10). */
export function isValidPesel(input: string): boolean {
  if (!/^\d{11}$/.test(input)) return false;
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(input[i]), 0);
  const control = (10 - (sum % 10)) % 10;
  return control === Number(input[10]);
}

/** Telefon: 9 cyfr, opcjonalnie z prefiksem +48 lub 0048. Zwraca znormalizowany numer albo null. */
export function normalizePhone(input: string): string | null {
  let s = input.replace(/[\s()-]/g, "");
  if (s.startsWith("+48")) s = s.slice(3);
  else if (s.startsWith("0048")) s = s.slice(4);
  return /^\d{9}$/.test(s) ? s : null;
}

/** Kod pocztowy polski NN-NNN. */
export function isValidPostalCode(input: string): boolean {
  return /^\d{2}-\d{3}$/.test(input.trim());
}

/** Godzina HH:MM (00:00–23:59). */
export function isValidTime(input: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(input);
}
