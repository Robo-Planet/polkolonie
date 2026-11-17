"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { cancelForMissingDeposit } from "@/lib/payments/cancel";

// Anulowanie zgłoszenia po terminie kaucji – decyzja biura, każda zmiana w dzienniku.
export async function cancelApplication(applicationId: string): Promise<void> {
  const admin = await requireAdmin();
  await cancelForMissingDeposit(applicationId, admin.email);
  revalidatePath("/admin/wplaty");
}
