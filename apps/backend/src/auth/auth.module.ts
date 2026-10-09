import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokensService } from './tokens.service';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SmsModule } from '../sms/sms.module';
import { AdminGuard } from './guards/admin.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';
import { RolesGuard } from './guards/roles.guard';

/**
 * Auth + profile. `UsersModule` and `PrismaModule` are `@Global`; `SmsModule`
 * is imported explicitly so the SMS dependency is visible right here.
 */
@Module({
  imports: [
    // No module-level secret: `TokensService` and the strategies read the one
    // source of truth in auth/secrets.ts, so signing and verifying cannot drift.
    JwtModule.register({}),
    PassportModule,
    SmsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokensService,
    JwtStrategy,
    JwtRefreshStrategy,
    // Guards are provided so `@UseGuards(AdminGuard)` can inject the Reflector.
    JwtAuthGuard,
    RefreshAuthGuard,
    RolesGuard,
    AdminGuard,
  ],
  exports: [AuthService, TokensService],
})
export class AuthModule {}
