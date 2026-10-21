/**
 * PawLink Pro — the subscription a business account buys.
 *
 * It lives in the `users.pro` Json column with the shape
 * `{ plan: "pro" | "plus", since: ISO, until: ISO }` (`apps/web/lib/types.ts`).
 *
 * **The subscription is the source of truth, not the `services.pro` column.**
 * A listing is featured while its owner\'s subscription runs, so an expired
 * subscription must turn the listing off again without anybody having to
 * remember to run a cleanup job — which is why every read derives the flag
 * from the owner\'s `pro` (see `services/serialize.ts`).
 */

export type ProPlan = 'pro' | 'plus';

export interface ProSubscription {
  plan: ProPlan;
  /** When the current subscription started (kept when it is renewed). */
  since: string;
  /** When the current subscription ends — ISO 8601. */
  until: string;
}

/** Reads the `pro` Json column into the subscription shape, or `undefined`. */
export function readProSubscription(value: unknown): ProSubscription | undefined {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const row = value as Record<string, unknown>;
  if (row.plan !== 'pro' && row.plan !== 'plus') return undefined;
  if (typeof row.since !== 'string' || typeof row.until !== 'string') return undefined;
  if (!Number.isFinite(Date.parse(row.since)) || !Number.isFinite(Date.parse(row.until))) {
    return undefined;
  }
  return { plan: row.plan, since: row.since, until: row.until };
}

/** Is the subscription running right now? */
export function isProActive(
  pro: ProSubscription | undefined | null,
  now: number = Date.now(),
): boolean {
  if (!pro) return false;
  const until = Date.parse(pro.until);
  return Number.isFinite(until) && until > now;
}

/** The demo subscription lengths, in days. */
export const PRO_PERIOD_DAYS: Record<'month' | 'year', number> = { month: 30, year: 365 };
