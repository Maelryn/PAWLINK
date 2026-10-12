/**
 * Environment helpers shared by auth, tokens, otp and sms.
 *
 * The API must boot with **only** the two database URLs set (README §Environment),
 * so nothing here may throw at import time, and dev-only fallbacks must be loud.
 */

export function isProduction(): boolean {
  return (process.env.NODE_ENV ?? 'development') === 'production';
}

/** `true` only when the value is exactly "true" / "1" — never truthy-by-default. */
export function envFlag(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

/**
 * Phone numbers are personal data: never print one in full. Used in every log
 * line that mentions a recipient, so a log reader cannot harvest numbers.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  return `***${digits.slice(-4)}`;
}
