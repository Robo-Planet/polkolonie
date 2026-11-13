// Wspólny kształt stanu formularzy (useActionState). Wartości wracają do formularza po błędzie.
export type FormState = {
  ok?: boolean;
  /** true, gdy formularz został wysłany (nie tylko zapisany jako szkic) */
  submitted?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  message?: string;
};

export const initialFormState: FormState = {};

/** Zamienia wynik walidacji zod na mapę "pole -> komunikat". */
export function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** FormData -> prosty obiekt tekstowy (pola checkbox: "on" albo brak). */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
