import { randomBytes } from "node:crypto";
import { sha256Hex } from "@/lib/crypto";

// Token linku rodzica: losowy, w bazie tylko jego skrót (SHA-256).

/** Nowy token (256 bitów, base64url) – trafia do linku, nigdzie indziej. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return sha256Hex(token);
}
