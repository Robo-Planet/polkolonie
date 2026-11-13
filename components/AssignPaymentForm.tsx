"use client";

import { useActionState } from "react";
import { assignPayment } from "@/app/admin/(panel)/wplaty/actions";
import { initialFormState } from "@/lib/form-state";

export function AssignPaymentForm({ transactionId }: { transactionId: string }) {
  const [state, action, pending] = useActionState(assignPayment.bind(null, transactionId), initialFormState);
  return (
    <form action={action} className="inline-form">
      <input name="code" placeholder="RP-Z27-0142" defaultValue={state.values?.code ?? ""} />
      <button type="submit" disabled={pending}>{pending ? "…" : "Przypisz"}</button>
      {state.error && <span className="field-error">{state.error}</span>}
      {state.ok && state.message && <span className="ok-text">{state.message}</span>}
    </form>
  );
}
