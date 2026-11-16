// Seed danych organizatora (ROBOPLANET EVENTS S.C.). Uruchamiany: npx prisma db seed
// Dane potwierdzone przez organizatora (13.11 i 16.11.2026) są stałe. Adres nie jest wpisywany na sztywno:
// przy pierwszym utworzeniu wymagane są ORGANIZER_STREET, ORGANIZER_POSTAL_CODE, ORGANIZER_CITY.
import "dotenv/config";
import { prisma } from "@/lib/db";

const CONFIRMED = {
  name: "ROBOPLANET EVENTS S.C.",
  nip: "957-113-76-36",
  regon: "520143330",
  representative: "Estera Piotrowska",
  phone: "791 333 730",
  email: "biuro@roboplanet.pl",
  bankName: "Erste",
  bankAccount: "50109025870000000165090761",
};

async function main() {
  const existing = await prisma.organizer.findUnique({ where: { id: 1 } });
  if (existing) {
    await prisma.organizer.update({ where: { id: 1 }, data: CONFIRMED });
    console.log("Zaktualizowano dane organizatora (potwierdzone).");
    return;
  }
  const street = process.env.ORGANIZER_STREET;
  const postalCode = process.env.ORGANIZER_POSTAL_CODE;
  const city = process.env.ORGANIZER_CITY;
  if (!street || !postalCode || !city) {
    console.log("Brak rekordu organizatora. Ustaw ORGANIZER_STREET, ORGANIZER_POSTAL_CODE i ORGANIZER_CITY, a potem uruchom ponownie.");
    return;
  }
  await prisma.organizer.create({ data: { id: 1, ...CONFIRMED, street, postalCode, city } });
  console.log("Utworzono rekord organizatora.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
