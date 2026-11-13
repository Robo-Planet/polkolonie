import { prisma } from "@/lib/db";

// Kod zgłoszenia: RP-<sezon>-<numer 4 cyfry>, np. RP-Z27-0142. Jest kluczem dopasowania przelewów.
// Numer z atomowego licznika w tabeli Counter (bez kolizji przy równoległych zgłoszeniach).

export const CODE_PATTERN = /^RP-[A-Z0-9]{2,6}-\d{4,}$/;

export async function nextApplicationCode(season: string): Promise<string> {
  const key = `application-code:${season}`;
  const counter = await prisma.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `RP-${season}-${String(counter.value).padStart(4, "0")}`;
}
