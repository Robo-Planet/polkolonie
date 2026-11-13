"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { parseDay } from "@/lib/day";
import { logEvent } from "@/lib/events";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { parsePlnToGrosze } from "@/lib/money";
import { PLACE_HOLDING_STATUSES } from "@/lib/status";
import { turnusSchema, type TurnusInput } from "@/lib/schemas";

// Tworzenie i edycja turnusu w panelu biura. Każda zmiana trafia do dziennika zdarzeń.

type TurnusData = {
  number: string;
  season: string;
  startDate: Date;
  endDate: Date;
  hoursFrom: string;
  hoursTo: string;
  venue: string;
  placeLimit: number;
  minAge: number;
  priceGrosze: number;
  depositGrosze: number;
  discountGrosze: number;
  active: boolean;
};

type ParseResult = { ok: true; data: TurnusData } | { ok: false; state: FormState };

const MONEY_FIELDS = ["price", "deposit", "discount"] as const;

function parseTurnusForm(formData: FormData): ParseResult {
  const values = formValues(formData);
  const parsed = turnusSchema.safeParse({
    number: values.number ?? "",
    season: values.season ?? "",
    startDate: values.startDate ?? "",
    endDate: values.endDate ?? "",
    hoursFrom: values.hoursFrom ?? "",
    hoursTo: values.hoursTo ?? "",
    venue: values.venue ?? "",
    placeLimit: values.placeLimit ?? "",
    minAge: values.minAge ?? "5",
    price: values.price ?? "",
    deposit: values.deposit ?? "",
    discount: values.discount ?? "",
    active: formData.get("active") === "on",
  });

  const fieldErrors = parsed.success ? {} : fieldErrorsFrom(parsed.error.issues);

  // Kwoty: każda osobno, błąd trafia do swojego pola.
  const money: Record<(typeof MONEY_FIELDS)[number], number> = { price: 0, deposit: 0, discount: 0 };
  for (const f of MONEY_FIELDS) {
    try {
      money[f] = parsePlnToGrosze(values[f] ?? "");
    } catch {
      fieldErrors[f] = fieldErrors[f] ?? "Kwota: liczba, np. 920 lub 920,50";
    }
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return { ok: false, state: { error: "Popraw zaznaczone pola.", fieldErrors, values } };
  }
  const d: TurnusInput = parsed.data;
  return {
    ok: true,
    data: {
      number: d.number,
      season: d.season,
      startDate: parseDay(d.startDate),
      endDate: parseDay(d.endDate),
      hoursFrom: d.hoursFrom,
      hoursTo: d.hoursTo,
      venue: d.venue,
      placeLimit: d.placeLimit,
      minAge: d.minAge,
      priceGrosze: money.price,
      depositGrosze: money.deposit,
      discountGrosze: money.discount,
      active: d.active,
    },
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

const DUPLICATE: FormState = { error: "Turnus o tym numerze w tym sezonie już istnieje." };

export async function createTurnus(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = parseTurnusForm(formData);
  if (!parsed.ok) return parsed.state;
  try {
    const turnus = await prisma.turnus.create({ data: parsed.data });
    await logEvent({ actor: admin.email, action: "turnus.created", after: parsed.data, note: turnus.id });
  } catch (err) {
    if (isUniqueViolation(err)) return { ...DUPLICATE, values: formValues(formData) };
    throw err;
  }
  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateTurnus(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const before = await prisma.turnus.findUnique({ where: { id } });
  if (!before) return { error: "Nie znaleziono turnusu." };

  const parsed = parseTurnusForm(formData);
  if (!parsed.ok) return parsed.state;

  // Limit nie może spaść poniżej liczby miejsc już zajętych.
  const taken = await prisma.application.count({
    where: { turnusId: id, status: { in: [...PLACE_HOLDING_STATUSES] } },
  });
  if (parsed.data.placeLimit < taken) {
    return {
      error: `Limit nie może być mniejszy niż liczba zajętych miejsc (${taken}).`,
      fieldErrors: { placeLimit: "Za mały limit" },
      values: formValues(formData),
    };
  }

  try {
    await prisma.turnus.update({ where: { id }, data: parsed.data });
  } catch (err) {
    if (isUniqueViolation(err)) return { ...DUPLICATE, values: formValues(formData) };
    throw err;
  }
  await logEvent({ actor: admin.email, action: "turnus.updated", before, after: parsed.data, note: id });
  revalidatePath("/admin");
  revalidatePath(`/admin/turnusy/${id}`);
  return { ok: true, message: "Zapisano zmiany." };
}
