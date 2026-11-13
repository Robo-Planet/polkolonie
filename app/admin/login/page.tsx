import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Logowanie – panel biura", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <main className="page narrow">
      <h1>Panel biura</h1>
      <LoginForm />
    </main>
  );
}
