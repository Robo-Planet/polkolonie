import { applicationByToken } from "@/lib/application-by-token";
import { buildUmowaForApplication } from "@/lib/documents/umowa-build";

// Podgląd umowy (PDF) dla rodzica. Tylko z ważnym tokenem i potwierdzonym e-mailem; bez cache.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicationByToken(token);
  if (!app || !app.emailConfirmedAt) return new Response("Not found", { status: 404 });
  const bytes = await buildUmowaForApplication(app.id);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${app.code}_umowa.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
