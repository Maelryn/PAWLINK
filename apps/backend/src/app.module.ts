import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { SmsModule } from './sms/sms.module';
import { UsersModule } from './users/users.module';
import { GeoModule } from './geo/geo.module';
import { UploadsModule } from './uploads/uploads.module';
import { CasesModule } from './cases/cases.module';
import { AdoptionsModule } from './adoptions/adoptions.module';
import { ServicesModule } from './services/services.module';
import { ZonesModule } from './zones/zones.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    // Loads .env from apps/backend/.env (never committed; see .env.example)
    ConfigModule.forRoot({ isGlobal: true }),
    // Baseline abuse protection (§2). Per-route limits (register, login, …) are
    // `@Throttle` decorators; `POST /cases` carries the 5-per-hour per-IP half
    // of the trust rate limit.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    UsersModule,
    // `@Global()`, so `GeoService` is injectable anywhere — but a global module
    // still has to be imported once for its exports to register.
    GeoModule,
    SmsModule,
    HealthModule,
    AuthModule,
    MeModule,
    UploadsModule,
    CasesModule,
    // Phase 3 — the marketplace
    NotificationsModule,
    AdoptionsModule,
    ServicesModule,
    ZonesModule,
    // Phase 4 — admin (stats, users/roles, moderation queues live in their own modules)
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Secure by default: every route needs a valid bearer token unless it opts
    // out with @Public(), and any @Roles() is checked against the JWT role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
