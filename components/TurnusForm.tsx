"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/form-state";
import { initialFormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function TurnusForm({ action, defaults }: { action: Action; defaults: Record<string, string> & { active?: string } }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const v = { ...defaults, ...(state.values ?? {}) };
  const e = state.fieldErrors ?? {};
  const field = (name: string) => e[name] && <span className="field-error">{e[name]}</span>;

  return (
    <form action={formAction} className="stack">
      {state.error && <div role="alert" className="notice error">{state.error}</div>}
      {state.ok && state.message && <div role="status" className="notice success">{state.message}</div>}

      <div className="row">
        <label>Numer turnusu<input name="number" defaultValue={v.number} required />{field("number")}</label>
        <label>Sezon (kod)<input name="season" defaultValue={v.season} placeholder="Z27" required />{field("season")}</label>
      </div>
      <div className="row">
        <label>Pierwszy dzień<input name="startDate" type="date" defaultValue={v.startDate} required />{field("startDate")}</label>
        <label>Ostatni dzień<input name="endDate" type="date" defaultValue={v.endDate} required />{field("endDate")}</label>
      </div>
      <div className="row">
        <label>Godziny od<input name="hoursFrom" type="time" defaultValue={v.hoursFrom} required />{field("hoursFrom")}</label>
        <label>Godziny do<input name="hoursTo" type="time" defaultValue={v.hoursTo} required />{field("hoursTo")}</label>
      </div>
      <label>Miejsce wypoczynku (adres)<input name="venue" defaultValue={v.venue} required />{field("venue")}</label>
      <div className="row">
        <label>Limit miejsc<input name="placeLimit" type="number" min={1} defaultValue={v.placeLimit} required />{field("placeLimit")}</label>
        <label>Minimalny wiek<input name="minAge" type="number" min={6} defaultValue={v.minAge ?? "6"} required />{field("minAge")}</label>
      </div>
      <div className="row">
        <label>Cena (zł)<input name="price" inputMode="decimal" defaultValue={v.price} required />{field("price")}</label>
        <label>Zaliczka (zł)<input name="deposit" inputMode="decimal" defaultValue={v.deposit} required />{field("deposit")}</label>
        <label>Zniżka stałego uczestnika (zł)<input name="discount" inputMode="decimal" defaultValue={v.discount} required />{field("discount")}</label>
      </div>
      <label className="checkbox">
        <input name="active" type="checkbox" defaultChecked={v.active === "on"} />
        Przyjmuje zgłoszenia (widoczny na stronie zapisu)
      </label>
      <button type="submit" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz turnus"}</button>
    </form>
  );
}
