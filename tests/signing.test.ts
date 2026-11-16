import { describe, expect, it } from "vitest";
import { checkSignCode, hashSignCode, newSignCode, SIGN_CODE_MAX_ATTEMPTS } from "@/lib/signing/code";

const now = new Date("2026-11-20T10:00:00Z");
const rec = (code: string, app = "app1", attempts = 0, expiresInMs = 10 * 60_000) => ({
  codeHash: hashSignCode(code, app),
  expiresAt: new Date(now.getTime() + expiresInMs),
  attempts,
});

describe("kod potwierdzający podpis", () => {
  it("nowy kod ma 6 cyfr", () => {
    for (let i = 0; i < 50; i++) expect(newSignCode()).toMatch(/^\d{6}$/);
  });
  it("przyjmuje poprawny kod", () => {
    expect(checkSignCode(rec("123456"), "123456", "app1", now)).toEqual({ ok: true });
  });
  it("odrzuca zły kod i kod z innego zgłoszenia", () => {
    expect(checkSignCode(rec("123456"), "654321", "app1", now)).toEqual({ ok: false, reason: "mismatch" });
    expect(checkSignCode(rec("123456"), "123456", "app2", now)).toEqual({ ok: false, reason: "mismatch" });
  });
  it("kod wygasa po 10 minutach", () => {
    expect(checkSignCode(rec("123456", "app1", 0, -1), "123456", "app1", now)).toEqual({ ok: false, reason: "expired" });
  });
  it("po limicie prób kod jest zablokowany, nawet poprawny", () => {
    expect(checkSignCode(rec("123456", "app1", SIGN_CODE_MAX_ATTEMPTS), "123456", "app1", now)).toEqual({ ok: false, reason: "locked" });
  });
  it("w bazie jest skrót, nie kod", () => {
    expect(rec("123456").codeHash).not.toContain("123456");
  });
});
