"use client";

import { useActionState } from "react";
import { updateOrganizer } from "@/app/admin/(panel)/organizator/actions";
import { initialFormState } from "@/lib/form-state";

type Defaults = Partial<Record<"name" | "nip" | "street" | "postalCode" | "city" | "bankName" | "bankAccount", string>>;

export function OrganizerForm({ defaults }: { defaults: Defaults }) {
  const [state, action, pending] = useActionState(updateOrganizer, initialFormState);
  const v = { ...defaults, ...(state.values ?? {}) } as Defaults;
  const e = state.fieldErrors ?? {};
  const field = (name: string) => e[name] && <span className="field-error">{e[name]}</span>;

  return (
    <form action={action} className="stack">
      {state.error && <div role="alert" className="notice error">{state.error}</div>}
      {state.ok && state.message && <div role="status" className="notice success">{state.message}</div>}
      <label>Nazwa<input name="name" defaultValue={v.name ?? ""} required />{field("name")}</label>
      <label>NIP<input name="nip" defaultValue={v.nip ?? ""} required />{field("nip")}</label>
      <label>Ulica i numer<input name="street" defaultValue={v.street ?? ""} required />{field("street")}</label>
      <div className="row">
        <label>Kod pocztowy<input name="postalCode" placeholder="00-000" defaultValue={v.postalCode ?? ""} required />{field("postalCode")}</label>
        <label>Miejscowość<input name="city" defaultValue={v.city ?? ""} required />{field("city")}</label>
      </div>
      <label>Bank<input name="bankName" defaultValue={v.bankName ?? "Erste"} required />{field("bankName")}</label>
      <label>Numer konta (26 cyfr)<input name="bankAccount" inputMode="numeric" defaultValue={v.bankAccount ?? ""} required />{field("bankAccount")}</label>
      <button type="submit" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz"}</button>
    </form>
  );
}
