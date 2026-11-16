import { prisma } from "@/lib/db";
import { applicationByToken } from "@/lib/application-by-token";

// Podpisana umowa (PDF) dla rodzica. Tylko z ważnym tokenem; bez cache.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicationByToken(token);
  if (!app || !app.contractSignedAt) return new Response("Not found", { status: 404 });
  const doc = await prisma.document.findUnique({
    where: { applicationId_kind: { applicationId: app.id, kind: "UMOWA_PODPISANA" } },
  });
  if (!doc) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(doc.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${app.code}_umowa_podpisana.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
