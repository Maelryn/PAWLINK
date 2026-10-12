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
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../common/decorators/auth.decorators';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, ResendCodeDto, VerifyPhoneDto } from './dto/auth.dto';
import { AuthService, type OtpSentResult, type SessionResponse } from './auth.service';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';
import { AuthTokenPayload } from './tokens.service';
import { REFRESH_COOKIE } from './strategies/jwt-refresh.strategy';
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
      'Rotates the refresh cookie too, so a stolen one goes stale early. ' +
      'The access token is in the body, the refresh token stays cookie-only.',
  })
  @ApiOkResponse({ description: '{ accessToken } + a new refresh cookie.' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const payload = req.user as AuthTokenPayload;
    const rotated = await this.auth.refresh(payload);
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
      'Without a server-side session store this is all a logout can do — the ' +
      'access token stays valid until it expires (15m by default).',
  })
  @ApiNoContentResponse({ description: '204 — the refresh cookie is cleared.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout((req.user as AuthTokenPayload | undefined)?.sub);
    res.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
  }

  /**
   * httpOnly, path-scoped to `/auth`, `secure` in production, `sameSite: lax`.
   * A script can never read it; only the browser sends it back to `/auth/*`.
   */
  private refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(),
      path: '/auth',
      maxAge: parseDuration(process.env.JWT_REFRESH_TTL, REFRESH_TTL_FALLBACK_SECONDS) * 1000,
    };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, this.refreshCookieOptions());
  }
}
