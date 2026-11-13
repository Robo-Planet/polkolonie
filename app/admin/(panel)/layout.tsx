import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { logoutAdmin } from "@/app/admin/login/actions";

export const dynamic = "force-dynamic";

// Każda strona panelu przechodzi przez requireAdmin() (jedna funkcja sprawdzająca sesję).
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="panel">
      <header className="panel-header">
        <nav>
          <Link href="/admin">Turnusy</Link>
          <Link href="/admin/organizator">Organizator</Link>
        </nav>
        <div className="who">
          <span>{admin.email}</span>
          <form action={logoutAdmin}>
            <button type="submit" className="secondary">Wyloguj</button>
          </form>
        </div>
      </header>
      <main className="page wide">{children}</main>
    </div>
  );
}
