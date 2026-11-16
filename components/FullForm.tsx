"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/form-state";
import { initialFormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function FullForm({ action, defaults, minAge }: { action: Action; defaults: Record<string, string>; minAge: number }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const v = { ...defaults, ...(state.values ?? {}) };
  const e = state.fieldErrors ?? {};
  const flags: Record<string, string> = safeJson(v.flags, {});
  const allergyTypes: string[] = safeJson(v.allergyTypes, []);
  const pickups: { name: string; phone: string }[] = safeJson(v.pickupPersons, []);
  const on = (name: string) => (state.values ? state.values[name] === "on" : flags[name] === "on");
  const err = (name: string) => e[name] && <span className="field-error">{e[name]}</span>;

  if (state.ok && state.submitted) {
    return (
      <div role="status" className="notice success">
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    // key zmienia się po każdej odpowiedzi z wartościami, więc pola startują od aktualnego stanu
    // (React 19 czyści formularz po akcji, a selecty nie odświeżają defaultValue).
    <form key={JSON.stringify(state.values ?? {})} action={formAction} className="stack" noValidate>
      {state.error && <div role="alert" className="notice error">{state.error}</div>}
      {state.ok && state.message && <div role="status" className="notice success">{state.message}</div>}

      <h2>Rodzice</h2>
      <div className="row">
        <label>Imię osoby zawierającej umowę<input name="parentFirstName" defaultValue={v.parentFirstName} required />{err("parentFirstName")}</label>
        <label>Nazwisko<input name="parentLastName" defaultValue={v.parentLastName} required />{err("parentLastName")}</label>
      </div>
      <label>PESEL osoby zawierającej umowę (szyfrowany, tylko w umowie)<input name="parentPesel" inputMode="numeric" maxLength={11} defaultValue={v.parentPesel} required />{err("parentPesel")}</label>
      <label>Drugi rodzic (imię i nazwisko, opcjonalnie)<input name="secondParentName" defaultValue={v.secondParentName} /></label>
      <label>Adres zamieszkania rodziców<input name="parentAddress" defaultValue={v.parentAddress} required />{err("parentAddress")}</label>
      <div className="row">
        <label>Kod pocztowy<input name="parentPostalCode" placeholder="00-000" defaultValue={v.parentPostalCode} required />{err("parentPostalCode")}</label>
        <label>Miejscowość<input name="parentCity" defaultValue={v.parentCity} required />{err("parentCity")}</label>
      </div>
      <div className="row">
        <label>Telefon (dostępny w czasie turnusu)<input name="parentPhone" type="tel" defaultValue={v.parentPhone} required />{err("parentPhone")}</label>
        <label>Drugi telefon (opcjonalnie)<input name="parentPhoneAlt" type="tel" defaultValue={v.parentPhoneAlt} />{err("parentPhoneAlt")}</label>
      </div>
      <label>E-mail (z krótkiego zgłoszenia)<input value={v.parentEmail} readOnly disabled /></label>

      <h2>Dziecko</h2>
      <div className="row">
        <label>Imię (imiona)<input name="childFirstName" defaultValue={v.childFirstName} required />{err("childFirstName")}</label>
        <label>Nazwisko<input name="childLastName" defaultValue={v.childLastName} required />{err("childLastName")}</label>
      </div>
      <label>PESEL (wiek: min. {minAge} lat w dniu rozpoczęcia turnusu)
        <input name="pesel" inputMode="numeric" maxLength={11} defaultValue={v.pesel} required />{err("pesel")}
      </label>
      <label className="checkbox">
        <input name="childSameAddress" type="checkbox" defaultChecked={on("childSameAddress")} />
        Adres dziecka taki sam jak rodziców
      </label>
      <div className="row">
        <label>Adres dziecka<input name="childAddress" defaultValue={v.childAddress} />{err("childAddress")}</label>
        <label>Kod pocztowy<input name="childPostalCode" placeholder="00-000" defaultValue={v.childPostalCode} />{err("childPostalCode")}</label>
        <label>Miejscowość<input name="childCity" defaultValue={v.childCity} />{err("childCity")}</label>
      </div>

      <h2>Zdrowie (dane szczególne, szyfrowane)</h2>
      <label>Specjalne potrzeby edukacyjne (niepełnosprawność, niedostosowanie społeczne)<textarea name="specialNeeds" defaultValue={v.specialNeeds} /></label>
      <fieldset className="checks">
        <legend>Uczulenia</legend>
        {[["lek", "leki"], ["pyłki", "pyłki"], ["pokarm", "pokarmy"], ["jad", "jad owadów"]].map(([key, label]) => (
          <label key={key} className="checkbox">
            <input name={`allergy:${key}`} type="checkbox" defaultChecked={allergyTypes.includes(key)} /> {label}
          </label>
        ))}
        <textarea name="allergies" placeholder="Opis" defaultValue={v.allergies} />
      </fieldset>
      <label>Choroby przewlekłe<textarea name="chronic" defaultValue={v.chronic} /></label>
      <label className="checkbox"><input name="motionSickness" type="checkbox" defaultChecked={on("motionSickness")} /> Choroba lokomocyjna</label>
      <label>Leki przyjmowane na stałe (lek, dawka, pora)<textarea name="medications" defaultValue={v.medications} /></label>
      <label>Aparat ortodontyczny, okulary, soczewki<input name="glassesOrBraces" defaultValue={v.glassesOrBraces} /></label>
      <label>Dieta (np. niskokaloryczna, wegetariańska, bez glutenu)<input name="diet" defaultValue={v.diet} /></label>
      <label>Problemy z wyrażaniem emocji lub funkcjonowaniem w grupie (opis, jeśli tak)<textarea name="emotions" defaultValue={v.emotions} /></label>
      <label className="checkbox"><input name="heightFear" type="checkbox" defaultChecked={on("heightFear")} /> Lęk wysokości</label>
      <label className="checkbox"><input name="waterFear" type="checkbox" defaultChecked={on("waterFear")} /> Hydrofobia</label>
      <label>Inne istotne informacje o zdrowiu i rozwoju<textarea name="otherInfo" defaultValue={v.otherInfo} /></label>
      <label>Szczepienia: tężec, błonica, inne (z rokiem), albo oświadczenie o książeczce<input name="vaccinations" defaultValue={v.vaccinations} /></label>

      <h2>Odbiór</h2>
      <label>Zgoda na samodzielny powrót<select name="selfReturn" defaultValue={v.selfReturn}><option value="">— wybierz —</option><option value="tak">tak</option><option value="nie">nie</option></select>{err("selfReturn")}</label>
      <label>Godzina przyprowadzania i odbioru (w godzinach turnusu)<input name="pickupTime" type="time" defaultValue={v.pickupTime} />{err("pickupTime")}</label>
      {[0, 1, 2, 3].map((i) => (
        <div className="row" key={i}>
          <label>Osoba upoważniona do odbioru {i + 1}<input name={`pickupName${i}`} defaultValue={pickups[i]?.name ?? ""} /></label>
          <label>Telefon<input name={`pickupPhone${i}`} type="tel" defaultValue={pickups[i]?.phone ?? ""} /></label>
        </div>
      ))}
      {err("_pickup")}

      <h2>Zgody</h2>
      <label className="checkbox"><input name="photoConsent" type="checkbox" defaultChecked={on("photoConsent")} /> Zdjęcia w trakcie półkolonii (opcjonalnie)</label>
      <label className="checkbox"><input name="marketingPhotoConsent" type="checkbox" defaultChecked={on("marketingPhotoConsent")} /> Wykorzystanie zdjęć w marketingu (opcjonalnie)</label>
      <label className="checkbox"><input name="regulaminAccepted" type="checkbox" defaultChecked={on("regulaminAccepted")} /> Akceptuję regulamin i oświadczenia z umowy</label>
      {err("regulaminAccepted")}
      <label className="checkbox"><input name="healthConsent" type="checkbox" defaultChecked={on("healthConsent")} /> Wyrażam wyraźną zgodę na przetwarzanie danych o zdrowiu dziecka (art. 9 ust. 2 lit. a RODO) w celu organizacji turnusu.</label>
      {err("healthConsent")}
      {err("_health")}

      <div className="row">
        <button type="submit" name="intent" value="draft" disabled={pending} className="secondary">Zapisz szkic</button>
        <button type="submit" name="intent" value="submit" disabled={pending}>{pending ? "Wysyłanie…" : "Wyślij formularz"}</button>
      </div>
    </form>
  );
}

function safeJson<T>(raw: string | undefined, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
