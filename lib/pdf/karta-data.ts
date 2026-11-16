import { decryptField } from "@/lib/crypto";
import type { KartaData } from "@/lib/pdf/karta";
import { birthDateFromPesel } from "@/lib/pesel";
import type { Application, Turnus } from "@/lib/generated/prisma/client";

// Zamienia zgłoszenie z bazy na dane karty (odszyfrowuje PESEL i zdrowie). Wywoływane tylko po weryfikacji tokenu.
export function kartaDataFor(app: Application & { turnus: Turnus }): KartaData {
  const pesel = app.peselEnc ? decryptField(app.peselEnc) : "";
  const sensitive = app.healthEnc
    ? (JSON.parse(decryptField(app.healthEnc)) as { health: KartaData["health"] })
    : { health: null };
  const h = sensitive.health ?? {
    specialNeeds: "", allergies: "", allergyTypes: [], chronic: "", motionSickness: false, medications: "",
    glassesOrBraces: "", diet: "", emotions: "", heightFear: false, waterFear: false, otherInfo: "", vaccinations: "",
  };
  const parentNames = [`${app.parentFirstName} ${app.parentLastName}`, app.secondParentName].filter(Boolean).join(", ");
  const phones = [app.parentPhone, app.parentPhoneAlt].filter(Boolean).join(", ");
  const childAddress = app.childSameAddress ? app.parentAddress ?? "" : app.childAddress ?? "";
  const childPostal = app.childSameAddress ? app.parentPostalCode ?? "" : app.childPostalCode ?? "";
  const childCity = app.childSameAddress ? app.parentCity ?? "" : app.childCity ?? "";
  return {
    code: app.code,
    turnus: { number: app.turnus.number, startDate: app.turnus.startDate, endDate: app.turnus.endDate, venue: app.turnus.venue },
    child: {
      firstName: app.childFirstName,
      lastName: app.childLastName ?? "",
      birthYear: pesel ? (birthDateFromPesel(pesel)?.getUTCFullYear() ?? null) : null,
      pesel,
      address: childAddress,
      postal: childPostal,
      city: childCity,
    },
    parents: {
      names: parentNames,
      address: app.parentAddress ?? "",
      postal: app.parentPostalCode ?? "",
      city: app.parentCity ?? "",
      phones,
    },
    health: h,
  };
}
