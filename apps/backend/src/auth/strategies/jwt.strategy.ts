import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type VerifiedCallback } from 'passport-jwt';
import type { Role } from '@prisma/client';
import { ApiError } from '../../common/filters/http-exception.filter';
import { accessSecret, jwtIssuer } from '../secrets';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';

interface RawPayload {
  sub?: unknown;
  role?: unknown;
  name?: unknown;
}

/**
 * Reads the **access** token from the `Authorization: Bearer` header and
 * verifies it with the access secret. No database access: the payload is the
 * whole truth for the request, which is why role checks live in the guards and
 * why account deletion is enforced where the row is read (`/me`).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: accessSecret(),
      issuer: jwtIssuer(),
      ignoreExpiration: false,
    });
  }

  validate(payload: RawPayload, done: VerifiedCallback): void {
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
      done(new ApiError(401, 'AUTH_TOKEN_INVALID', 'Session invalide ou expirée.'), undefined);
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
