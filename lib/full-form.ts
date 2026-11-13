import { z } from "zod";
import { birthDateFromPesel } from "@/lib/pesel";
import { fullYearsBetween } from "@/lib/day";
import { isValidPesel, isValidPostalCode, isValidTime, normalizePhone } from "@/lib/validators";

// Pełny formularz rodzica (etap 2). Wejście to tekst z formularza; tu parsujemy i sprawdzamy.
// Dane wrażliwe (PESEL, zdrowie, osoby do odbioru) są pakowane do pól zaszyfrowanych w bazie.

const opt = (max = 500) => z.string().trim().max(max).default("");

export const healthSchema = z.object({
  specialNeeds: opt(1000),
  allergies: opt(1000),
  allergyTypes: z.array(z.string()).default([]),
  chronic: opt(1000),
  motionSickness: z.boolean().default(false),
  medications: opt(1000),
  glassesOrBraces: opt(300),
  diet: opt(500),
  emotions: opt(1000),
  heightFear: z.boolean().default(false),
  waterFear: z.boolean().default(false),
  otherInfo: opt(2000),
  vaccinations: opt(500),
});
export type Health = z.infer<typeof healthSchema>;

export const pickupPersonSchema = z.object({
  name: opt(120),
  phone: opt(30),
});
export type PickupPerson = z.infer<typeof pickupPersonSchema>;

export type FullFormInput = {
  parentFirstName: string;
  parentLastName: string;
  secondParentName: string;
  parentPhoneAlt: string;
  parentAddress: string;
  parentPostalCode: string;
  parentCity: string;
  childFirstName: string;
  childLastName: string;
  pesel: string;
  childSameAddress: boolean;
  childAddress: string;
  childPostalCode: string;
  childCity: string;
  selfReturn: boolean | null;
  pickupTime: string;
  photoConsent: boolean;
  marketingPhotoConsent: boolean;
  regulaminAccepted: boolean;
  healthConsent: boolean;
  health: Health;
  pickupPersons: PickupPerson[];
};

export type FullFormParse =
  | { ok: true; data: FullFormInput; birthDate: Date | null; peselValid: boolean }
  | { ok: false; fieldErrors: Record<string, string> };

