import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../common/decorators/auth.decorators';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, ResendCodeDto, VerifyPhoneDto } from './dto/auth.dto';
import { AuthService, type OtpSentResult, type SessionResponse } from './auth.service';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';
import { REFRESH_COOKIE, type RefreshUser } from './strategies/jwt-refresh.strategy';
import { ApiError } from '../common/filters/http-exception.filter';
import { isProduction } from '../common/env';
import { parseDuration, REFRESH_TTL_FALLBACK_SECONDS } from './secrets';

/**
 * `/auth/*` — the whole Phase 1 surface (docs/BACKEND_PROMPT.md §3.2).
 *
 * Every route here is `@Public()`: the global `JwtAuthGuard` protects the rest
 * of the API by default, and these are the only ways to obtain a token.
 *
 * The **access** token is returned in the body; the **refresh** token only ever
 * exists in an httpOnly cookie this controller writes.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Create an unverified account and text it an SMS code',
    description:
      'Answers 202 with the phone the code was sent to. `code` is present only ' +
      'outside production so the demo flow works without a real SMS provider. ' +
      '`role: "admin"` is refused with AUTH_ROLE_NOT_ALLOWED.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ description: 'Account created, SMS code dispatched.' })
  @ApiBadRequestResponse({ description: 'AUTH_ROLE_NOT_ALLOWED · VALIDATION_ERROR' })
  async register(@Body() dto: RegisterDto): Promise<OtpSentResult> {
    return this.auth.register(dto);
  }

  @Post('verify-phone')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Confirm the SMS code and open the first session',
    description: 'Returns the access token in the body and sets the refresh cookie.',
  })
  @ApiBody({ type: VerifyPhoneDto })
  @ApiOkResponse({ description: '{ accessToken, user } + refresh cookie.' })
  async verifyPhone(
    @Body() dto: VerifyPhoneDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const session = await this.auth.verifyPhone(dto);
    this.setRefreshCookie(res, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Post('resend-code')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Send a new SMS code',
    description: 'Supersedes the previous code. Answers 202 with the phone.',
  })
  @ApiBody({ type: ResendCodeDto })
  async resendCode(@Body() dto: ResendCodeDto): Promise<OtpSentResult> {
    return this.auth.resendCode(dto.phone);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Sign in with email + password',
    description:
      'A wrong email and a wrong password answer identically (AUTH_INVALID_CREDENTIALS). ' +
      'An unconfirmed phone answers AUTH_PHONE_NOT_VERIFIED.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: '{ accessToken, user } + refresh cookie.' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const session = await this.auth.login(dto);
    this.setRefreshCookie(res, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Post('refresh')
  @Public() // the global bearer guard must stand down; the cookie guard below takes over
  @UseGuards(RefreshAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({
    summary: 'Trade the refresh cookie for a new access token',
    description:
      'Rotates the refresh cookie too, so a stolen one goes stale immediately. The server ' +
      'records every refresh token, so the cookie presented here must be a **live** one: a ' +
      'token that was already rotated or logged out is refused with `AUTH_TOKEN_REUSED` and ' +
      'every session of the account is revoked — a replayed cookie means it was copied. ' +
      'The access token is in the body, the refresh token stays cookie-only.',
  })
  @ApiOkResponse({ description: '{ accessToken } + a new refresh cookie.' })
  @ApiUnauthorizedResponse({ description: 'AUTH_NO_REFRESH_COOKIE · AUTH_TOKEN_INVALID · AUTH_TOKEN_REUSED' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // The guard only reports; refusing a missing or dead session is this
    // route's decision.
    const session = req.user as RefreshUser | undefined;
    if (!session) {
      throw new ApiError(401, 'AUTH_NO_REFRESH_COOKIE', 'Session expirée, reconnectez-vous.');
    }
    const rotated = await this.auth.refresh(session);
    this.setRefreshCookie(res, rotated.refreshToken);
    return { accessToken: rotated.accessToken };
  }

  @Post('logout')
  @Public() // same as /refresh: the cookie guard replaces the global bearer guard
  @UseGuards(RefreshAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({
    summary: 'Clear the refresh cookie',
    description:
      'Revokes the refresh token server-side, so the cookie cannot be exchanged for a new ' +
      'session even if it was copied. The access token it was paired with stays valid until ' +
      'it expires (15m by default) — it is stateless. Always answers 204 and always clears the ' +
      'cookie, even when the token was already dead.',
  })
  @ApiNoContentResponse({ description: '204 — the refresh cookie is cleared and the session revoked.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    // Best effort by design: a client holding an expired cookie must still be
    // able to log out, and the server must still be able to clear it for them.
    const session = req.user as RefreshUser | undefined;
    await this.auth.logout(session?.sub, session?.jti);
    res.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
  }

  /**
   * httpOnly, path-scoped to `/auth`. `secure` in production.
   * Cross-site (Vercel → Render): browser only sends the cookie when
   * `sameSite: 'none'` AND `secure: true` in production; use `lax` locally.
   */
  private refreshCookieOptions(): CookieOptions {
    const prod = isProduction();
    return {
      httpOnly: true,
      sameSite: prod ? 'none' : 'lax',
      secure: prod,
      path: '/auth',
      maxAge: parseDuration(process.env.JWT_REFRESH_TTL, REFRESH_TTL_FALLBACK_SECONDS) * 1000,
    };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, this.refreshCookieOptions());
  }
}
