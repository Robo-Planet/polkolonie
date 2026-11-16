"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/lib/form-state";
import { initialFormState } from "@/lib/form-state";

type Action = (prev: FormState, formData?: FormData) => Promise<FormState>;

// Podpis na ekranie: rysunek na płótnie, potem kod z e-maila. Obraz trafia do formularza jako PNG.
export function SignatureForm({
  sendCode,
  signAction,
}: {
  sendCode: Action;
  signAction: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [codeState, codeAction, codePending] = useActionState(sendCode, initialFormState);
  const [signState, signFormAction, signPending] = useActionState(signAction, initialFormState);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signatureRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const ctx = () => canvasRef.current?.getContext("2d") ?? null;

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const c = ctx();
    const p = pos(e);
    c?.beginPath();
    c?.moveTo(p.x, p.y);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const c = ctx();
    const p = pos(e);
    if (c) {
      c.lineWidth = 2.2;
      c.lineCap = "round";
      c.strokeStyle = "#111";
      c.lineTo(p.x, p.y);
      c.stroke();
    }
    setHasInk(true);
  };
  const onUp = () => {
    drawing.current = false;
    if (signatureRef.current && canvasRef.current) {
      signatureRef.current.value = canvasRef.current.toDataURL("image/png");
    }
  };
  const clear = () => {
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    if (signatureRef.current) signatureRef.current.value = "";
    setHasInk(false);
  };

  if (signState.ok && signState.submitted) {
    return <div role="status" className="notice success"><p>{signState.message}</p></div>;
  }

  return (
    <div className="stack">
      {codeState.error && <div role="alert" className="notice error">{codeState.error}</div>}
      {codeState.ok && codeState.message && <div role="status" className="notice success">{codeState.message}</div>}

      <form action={codeAction}>
        <button type="submit" className="secondary" disabled={codePending}>
          {codePending ? "Wysyłanie…" : "1. Wyślij kod na e-mail"}
        </button>
      </form>

      <form action={signFormAction} className="stack">
        {signState.error && <div role="alert" className="notice error">{signState.error}</div>}
        <p>2. Złóż podpis w polu poniżej (myszką albo palcem).</p>
        <canvas
          ref={canvasRef}
          width={480}
          height={160}
          className="signpad"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          aria-label="Pole podpisu"
        />
        <div className="row">
          <button type="button" className="secondary" onClick={clear}>Wyczyść podpis</button>
        </div>
        <input ref={signatureRef} type="hidden" name="signature" />
        <label className="checkbox">
          <input name="summaryAck" type="checkbox" defaultChecked={signState.values?.summaryAck === "on"} />
          Zapoznałem/-am się z podsumowaniem, treścią umowy i karty kwalifikacyjnej.
        </label>
        <label>
          Kod z e-maila (6 cyfr)
          <input name="code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" defaultValue={signState.values?.code ?? ""} required />
        </label>
        <button type="submit" disabled={signPending || !hasInk}>
          {signPending ? "Podpisywanie…" : "3. Podpisuję umowę"}
        </button>
      </form>
    </div>
  );
}
