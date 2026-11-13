// Data urodzenia z PESEL (kodowanie stulecia w miesiącu: 1800/1900/2000/2100/2200).
export function birthDateFromPesel(pesel: string): Date | null {
  if (!/^\d{11}$/.test(pesel)) return null;
  const yy = Number(pesel.slice(0, 2));
  const mm = Number(pesel.slice(2, 4));
  const dd = Number(pesel.slice(4, 6));
  const codes: [number, number][] = [[1800, 80], [1900, 0], [2000, 20], [2100, 40], [2200, 60]];
  for (const [base, offset] of codes) {
    const month = mm - offset;
    if (month >= 1 && month <= 12) {
      const year = base + yy;
      const date = new Date(Date.UTC(year, month - 1, dd));
      if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === dd) return date;
      return null;
    }
  }
  return null;
}
