import { ApplicationStatus } from "@/lib/generated/prisma/enums";

// Statusy zgłoszenia (specyfikacja, sekcja "Statusy zgłoszenia") i nazwane predykaty.

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  ZGLOSZONE: "Zgłoszone (krótki formularz)",
  UMOWA_ZAWARTA: "Umowa zawarta (czeka na zaliczkę)",
  MIEJSCE: "Ma miejsce (po zaliczce)",
  KWALIFIKACJA: "Zakwalifikowane (karta przyjęta)",
  OPLACONE: "Opłacone (dopłata wpłacona)",
  ODMOWA: "Odmowa (zwrot wpłat)",
  WYGASLA: "Anulowane (brak kaucji w terminie, § 1 ust. 2)",
  REZERWA: "Rezerwa (brak miejsc)",
};

/** Statusy, w których zgłoszenie zajmuje miejsce na turnusie. */
export const PLACE_HOLDING_STATUSES: readonly ApplicationStatus[] = ["MIEJSCE", "KWALIFIKACJA", "OPLACONE"];

export function holdsPlace(status: ApplicationStatus): boolean {
  return PLACE_HOLDING_STATUSES.includes(status);
}

/** Statusy końcowe – zgłoszenia w nich nie dostają już przypomnień. */
export function isClosed(status: ApplicationStatus): boolean {
  return status === "ODMOWA" || status === "WYGASLA";
}
