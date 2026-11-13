"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { organizerSchema } from "@/lib/schemas";

// Dane organizatora (do umowy i karty). Rekord jednoznaczny: id = 1.

export async function updateOrganizer(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = formValues(formData);
  const parsed = organizerSchema.safeParse({
    name: values.name ?? "",
    nip: values.nip ?? "",
    street: values.street ?? "",
    postalCode: values.postalCode ?? "",
    city: values.city ?? "",
    bankName: values.bankName ?? "",
    bankAccount: values.bankAccount ?? "",
  });
  if (!parsed.success) {
    return { error: "Popraw zaznaczone pola.", fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }
  const before = await prisma.organizer.findUnique({ where: { id: 1 } });
  const after = await prisma.organizer.upsert({ where: { id: 1 }, create: parsed.data, update: parsed.data });
  await logEvent({ actor: admin.email, action: "organizer.updated", before, after: parsed.data });
  revalidatePath("/admin/organizator");
  return { ok: true, message: "Zapisano dane organizatora." };
}
