import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 moved connection URLs out of schema.prisma into this file.
 *
 * - `datasource.url` is used by MIGRATE commands only → the Supabase DIRECT connection
 *   (SUPABASE_DB_URL). Runtime never uses it: the app talks to Postgres through the
 *   driver adapter with DATABASE_URL (session pooler) — see src/common/prisma/.
 * - If the direct host is unreachable from your network (Windows/IPv4 + IPv6-only
 *   Supabase hosts), set SUPABASE_DB_URL to the session-pooler string too.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.SUPABASE_DB_URL,
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node scripts/seed.ts',
  },
});