/** Parsuje surowe pola formularza. `final` = przy wysłaniu wszystkie wymagane pola muszą być wypełnione. */
export function parseFullForm(
  values: Record<string, string>,
  flags: Record<string, boolean>,
  opts: { final: boolean; turnusStart: Date; minAge: number },
): FullFormParse {
  const errors: Record<string, string> = {};
  const req = (key: string, label: string) => {
    const v = (values[key] ?? "").trim();
    if (opts.final && !v) errors[key] = `${label}: wymagane`;
    return v;
  };

  const pesel = (values.pesel ?? "").replace(/\s/g, "");
  let birthDate: Date | null = null;
  if (pesel) {
    if (!isValidPesel(pesel)) errors.pesel = "PESEL: nieprawidłowa suma kontrolna";
    else birthDate = birthDateFromPesel(pesel);
  } else if (opts.final) {
    errors.pesel = "PESEL: wymagany";
  }
  if (birthDate) {
    const age = fullYearsBetween(birthDate, opts.turnusStart);
    if (age < opts.minAge) errors.pesel = `Dziecko musi mieć co najmniej ${opts.minAge} lat w dniu rozpoczęcia turnusu`;
  }

  const parentPostal = (values.parentPostalCode ?? "").trim();
  if (parentPostal && !isValidPostalCode(parentPostal)) errors.parentPostalCode = "Kod pocztowy: NN-NNN";
  if (opts.final && !parentPostal) errors.parentPostalCode = "Kod pocztowy: wymagany";
  const childPostal = (values.childPostalCode ?? "").trim();
  if (!flags.childSameAddress && childPostal && !isValidPostalCode(childPostal)) errors.childPostalCode = "Kod pocztowy: NN-NNN";

  const phone = (values.parentPhone ?? "").trim();
  if (opts.final && !normalizePhone(phone)) errors.parentPhone = "Telefon: wymagany";
  const phoneAlt = (values.parentPhoneAlt ?? "").trim();
  if (phoneAlt && !normalizePhone(phoneAlt)) errors.parentPhoneAlt = "Telefon: 9 cyfr";

  const pickupTime = (values.pickupTime ?? "").trim();
  if (pickupTime && !isValidTime(pickupTime)) errors.pickupTime = "Godzina: HH:MM";
  if (opts.final && !pickupTime) errors.pickupTime = "Godzina przyprowadzania i odbioru: wymagana";

  if (opts.final && !flags.regulaminAccepted) errors.regulaminAccepted = "Akceptacja regulaminu jest wymagana";
  if (opts.final && !flags.healthConsent) errors.healthConsent = "Zgoda na przetwarzanie danych o zdrowiu jest wymagana";

  const selfReturnRaw = values.selfReturn ?? "";
  const selfReturn = selfReturnRaw === "tak" ? true : selfReturnRaw === "nie" ? false : null;
  if (opts.final && selfReturn === null) errors.selfReturn = "Zgoda na samodzielny powrót: wybierz tak lub nie";

  const childSameAddress = !!flags.childSameAddress;
  if (!childSameAddress && opts.final) {
    if (!(values.childAddress ?? "").trim()) errors.childAddress = "Adres dziecka: wymagany";
    if (!childPostal) errors.childPostalCode = "Kod pocztowy: wymagany";
    if (!(values.childCity ?? "").trim()) errors.childCity = "Miejscowość: wymagana";
  }

  const health = healthSchema.safeParse({
    specialNeeds: values.specialNeeds ?? "",
    allergies: values.allergies ?? "",
    allergyTypes: ["lek", "pyłki", "pokarm", "jad"].filter((t) => flags[`allergy:${t}`]),
    chronic: values.chronic ?? "",
    motionSickness: !!flags.motionSickness,
    medications: values.medications ?? "",
    glassesOrBraces: values.glassesOrBraces ?? "",
    diet: values.diet ?? "",
    emotions: values.emotions ?? "",
    heightFear: !!flags.heightFear,
    waterFear: !!flags.waterFear,
    otherInfo: values.otherInfo ?? "",
    vaccinations: values.vaccinations ?? "",
  });
  if (!health.success) errors._health = "Popraw pola zdrowia (za długi tekst)";

  const pickupPersons: PickupPerson[] = [0, 1, 2, 3]
    .map((i) => ({ name: (values[`pickupName${i}`] ?? "").trim(), phone: (values[`pickupPhone${i}`] ?? "").trim() }))
    .filter((p) => p.name || p.phone);
  for (const p of pickupPersons) {
    if (p.name && !p.phone) errors._pickup = "Osoba do odbioru: podaj też telefon";
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    birthDate,
    peselValid: !!pesel && isValidPesel(pesel),
    data: {
      parentFirstName: req("parentFirstName", "Imię rodzica"),
      parentLastName: req("parentLastName", "Nazwisko rodzica"),
      secondParentName: (values.secondParentName ?? "").trim(),
      parentPhoneAlt: phoneAlt,
      parentAddress: req("parentAddress", "Adres rodziców"),
      parentPostalCode: parentPostal,
      parentCity: req("parentCity", "Miejscowość"),
      childFirstName: req("childFirstName", "Imię dziecka"),
      childLastName: req("childLastName", "Nazwisko dziecka"),
      pesel,
      childSameAddress,
      childAddress: childSameAddress ? "" : (values.childAddress ?? "").trim(),
      childPostalCode: childSameAddress ? "" : childPostal,
      childCity: childSameAddress ? "" : (values.childCity ?? "").trim(),
      selfReturn,
      pickupTime,
      photoConsent: !!flags.photoConsent,
      marketingPhotoConsent: !!flags.marketingPhotoConsent,
      regulaminAccepted: !!flags.regulaminAccepted,
      healthConsent: !!flags.healthConsent,
      health: health.success ? health.data : healthSchema.parse({}),
      pickupPersons,
    },
  };
}
