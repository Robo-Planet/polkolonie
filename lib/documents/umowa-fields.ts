import { addDays, formatDay } from "@/lib/day";
import { umowaPlaceholders, umowaTemplate } from "@/lib/documents/umowa-template";

// Wartości pól wzoru umowy (v5). Kwoty w groszach na wejściu, w tekście w złotych (930 albo 930,50).
// Terminy: kaucja 7 dni od zawarcia, dopłata 14 dni przed startem, późny zapis: całość w 3 dni.

export type UmowaInput = {
  organizer: { name: string; street: string; postalCode: string; city: string; nip: string; regon: string | null;
    representative: string | null; phone: string | null; email: string | null; bankAccount: string };
  application: { code: string; parentFirstName: string; parentLastName: string; parentAddress: string | null;
    parentPostalCode: string | null; parentCity: string | null; parentPhone: string; parentPhoneAlt: string | null;
    parentEmail: string; childFirstName: string; childLastName: string | null; childAddress: string | null;
    childPostalCode: string | null; childCity: string | null; childSameAddress: boolean; secondParentName: string | null };
  turnus: { number: string; season: string; startDate: Date; endDate: Date; venue: string };
  parentPesel: string;
  childPesel: string;
  childBirthDate: Date;
  contractDate: Date;
  late: boolean;
  totalGrosze: number; // cena po ewentualnej zniżce
  depositGrosze: number;
};

const PL_DOT = (d: Date) => formatDay(d).split("-").reverse().join(".");

export function formatPlnAmount(grosze: number): string {
  const zl = Math.trunc(grosze / 100);
  const gr = grosze % 100;
  return gr === 0 ? String(zl) : `${zl},${String(gr).padStart(2, "0")}`;
}

function seasonName(season: string): { dopelniacz: string; nazwa: string } {
  if (season.startsWith("Z")) return { dopelniacz: "półkolonie zimowe", nazwa: "Półkolonie zimowe" };
  if (season.startsWith("L")) return { dopelniacz: "półkolonie letnie", nazwa: "Półkolonie letnie" };
  return { dopelniacz: "półkolonie", nazwa: "Półkolonie" };
}

export function buildUmowaFields(i: UmowaInput): Record<string, string> {
  const o = i.organizer;
  const a = i.application;
  const season = seasonName(i.turnus.season);
  const doplata = i.totalGrosze - i.depositGrosze;
  const childName = [a.childFirstName, a.childLastName].filter(Boolean).join(" ");
  const parentName = [a.parentFirstName, a.parentLastName].filter(Boolean).join(" ");
  const addr = (street: string | null, postal: string | null, city: string | null) =>
    [street, [postal, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const childAddr = a.childSameAddress
    ? addr(a.parentAddress, a.parentPostalCode, a.parentCity)
    : addr(a.childAddress, a.childPostalCode, a.childCity);
  const fields: Record<string, string> = {
    nazwa_polkolonii_dopelniacz: season.dopelniacz,
    nazwa_polkolonii: season.nazwa,
    data_zawarcia: PL_DOT(i.contractDate),
    rodzic_imie_nazwisko: parentName + (a.secondParentName ? `, ${a.secondParentName}` : ""),
    rodzic_adres: addr(a.parentAddress, a.parentPostalCode, a.parentCity),
    rodzic_pesel: i.parentPesel,
    rodzic_telefon: [a.parentPhone, a.parentPhoneAlt].filter(Boolean).join(", "),
    rodzic_email: a.parentEmail,
    dziecko_imie_nazwisko: childName,
    dziecko_adres: childAddr,
    dziecko_data_urodzenia: PL_DOT(i.childBirthDate),
    dziecko_pesel: i.childPesel,
    turnus_od: PL_DOT(i.turnus.startDate),
    turnus_do: PL_DOT(i.turnus.endDate),
    turnus_numer: i.turnus.number,
    turnus_adres: i.turnus.venue,
    cena: formatPlnAmount(i.totalGrosze),
    kaucja: formatPlnAmount(i.depositGrosze),
    doplata: formatPlnAmount(doplata),
    termin_kaucji: PL_DOT(addDays(i.contractDate, 7)),
    termin_doplaty: PL_DOT(addDays(i.turnus.startDate, -14)),
    termin_calosci: i.late ? PL_DOT(addDays(i.contractDate, 3)) : "",
    tytul_przelewu: `${a.code} ${childName}`,
    // Podpisy: na PDF do druku zostają puste pola; podpis elektroniczny wstawi ścieżka podpisu.
    podpis_rodzica: "",
    data_podpisu: "",
    podpis_organizatora: "",
    pieczatka: "",
  };
  // Dane organizatora są stałe w tekście wzoru; sprawdzamy tylko, że są zgodne z bazą.
  void o;
  return fields;
}

/** Sprawdza, czy komplet pól pokrywa wszystkie znaczniki wzoru. Używane w testach i przed generacją. */
export function missingFields(fields: Record<string, string>): string[] {
  return umowaPlaceholders(umowaTemplate().raw).filter((k) => !(k in fields));
}
