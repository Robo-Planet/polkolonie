import nodemailer from "nodemailer";
import { env } from "@/lib/env";

// Wysyłka e-maili. MAIL_TRANSPORT=log wypisuje wiadomość w konsoli (tylko lokalnie / testy).
// Produkcja: osobny użytkownik SMTP tej aplikacji, nie konto zapisów.

export type MailMessage = { to: string; subject: string; text: string };

let transporter: nodemailer.Transporter | undefined;

function smtp(): nodemailer.Transporter {
  if (!transporter) {
    const e = env();
    if (!e.SMTP_HOST || !e.SMTP_USER || !e.SMTP_PASSWORD) {
      throw new Error("MAIL_TRANSPORT=smtp wymaga SMTP_HOST, SMTP_USER i SMTP_PASSWORD");
    }
    transporter = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_PORT === 465,
      auth: { user: e.SMTP_USER, pass: e.SMTP_PASSWORD },
    });
  }
  return transporter;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const e = env();
  if (e.MAIL_TRANSPORT === "log") {
    console.info(`[mail:log] do=${message.to} temat=${message.subject}\n${message.text}\n`);
    return;
  }
  await smtp().sendMail({ from: e.MAIL_FROM, to: message.to, subject: message.subject, text: message.text });
}
