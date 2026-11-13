"use client";

import { useActionState } from "react";
import { loginAdmin } from "@/app/admin/login/actions";
import { initialFormState } from "@/lib/form-state";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAdmin, initialFormState);
  return (
    <form action={action} className="stack" autoComplete="on">
      {state.error && <div role="alert" className="notice error">{state.error}</div>}
      <label>
        E-mail
        <input name="email" type="email" autoComplete="username" defaultValue={state.values?.email ?? ""} required />
      </label>
      <label>
        Hasło
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <label>
        Kod z aplikacji uwierzytelniającej
        <input name="code" inputMode="numeric" pattern="[0-9 ]{6,7}" autoComplete="one-time-code" required />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Logowanie…" : "Zaloguj się"}
      </button>
    </form>
  );
}
