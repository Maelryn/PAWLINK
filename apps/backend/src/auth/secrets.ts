import { ApiError } from '../common/filters/http-exception.filter';
import { isProduction } from '../common/env';

/**
 * One home for every JWT setting, shared by `TokensService` (signing) and the
 * passport strategies (verification). Signing and verifying must never drift
 * apart, which is exactly the bug a duplicated secret lookup would create.
 */

export const MIN_SECRET_LENGTH = 16;

const DEV_FALLBACK = {
  access: 'dev-access-secret-not-for-production',
  refresh: 'dev-refresh-secret-not-for-production',
} as const;

/**
 * The API must boot with only the two database URLs set, so a missing secret
 * falls back to a dev value with a loud warning instead of crashing the boot.
 * In production that is a hard failure — a default secret is a broken auth
 * system. The variable *name* is logged; its value never is (§6 rule 8).
 */
function secret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value.length >= MIN_SECRET_LENGTH) return value;

  if (isProduction()) {
    throw new ApiError(
      500,
      'AUTH_SECRET_MISSING',
      `${name} must be set to at least ${MIN_SECRET_LENGTH} characters in production.`,
    );
  }
  console.warn(`${name} is not set — using an insecure development fallback. Add it to .env.`);
  return devFallback;
}

export function accessSecret(): string {
  return secret('JWT_ACCESS_SECRET', DEV_FALLBACK.access);
}

export function refreshSecret(): string {
  return secret('JWT_REFRESH_SECRET', DEV_FALLBACK.refresh);
}

export function jwtIssuer(): string {
  return process.env.JWT_ISSUER?.trim() || 'pawlink';
}

/** `900`, `15m`, `2h`, `7d` → seconds. */
export function parseDuration(raw: string | undefined, fallbackSeconds: number): number {
  const value = raw?.trim().toLowerCase();
  if (!value) return fallbackSeconds;

  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(value);
  if (!match) return fallbackSeconds;

  const amount = Number(match[1]);
  switch (match[2]) {
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 3600;
    case 'd':
      return amount * 86_400;
    default:
      return amount;
  }
}

export const ACCESS_TTL_FALLBACK_SECONDS = 15 * 60;
export const REFRESH_TTL_FALLBACK_SECONDS = 30 * 24 * 60 * 60;
