"use server";

import { headers } from "next/headers";
import type { FormState } from "@/lib/form-state";
import { formValues } from "@/lib/form-state";
import { requestSignCode, signContract } from "@/lib/signing/service";

export async function sendSignCode(token: string, _prev: FormState): Promise<FormState> {
  const r = await requestSignCode(token);
  return r.ok ? { ok: true, message: r.message } : { error: r.error };
}

export async function signWithScreen(token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const h = await headers();
  const values = formValues(formData);
  const r = await signContract(token, {
    code: values.code ?? "",
    signatureDataUrl: values.signature ?? "",
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip"),
    userAgent: h.get("user-agent"),
  });
  return r.ok ? { ok: true, submitted: true, message: r.message } : { error: r.error, values: { code: values.code ?? "" } };
}
