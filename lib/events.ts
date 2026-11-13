import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";

// Dziennik zdarzeń: każda zmiana zgłoszenia lub konfiguracji (kto, kiedy, co było, co jest).

export type EventInput = {
  applicationId?: string | null;
  actor: string;
  action: string;
  before?: unknown;
  after?: unknown;
  note?: string;
};

export async function logEvent(input: EventInput): Promise<void> {
  await prisma.event.create({
    data: {
      applicationId: input.applicationId ?? null,
      actor: input.actor,
      action: input.action,
      before: input.before === undefined ? undefined : (input.before as Prisma.InputJsonValue),
      after: input.after === undefined ? undefined : (input.after as Prisma.InputJsonValue),
      note: input.note,
    },
  });
}
