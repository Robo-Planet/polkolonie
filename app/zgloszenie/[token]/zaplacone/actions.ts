"use server";

import { redirect } from "next/navigation";
import { applicationByPaymentToken, reportPayment } from "@/lib/payments/reported";

// „Już zapłaciłem”: rodzic zgłasza wpłatę. Nie zmienia należności; biuro weryfikuje wpływ.
export async function reportPaymentByToken(token: string): Promise<void> {
  const app = await applicationByPaymentToken(token);
  if (app) await reportPayment(app.id, "rodzic");
  redirect(`/zgloszenie/${token}/zaplacone?sent=1`);
}
