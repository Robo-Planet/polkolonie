import { env } from "@/lib/env";
import { runReminders } from "@/lib/payments/reminders";

// Zadanie dzienne (Vercel Cron). Wymaga nagłówka Authorization: Bearer <CRON_SECRET>.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const summary = await runReminders();
  return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
}
