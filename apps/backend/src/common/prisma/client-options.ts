import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/** The options PrismaClient's constructor actually accepts (v7 hides the named type). */
export type PrismaClientCtorOptions = ConstructorParameters<typeof PrismaClient>[0];

/**
 * Prisma 7 removed `url` from schema.prisma: the client reaches PostgreSQL through a driver
 * adapter instead.
 *
 * - Runtime (this file)  → DATABASE_URL, the Supabase session pooler.
 * - Migrations (prisma.config.ts) → SUPABASE_DB_URL, the direct connection.
 *
 * With neither variable set (fresh clone before .env is filled) we still return a constructible
 * client pointing at localhost, so the process boots and reports `degraded` instead of crashing.
 */
export function prismaClientOptions(): PrismaClientCtorOptions {
  const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  return {
    adapter: new PrismaPg(
      url ?? { host: '127.0.0.1', port: 5432, user: 'postgres', database: 'pawlink' },
    ),
  };
}
