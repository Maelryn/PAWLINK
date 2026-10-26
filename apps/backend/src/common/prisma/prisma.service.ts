import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { prismaClientOptions } from './client-options';

/**
 * One Prisma client for the whole app (§2: only NestJS talks to the DB, RLS stays off).
 * Connection is attempted once at boot but never crashes the process: with no/incorrect
 * DATABASE_URL the API still boots so `/docs` and `/health` stay usable, and data routes
 * answer 503 DB_UNAVAILABLE through the global filter.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private up = false;

  constructor() {
    super(prismaClientOptions());
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.up = true;
      this.logger.log('Connected to PostgreSQL');
    } catch (err) {
      this.up = false;
      this.logger.error(
        `Database NOT reachable — data routes will answer 503. Check DATABASE_URL/SUPABASE_DB_URL. (${
          err instanceof Error ? err.message : String(err)
        })`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
    } catch {
      /* ignore */
    }
  }

  /** Cheap liveness probe used by GET /health. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  isUp(): boolean {
    return this.up;
  }
}
