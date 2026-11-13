// Przetwarza alert Alerty24 zapisany jako plik .eml (ręcznie albo do testów).
// Użycie: npx tsx scripts/ingest-alert.ts <plik.eml> [--no-dkim]
// Produkcja: alerty pobiera zadanie IMAP (etap 4) i zawsze z weryfikacją DKIM.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { ingestAlert } from "@/lib/payments/service";
import { prisma } from "@/lib/db";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Podaj ścieżkę do pliku .eml");
  const requireDkim = !process.argv.includes("--no-dkim");
  const raw = await readFile(file, "latin1");
  const result = await ingestAlert(raw, { requireDkim });
  console.log(JSON.stringify(result));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
