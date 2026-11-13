// Tworzy jedyne konto administratora (uruchamiane ręcznie, nie przez stronę).
// Użycie: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create
// Wypisuje URI TOTP do dodania w aplikacji uwierzytelniającej (raz, nie zapisuje go w jawnej postaci).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { encryptField } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { newTotpSecret, totpUri } from "@/lib/totp";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email.includes("@")) throw new Error("Ustaw ADMIN_EMAIL");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD: min. 12 znaków");

  const existing = await prisma.adminUser.count();
  if (existing > 0) throw new Error("Konto administratora już istnieje (dopuszczalne jest jedno).");

  const secret = newTotpSecret();
  await prisma.adminUser.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      totpSecretEnc: encryptField(secret),
    },
  });
  console.log("Utworzono konto administratora.");
  console.log("Dodaj w aplikacji uwierzytelniającej (wpisz sekret ręcznie lub zeskanuj kod z tego URI):");
  console.log(totpUri(email, secret));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
