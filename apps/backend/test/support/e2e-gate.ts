/**
 * Decided once, before any spec file is collected, from the marker written by
 * `test/global-setup.ts`. Suites built on `describeWithDatabase` report as
 * *skipped* — never as green — when the database is unreachable.
 */
export const DATABASE_UP = process.env.E2E_DATABASE === 'up';

export const describeWithDatabase = DATABASE_UP ? describe : describe.skip;

/** Unique per run, so a suite can be replayed against a database with data in it. */
export function uniquePhone(): string {
  const suffix = String(Date.now()).slice(-6);
  return `+213 5${suffix} ${String(Math.floor(Math.random() * 900) + 100)}`;
}

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@pawlink.dz`;
}

/** Pulls the first `name=value` pair out of a `set-cookie` header array. */
export function cookieFrom(headers: Record<string, unknown>): string {
  const raw = (headers['set-cookie'] as string[] | undefined)?.[0];
  return raw ? raw.split(';')[0] : '';
}
