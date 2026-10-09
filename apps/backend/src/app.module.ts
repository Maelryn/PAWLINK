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
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    // Loads .env from apps/backend/.env (never committed; see .env.example)
    ConfigModule.forRoot({ isGlobal: true }),
    // Baseline abuse protection (§2). Per-route limits (register, login, …) are
    // `@Throttle` decorators; the 5 reports/hour limit arrives in Phase 2.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    UsersModule,
    SmsModule,
    HealthModule,
    AuthModule,
    MeModule,
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
