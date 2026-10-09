import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type VerifiedCallback } from 'passport-jwt';
import type { Role } from '@prisma/client';
import { ApiError } from '../../common/filters/http-exception.filter';
import { refreshSecret, jwtIssuer } from '../secrets';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';

/** Cookie the controller writes; the same name is read back here. */
export const REFRESH_COOKIE = 'refreshToken';

interface RawPayload {
  sub?: unknown;
  role?: unknown;
  name?: unknown;
}

/**
 * Reads the **refresh** token from the httpOnly cookie and verifies it with the
 * refresh secret. A separate strategy on purpose: it proves that a token minted
 * for one purpose cannot be replayed for the other.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: { cookies?: Record<string, string> }) => request.cookies?.[REFRESH_COOKIE] ?? null,
      ]),
      secretOrKey: refreshSecret(),
      issuer: jwtIssuer(),
      ignoreExpiration: false,
    });
  }

  validate(payload: RawPayload, done: VerifiedCallback): void {
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
      done(new ApiError(401, 'AUTH_NO_REFRESH_COOKIE', 'Session expirée, reconnectez-vous.'), undefined);
      return;
    }
    const user: AuthenticatedUser = {
      sub: payload.sub,
      role: payload.role as Role,
      name: typeof payload.name === 'string' ? payload.name : '',
    };
    done(null, user);
  }
}
