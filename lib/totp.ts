import * as OTPAuth from "otpauth";

// Drugi składnik logowania administratora: kod z aplikacji uwierzytelniającej (TOTP, 6 cyfr, 30 s).

const ISSUER = "RoboPlanet Półkolonie";

export function newTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function totpFor(email: string, secretBase32: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

/** URI `otpauth://...` do wpisania w aplikacji (lub zamiany na kod QR). */
export function totpUri(email: string, secretBase32: string): string {
  return totpFor(email, secretBase32).toString();
}

/** Sprawdza kod z tolerancją jednego okresu (30 s) w obu kierunkach. */
export function verifyTotp(email: string, secretBase32: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return totpFor(email, secretBase32).validate({ token: code, window: 1 }) !== null;
}
