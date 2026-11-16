import { prisma } from "@/lib/db";
import { encryptField, sha256Hex } from "@/lib/crypto";
import { env } from "@/lib/env";
import { logEvent } from "@/lib/events";
import { sendMail } from "@/lib/mail";
import { applicationByToken } from "@/lib/application-by-token";
import { buildUmowaForApplication } from "@/lib/documents/umowa-build";
import { UMOWA_TEMPLATE_VERSION } from "@/lib/documents/umowa-template";
import { ensureCharges } from "@/lib/payments/service";
import { buildKartaPdf } from "@/lib/pdf/karta";
import { kartaDataFor } from "@/lib/pdf/karta-data";
import { checkSignCode, hashSignCode, newSignCode, SIGN_CODE_TTL_MS } from "@/lib/signing/code";

// Podpis na ekranie: kod e-mailem → rysunek podpisu → zawarcie umowy.
// Zapisywane są: dowód podpisu (czas, IP, przeglądarka, potwierdzenie kodu, skrót PDF), podpisany PDF,
// data zawarcia i status. Należności powstają dopiero po zawarciu umowy.

const MAX_CODES_PER_HOUR = 5;
const MAX_SIGNATURE_BYTES = 300_000;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type SignResult = { ok: true; message: string } | { ok: false; error: string };

function signable(app: { formSubmittedAt: Date | null; emailConfirmedAt: Date | null; contractSignedAt: Date | null }): string | null {
  if (!app.emailConfirmedAt) return "Najpierw potwierdź adres e-mail.";
  if (!app.formSubmittedAt) return "Najpierw wyślij pełny formularz.";
  if (app.contractSignedAt) return "Umowa jest już zawarta.";
  return null;
}

/** Wysyła 6-cyfrowy kod. Poprzednie kody przestają działać. Limit: kilka kodów na godzinę. */
export async function requestSignCode(token: string): Promise<SignResult> {
  const app = await applicationByToken(token);
  if (!app) return { ok: false, error: "Link jest nieaktywny. Skontaktuj się z biurem." };
  const problem = signable(app);
  if (problem) return { ok: false, error: problem };

  const hourAgo = new Date(Date.now() - 60 * 60_000);
  const recent = await prisma.signCode.count({ where: { applicationId: app.id, createdAt: { gte: hourAgo } } });
  if (recent >= MAX_CODES_PER_HOUR) return { ok: false, error: "Wysłano już wiele kodów. Spróbuj ponownie za godzinę." };

  const now = new Date();
  const code = newSignCode();
  await prisma.$transaction([
    prisma.signCode.updateMany({ where: { applicationId: app.id, consumedAt: null }, data: { consumedAt: now } }),
    prisma.signCode.create({
      data: { applicationId: app.id, codeHash: hashSignCode(code, app.id), expiresAt: new Date(now.getTime() + SIGN_CODE_TTL_MS) },
    }),
  ]);
  await sendMail({
    to: app.parentEmail,
    subject: `Kod do podpisu umowy – ${app.code}`,
    text: [
      "Dzień dobry,",
      "",
      `kod potwierdzający podpis umowy za zgłoszenie ${app.code}: ${code}`,
      "Kod jest ważny 10 minut. Jeśli nie podpisujesz umowy, zignoruj tę wiadomość.",
      "",
      "ROBOPLANET EVENTS S.C.",
    ].join("\n"),
  });
  await logEvent({ applicationId: app.id, actor: "rodzic", action: "sign.code_sent" });
  return { ok: true, message: `Wysłaliśmy kod na adres ${app.parentEmail}. Jest ważny 10 minut.` };
}

