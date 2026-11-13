import type { ZodType } from "zod";

export function schemaSafe<T>(schema: ZodType<T>, input: unknown): { ok: boolean } {
  return { ok: schema.safeParse(input).success };
}
