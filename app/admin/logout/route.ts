import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Wylogowanie jako zwykły POST (nie akcja serwerowa): usuwa cookie sesji i wraca na logowanie.
export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
