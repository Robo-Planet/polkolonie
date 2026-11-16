import { prisma } from "@/lib/db";
import { decryptField } from "@/lib/crypto";
import { daysBetween, todayUtc } from "@/lib/day";
import { birthDateFromPesel } from "@/lib/pesel";
import { buildUmowaFields } from "@/lib/documents/umowa-fields";
import { renderUmowaBlocks } from "@/lib/documents/umowa-render";
import { UMOWA_TEMPLATE_VERSION, UMOWA_TEMPLATE_EFFECTIVE } from "@/lib/documents/umowa-template";
import { buildUmowaPdf } from "@/lib/pdf/umowa";

// Składa umowę dla zgłoszenia: dane z bazy → pola wzoru → PDF. Przed wysłaniem formularza to podgląd
// (data zawarcia = dziś, stopka z oznaczeniem podglądu).
export async function buildUmowaForApplication(
  applicationId: string,
  signing?: { date: Date; png: Uint8Array },
): Promise<Uint8Array> {
  const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId }, include: { turnus: true } });
  const organizer = await prisma.organizer.findUniqueOrThrow({ where: { id: 1 } });
  // Data zawarcia: dzień podpisu (przy podpisie), a po podpisie – dzień zapisany w zgłoszeniu.
  const contractDate = todayUtc(signing?.date ?? app.contractSignedAt ?? new Date());
  const late = daysBetween(contractDate, app.turnus.startDate) < 14;
  const price = app.turnus.priceGrosze - (app.returningParticipant ? app.turnus.discountGrosze : 0);
  const deposit = Math.min(app.turnus.depositGrosze, price);
  const childPesel = app.peselEnc ? decryptField(app.peselEnc) : "";
  const parentPesel = app.parentPeselEnc ? decryptField(app.parentPeselEnc) : "";
  const childBirth = birthDateFromPesel(childPesel);
  if (!childBirth) throw new Error("Brak poprawnego PESEL dziecka – nie można złożyć umowy");

  const fields = buildUmowaFields({
    organizer,
    application: app,
    turnus: app.turnus,
    parentPesel,
    childPesel,
    childBirthDate: childBirth,
    contractDate,
    late,
    totalGrosze: price,
    depositGrosze: deposit,
  });
  const signed = signing ?? (app.contractSignedAt ? { date: app.contractSignedAt } : undefined);
  const withDate = { ...fields, data_podpisu: signed ? PL_DATE(signed.date) : "" };
  const blocks = renderUmowaBlocks(withDate, { late });
  const preview = signed ? "" : " · PODGLĄD (jeszcze nie zawarta)";
  const footer = `Wzór umowy v${UMOWA_TEMPLATE_VERSION}, obowiązuje od ${UMOWA_TEMPLATE_EFFECTIVE} · zgłoszenie ${app.code}${preview}`;
  return buildUmowaPdf(blocks, footer, { signaturePng: signing?.png });
}

const PL_DATE = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join(".");


