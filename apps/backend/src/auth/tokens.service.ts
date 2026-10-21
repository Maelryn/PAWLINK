import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { Role } from '@prisma/client';
import { ApiError } from '../common/filters/http-exception.filter';
import {
  ACCESS_TTL_FALLBACK_SECONDS,
  REFRESH_TTL_FALLBACK_SECONDS,
  accessSecret,
  jwtIssuer,
  parseDuration,
  refreshSecret,
} from './secrets';

/**
 * JWT issue + verification (docs/BACKEND_PROMPT.md §3.2).
 *
 *   - the **access** token travels in the response body,
 *   - the **refresh** token travels in an httpOnly cookie set by the controller,
 *   - the payload is exactly `{ sub, role, name }` — nothing else, ever.
 *
 * Access and refresh use **separate secrets and separate TTLs**, so a leaked
 * access token cannot mint a new session.
 */
export interface AuthTokenPayload {
  sub: string;
  role: Role;
  name: string;
}

/**
 * What a signed refresh token carries back to the caller.
 *
 * The `jti` is the handle the server-side store keys on — without it the
 * token could be verified but not revoked (PHASE1_PLAN.md risk R1).
 */
export interface SignedRefreshToken {
  token: string;
  jti: string;
  /** The moment the JWT stops being valid — the row's `expiresAt`. */
  expiresAt: Date;
}

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(private readonly jwt: JwtService) {}

  async signAccess(payload: AuthTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: accessSecret(),
      expiresIn: parseDuration(process.env.JWT_ACCESS_TTL, ACCESS_TTL_FALLBACK_SECONDS),
      issuer: jwtIssuer(),
    });
  }

  /**
   * Signs a refresh token and hands back the `jti` it carries.
   *
   * A refresh token must be **unique every time it is signed**. Without a
   * `jti`, two tokens minted in the same second from the same payload are
   * byte-identical — "rotation" would silently re-issue the very same cookie,
   * and a stolen one would never go stale.
   *
   * The `jti` is also the key of the server-side store, so it is returned
   * rather than buried in the token: the caller has to write the row.
   */
  async signRefresh(payload: AuthTokenPayload): Promise<SignedRefreshToken> {
    const jti = randomUUID();
    const expiresIn = parseDuration(process.env.JWT_REFRESH_TTL, REFRESH_TTL_FALLBACK_SECONDS);
    const token = await this.jwt.signAsync(payload, {
      secret: refreshSecret(),
      expiresIn,
      issuer: jwtIssuer(),
      jwtid: jti,
    });

    // The expiry is read back **from the token** rather than recomputed: the
    // JWT stores `exp` in whole seconds, so a locally computed expiry would be
    // up to a second off. The store's `expiresAt` has to be the token's `exp`,
    // not an approximation of it.
    const { exp } = this.jwt.decode<{ exp?: number }>(token) ?? {};
    if (typeof exp !== 'number') {
      throw new ApiError(500, 'AUTH_TOKEN_INVALID', 'Le jeton de rafraîchissement n\'a pas pu être lu.');
    }
    return { token, jti, expiresAt: new Date(exp * 1000) };
  }

  async verifyAccess(token: string): Promise<AuthTokenPayload> {
    return this.verify(token, accessSecret());
  }

  async verifyRefresh(token: string): Promise<AuthTokenPayload> {
    return this.verify(token, refreshSecret());
  }

  private async verify(token: string, secret: string): Promise<AuthTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<AuthTokenPayload>(token, {
        secret,
        issuer: jwtIssuer(),
      });
      if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
        throw new Error('payload is missing sub/role');
      }
      return { sub: payload.sub, role: payload.role as Role, name: payload.name ?? '' };
    } catch (error) {
      // One code for "bad" and "expired" on purpose: telling a client that a
      // token merely expired is an oracle. The distinction stays server-side.
      this.logger.debug(`token rejected (AUTH_TOKEN_INVALID): ${error instanceof Error ? error.message : String(error)}`);
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'Session invalide ou expirée.');
    }
  }
}
