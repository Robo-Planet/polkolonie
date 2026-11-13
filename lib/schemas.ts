import { z } from "zod";
import { isValidNip, isValidPostalCode, isValidTime, normalizePhone } from "@/lib/validators";
import { parseDay } from "@/lib/day";

// Schematy wejścia (zod). Wartości z formularzy są zawsze tekstem; tu je parsujemy i sprawdzamy.

const text = (label: string, max = 80) =>
  z
    .string({ error: `${label}: wymagane` })
    .trim()
    .min(2, `${label}: min. 2 znaki`)
    .max(max, `${label}: max. ${max} znaków`);

const phone = z
  .string({ error: "Telefon: wymagany" })
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Telefon: 9 cyfr, np. 600 123 456" });
    return n ?? v;
  });

/** Krótkie zgłoszenie z formularza publicznego. */
export const shortApplicationSchema = z.object({
  turnusId: z.string({ error: "Wybierz turnus" }).min(1, "Wybierz turnus"),
  parentFirstName: text("Imię rodzica"),
  parentLastName: text("Nazwisko rodzica"),
  parentEmail: z.email({ error: "Podaj poprawny e-mail" }).trim().max(120),
  parentPhone: phone,
  childFirstName: text("Imię dziecka"),
  returningParticipant: z.boolean(),
  rodoConsent: z.boolean().refine((v) => v, "Zgoda na przetwarzanie danych jest wymagana"),
});
export type ShortApplicationInput = z.infer<typeof shortApplicationSchema>;

/** Turnus: tworzenie i edycja w panelu biura. Kwoty w PLN, zamieniane na grosze w akcji. */
export const turnusSchema = z
  .object({
    number: z.string().trim().min(1, "Numer turnusu: wymagany").max(10),
    season: z.string().trim().regex(/^[A-Z0-9]{2,6}$/, "Sezon: 2–6 znaków A–Z/0–9, np. Z27"),
    startDate: z.string().refine((v) => isDay(v), "Data początku: format RRRR-MM-DD"),
    endDate: z.string().refine((v) => isDay(v), "Data końca: format RRRR-MM-DD"),
    hoursFrom: z.string().refine(isValidTime, "Godzina od: HH:MM"),
    hoursTo: z.string().refine(isValidTime, "Godzina do: HH:MM"),
    venue: z.string().trim().min(5, "Miejsce wypoczynku: podaj adres").max(200),
    placeLimit: z.coerce.number({ error: "Limit miejsc: liczba" }).int().min(1).max(500),
    minAge: z.coerce.number().int().min(6, "Minimalny wiek to co najmniej 6 lat").max(18).default(6),
    price: z.string().trim().min(1, "Cena: wymagana"),
    deposit: z.string().trim().min(1, "Zaliczka: wymagana"),
    discount: z.string().trim().min(1, "Zniżka: wymagana"),
    active: z.boolean().default(false),
  })
  .refine((v) => !isDay(v.startDate) || !isDay(v.endDate) || parseDay(v.endDate) >= parseDay(v.startDate), {
    message: "Data końca nie może być przed datą początku",
    path: ["endDate"],
  });
export type TurnusInput = z.infer<typeof turnusSchema>;

/** Dane organizatora do umowy. */
export const organizerSchema = z.object({
  name: text("Nazwa organizatora", 120),
  nip: z.string().trim().refine(isValidNip, "NIP: nieprawidłowy (10 cyfr, suma kontrolna)"),
  street: text("Ulica", 120),
  postalCode: z.string().trim().refine(isValidPostalCode, "Kod pocztowy: NN-NNN"),
  city: text("Miejscowość", 80),
  bankName: text("Nazwa banku", 80),
  bankAccount: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => /^\d{26}$/.test(v), "Numer konta: 26 cyfr"),
});
export type OrganizerInput = z.infer<typeof organizerSchema>;

function isDay(v: string): boolean {
  try {
    parseDay(v);
    return true;
  } catch {
    return false;
  }
}

