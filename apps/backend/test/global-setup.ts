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
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
    console.warn(
      [
        '',
        '[e2e] Database not reachable — the auth e2e suites are SKIPPED, not passing.',
        '[e2e] Set SUPABASE_DB_URL / DATABASE_URL in apps/backend/.env, then re-run `npm run test:e2e`.',
        `[e2e] Reason: ${reason}`,
        '',
      ].join('\n'),
    );
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}
