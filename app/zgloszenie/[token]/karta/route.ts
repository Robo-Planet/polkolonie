import { applicationByToken } from "@/lib/application-by-token";
import { buildKartaPdf } from "@/lib/pdf/karta";
import { kartaDataFor } from "@/lib/pdf/karta-data";

// Podgląd karty kwalifikacyjnej (PDF) dla rodzica. Dostęp tylko z ważnym tokenem i potwierdzonym e-mailem.
// Odpowiedź nie jest cache'owana i nie jest indeksowana (zawiera dane szczególne).
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicationByToken(token);
  if (!app || !app.emailConfirmedAt) return new Response("Not found", { status: 404 });
  const bytes = await buildKartaPdf(kartaDataFor(app));
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${app.code}_karta.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
