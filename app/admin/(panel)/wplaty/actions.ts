"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { formValues, type FormState } from "@/lib/form-state";
import { assignTransaction } from "@/lib/payments/service";

// Ręczne przypisanie wpływu do zgłoszenia (biuro). Każde przypisanie trafia do dziennika.
export async function assignPayment(transactionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = formValues(formData);
  const code = (values.code ?? "").trim();
  if (!/^RP-[A-Z0-9]{2,6}-\d{4,}$/i.test(code)) {
    return { error: "Podaj kod zgłoszenia, np. RP-Z27-0142.", values };
  }
  const result = await assignTransaction(transactionId, code, admin.email);
  if (!result.ok) return { error: result.error, values };
  revalidatePath("/admin/wplaty");
  return { ok: true, message: `Przypisano do ${code.toUpperCase()}.` };
}