/** Potwierdza kodem i zawiera umowę z podpisem rodzica. */
export async function signContract(
  token: string,
  input: { code: string; signatureDataUrl: string; summaryAck: boolean; ip: string | null; userAgent: string | null },
): Promise<SignResult> {
  const app = await applicationByToken(token);
  if (!app) return { ok: false, error: "Link jest nieaktywny. Skontaktuj się z biurem." };
  const problem = signable(app);
  if (problem) return { ok: false, error: problem };

  if (!input.summaryAck) return { ok: false, error: "Potwierdź, że zapoznałeś się z podsumowaniem, umową i kartą." };
  const match = /^data:image\/png;base64,(.+)$/.exec(input.signatureDataUrl);
  if (!match) return { ok: false, error: "Złóż podpis na ekranie." };
  const png = Buffer.from(match[1], "base64");
  if (png.length > MAX_SIGNATURE_BYTES || !png.subarray(0, 8).equals(PNG_MAGIC)) {
    return { ok: false, error: "Podpis ma nieprawidłowy format. Złóż go ponownie." };
  }

  const now = new Date();
  const record = await prisma.signCode.findFirst({
    where: { applicationId: app.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, error: "Najpierw poproś o kod na e-mail." };

  const check = checkSignCode(record, input.code, app.id, now);
  if (!check.ok) {
    if (check.reason === "mismatch") {
      await prisma.signCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      await logEvent({ applicationId: app.id, actor: "rodzic", action: "sign.code_failed" });
      return { ok: false, error: "Nieprawidłowy kod." };
    }
    if (check.reason === "expired") return { ok: false, error: "Kod wygasł. Poproś o nowy." };
    return { ok: false, error: "Za dużo błędnych prób. Poproś o nowy kod." };
  }

  // Umowa z datą dzisiejszą i podpisem; ten sam PDF, który zobaczy rodzic.
  const pdf = Buffer.from(await buildUmowaForApplication(app.id, { date: now, png }));
  const sha = sha256Hex(pdf);
  // Karta kwalifikacyjna z tym samym podpisem rodzica (część II).
  const withTurnus = await prisma.application.findUniqueOrThrow({ where: { id: app.id }, include: { turnus: true } });
  const karta = Buffer.from(await buildKartaPdf(kartaDataFor(withTurnus), { signaturePng: png }));
  const kartaSha = sha256Hex(karta);
  const fresh = await prisma.application.findUniqueOrThrow({ where: { id: app.id } });

  await prisma.$transaction([
    prisma.signCode.update({ where: { id: record.id }, data: { consumedAt: now } }),
    prisma.signature.create({
      data: {
        applicationId: app.id,
        method: "SCREEN",
        signedAt: now,
        ip: input.ip,
        userAgent: input.userAgent,
        codeConfirmedAt: now,
        pdfSha256: sha,
        kartaSha256: kartaSha,
        signatureImageEnc: encryptField(png.toString("base64")),
        templateVersion: UMOWA_TEMPLATE_VERSION,
      },
    }),
    prisma.document.create({
      data: { applicationId: app.id, kind: "UMOWA_PODPISANA", templateVersion: UMOWA_TEMPLATE_VERSION, sha256: sha, bytes: pdf },
    }),
    prisma.document.create({
      data: { applicationId: app.id, kind: "KARTA_PODPISANA", templateVersion: 1, sha256: kartaSha, bytes: karta },
    }),
    prisma.application.update({
      where: { id: app.id },
      data: {
        contractSignedAt: now,
        contractSignatureSha256: sha,
        summaryAckAt: now,
        contractTemplateVersion: UMOWA_TEMPLATE_VERSION,
        status: fresh.status === "ZGLOSZONE" ? "UMOWA_ZAWARTA" : fresh.status,
        statusChangedAt: now,
      },
    }),
  ]);
  await logEvent({
    applicationId: app.id,
    actor: "rodzic",
    action: "contract.signed",
    after: { method: "SCREEN", pdfSha256: sha, templateVersion: UMOWA_TEMPLATE_VERSION },
  });
  await ensureCharges(app.id);
  await sendMail({
    to: app.parentEmail,
    subject: `Umowa zawarta – ${app.code}`,
    text: [
      "Dzień dobry,",
      "",
      `umowa za zgłoszenie ${app.code} została zawarta. Podpisany dokument: ${env().APP_URL}/zgloszenie/${token}/umowa-podpisana`,
      "Prosimy o wpłatę kaucji rezerwacyjnej w terminie podanym w umowie. Dane do przelewu są w umowie.",
      "",
      "ROBOPLANET EVENTS S.C.",
    ].join("\n"),
  });
  return { ok: true, message: "Umowa została zawarta. Kopię otrzymasz e-mailem." };
}
