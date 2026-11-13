"use client";

import { useActionState } from "react";
import { submitShortApplication } from "@/app/zapis/actions";
import { initialFormState } from "@/lib/form-state";

type TurnusOption = { id: string; label: string; seatsLeft: number; placeLimit: number };

export function ShortApplicationForm({ turnusy }: { turnusy: TurnusOption[] }) {
  const [state, action, pending] = useActionState(submitShortApplication, initialFormState);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};

  if (state.ok) {
    return (
      <div role="status" className="notice success">
        <h2>Dziękujemy!</h2>
        <p>{state.message}</p>
        <p>Sprawdź także folder spam. Miejsce zostaje zarezerwowane po wpłacie zaliczki.</p>
      </div>
    );
  }

  return (
    <form action={action} className="stack" noValidate>
      {state.error && <div role="alert" className="notice error">{state.error}</div>}

      <label>
        Turnus
        <select name="turnusId" defaultValue={v.turnusId ?? ""} required>
          <option value="" disabled>
            Wybierz turnus
          </option>
          {turnusy.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} – {t.seatsLeft > 0 ? `zostało ${t.seatsLeft} z ${t.placeLimit} miejsc` : "brak wolnych miejsc (lista rezerwowa)"}
            </option>
          ))}
        </select>
        {e.turnusId && <span className="field-error">{e.turnusId}</span>}
      </label>

      <div className="row">
        <label>
          Imię rodzica
          <input name="parentFirstName" autoComplete="given-name" defaultValue={v.parentFirstName ?? ""} required />
          {e.parentFirstName && <span className="field-error">{e.parentFirstName}</span>}
        </label>
        <label>
          Nazwisko rodzica
          <input name="parentLastName" autoComplete="family-name" defaultValue={v.parentLastName ?? ""} required />
          {e.parentLastName && <span className="field-error">{e.parentLastName}</span>}
        </label>
      </div>

      <div className="row">
        <label>
          E-mail
          <input name="parentEmail" type="email" autoComplete="email" defaultValue={v.parentEmail ?? ""} required />
          {e.parentEmail && <span className="field-error">{e.parentEmail}</span>}
        </label>
        <label>
          Telefon
          <input name="parentPhone" type="tel" autoComplete="tel" defaultValue={v.parentPhone ?? ""} required />
          {e.parentPhone && <span className="field-error">{e.parentPhone}</span>}
        </label>
      </div>

      <label>
        Imię dziecka
        <input name="childFirstName" defaultValue={v.childFirstName ?? ""} required />
        {e.childFirstName && <span className="field-error">{e.childFirstName}</span>}
      </label>

      <label className="checkbox">
        <input name="returningParticipant" type="checkbox" defaultChecked={v.returningParticipant === "on"} />
        Dziecko jest uczestnikiem zajęć RoboPlanet lub poprzednich edycji półkolonii (zniżka 50 zł)
      </label>

      <label className="checkbox">
        <input name="rodoConsent" type="checkbox" defaultChecked={v.rodoConsent === "on"} required />
        Wyrażam zgodę na przetwarzanie podanych danych przez ROBOPLANET EVENTS S.C. w celu obsługi zgłoszenia.
        Klauzula informacyjna dostępna w e-mailu.
      </label>
      {e.rodoConsent && <span className="field-error">{e.rodoConsent}</span>}

      {/* Pułapka na boty – ukryta dla ludzi */}
      <div className="hp" aria-hidden="true">
        <label>
          Zostaw puste
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <button type="submit" disabled={pending}>
        {pending ? "Wysyłanie…" : "Wyślij zgłoszenie"}
      </button>
    </form>
  );
}
