"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { todayUtc } from "@/lib/day";
import { logEvent } from "@/lib/events";
import { hashToken } from "@/lib/tokens";

// Kliknięcie "Potwierdzam adres e-mail" – dopiero wtedy zapisujemy potwierdzenie.
// Otwarcie samego linku niczego nie zmienia (skanery poczty otwierają linki automatycznie).

export async function confirmParentEmail(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!token) return;
  const app = await prisma.application.findUnique({ where: { linkTokenHash: hashToken(token) } });
  if (!app || app.emailConfirmedAt || app.linkExpiresAt < todayUtc()) return;

  await prisma.application.update({ where: { id: app.id }, data: { emailConfirmedAt: new Date() } });
  await logEvent({
    applicationId: app.id,
    actor: "rodzic",
    action: "email.confirmed",
    before: { emailConfirmedAt: null },
    after: { emailConfirmedAt: "teraz" },
  });
  revalidatePath(`/zgloszenie/${token}`);
}
