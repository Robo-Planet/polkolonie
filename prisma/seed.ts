// Seed danych organizatora (ROBOPLANET EVENTS S.C.). Uruchamiany: npx prisma db seed
// Konto i NIP są z potwierdzonych danych. Adres nie jest wpisywany na sztywno: wymagane są
// zmienne ORGANIZER_STREET, ORGANIZER_POSTAL_CODE, ORGANIZER_CITY (brak = seed nie tworzy rekordu).
import "dotenv/config";
import { prisma } from "@/lib/db";

const BANK_ACCOUNT = "50109025870000000165090761"; // konto Erste (potwierdzone)

async function main() {
  const data = {
    name: "ROBOPLANET EVENTS S.C.",
    nip: "957-113-76-36",
    bankName: "Erste",
    bankAccount: BANK_ACCOUNT,
  };
  const existing = await prisma.organizer.findUnique({ where: { id: 1 } });
  if (existing) {
    if (existing.bankAccount !== BANK_ACCOUNT || existing.nip !== data.nip) {
      await prisma.organizer.update({ where: { id: 1 }, data: { bankAccount: BANK_ACCOUNT, nip: data.nip, bankName: "Erste" } });
      console.log("Zaktualizowano konto i NIP organizatora.");
    } else {
      console.log("Organizator już ma potwierdzone konto i NIP.");
    }
    return;
  }

  const street = process.env.ORGANIZER_STREET;
  const postalCode = process.env.ORGANIZER_POSTAL_CODE;
  const city = process.env.ORGANIZER_CITY;
  if (!street || !postalCode || !city) {
    console.log("Brak rekordu organizatora. Ustaw ORGANIZER_STREET, ORGANIZER_POSTAL_CODE i ORGANIZER_CITY, a potem uruchom ponownie.");
    return;
  }
  await prisma.organizer.create({ data: { id: 1, ...data, street, postalCode, city } });
  console.log("Utworzono rekord organizatora.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
