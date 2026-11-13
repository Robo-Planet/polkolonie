import { prisma } from "@/lib/db";
import { PLACE_HOLDING_STATUSES } from "@/lib/status";

// Miejsca na turnusie: limit minus zgłoszenia, które mają miejsce (po zaliczce).
// Formularz bez wpłaty niczego nie blokuje – licznik pokazuje tylko stan.

export async function seatsTaken(turnusId: string): Promise<number> {
  return prisma.application.count({
    where: { turnusId, status: { in: [...PLACE_HOLDING_STATUSES] } },
  });
}

export async function seatsLeft(turnus: { id: string; placeLimit: number }): Promise<number> {
  return Math.max(0, turnus.placeLimit - (await seatsTaken(turnus.id)));
}
