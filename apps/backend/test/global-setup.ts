import { PrismaClient } from '@prisma/client';
import { prismaClientOptions } from '../src/common/prisma/client-options';

/**
 * Runs before the e2e suites are collected, so a spec file can decide whether
 * to run its assertions at load time.
 *
 * A missing database must not be confused with a passing suite: when the DB is
 * unreachable the environment marker is set to `down` and the suites report
 * themselves as **skipped**, with the reason printed once here.
 */
export default async function globalSetup(): Promise<void> {
  const client = new PrismaClient(prismaClientOptions());
  try {
    await client.$queryRaw`SELECT 1`;
    process.env.E2E_DATABASE = 'up';
  } catch (error) {
    process.env.E2E_DATABASE = 'down';
    const reason = describeError(error);
    console.warn(
      [
        '',
        '[e2e] Database not reachable — the e2e suites are SKIPPED, not passing.',
        '[e2e] Set SUPABASE_DB_URL / DATABASE_URL in apps/backend/.env, then re-run `npm run test:e2e`.',
        `[e2e] Reason: ${reason}`,
        '',
      ].join('\n'),
    );
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}

/**
 * A one-line reason that is never empty.
 *
 * A driver failure through `@prisma/adapter-pg` can arrive with an empty
 * `message` — only a `code` on the error or on its `cause`. An unexplained
 * "[e2e] Reason:" is exactly the silent pass this gate exists to prevent, so
 * every field is tried before falling back to the error's shape.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error) || 'unknown error';

  const candidates = [
    error.message,
    (error as { code?: unknown }).code,
    (error.cause as { code?: unknown } | undefined)?.code,
    (error.cause as { message?: unknown } | undefined)?.message,
    error.constructor?.name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.split('\n')[0].trim();
    }
  }

  return 'unknown error (no message, code or cause)';
}
