import { z } from "zod";

// Zmienne środowiskowe czytane leniwie (przy pierwszym użyciu), żeby `next build`
// nie wymagał sekretów. Walidacja z zod; błąd zawiera nazwy brakujących zmiennych, nie wartości.

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET musi mieć min. 32 znaki"),
  APP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "APP_ENCRYPTION_KEY: 32 bajty w base64"),
  MAIL_TRANSPORT: z.enum(["log", "smtp"]).default("log"),
  MAIL_FROM: z.string().default("ROBOPLANET EVENTS S.C. <polkolonie@roboplanet.pl>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Błędna konfiguracja środowiska: ${names}`);
  }
  cached = parsed.data;
  return cached;
}
