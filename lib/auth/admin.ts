import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readSession, SESSION_COOKIE } from "@/lib/session";

// JEDNA funkcja sprawdzająca sesję administratora. Każda strona i akcja panelu
// zaczyna się od `requireAdmin()` – nie kopiujemy tej logiki.

export type AdminSession = { id: string; email: string };

export async function currentAdmin(): Promise<AdminSession | null> {
  const jar = await cookies();
  const adminId = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!adminId) return null;
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId }, select: { id: true, email: true } });
  return admin ?? null;
}

/** Wymaga zalogowanego administratora; w przeciwnym razie przekierowuje na logowanie. */
export async function requireAdmin(): Promise<AdminSession> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
