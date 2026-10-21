import { Injectable, Logger } from '@nestjs/common';
import type { RefreshRevokeReason, RefreshToken } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * The server-side refresh-token store (PHASE1_PLAN.md risk R1).
 *
 * A refresh JWT proves "this token was signed by us" but says nothing about
 * "this token is still allowed to be used". Without a store, a stolen cookie is
 * good for the whole 30 days and a logout only clears the browser's copy. This
 * service is the missing half: it is what makes a session revocable.
 *
 * The rules it enforces:
 *
 *   - a token whose row is **revoked** is refused (rotation and logout both revoke),
 *   - a token whose row is **missing** is refused (it predates the store, or it
 *     was pruned — either way it is not a live session),
 *   - a token that comes back **after it was revoked** is a copy in someone
 *     else's hands, so every session of that account is killed.
 *
 * Rows are never deleted on revocation: a revoked row is the evidence that lets
 * a replay be recognised. Expired rows are pruned on the way through, so the
 * table cannot grow without bound and no cron is needed — the same convention
 * as `photo_probes`.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records a live refresh token. */
  async issue(userId: string, jti: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({ data: { userId, jti, expiresAt } });
  }

  /** The stored row for a `jti`, or `null` when the token is not a live session. */
  async find(jti: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { jti } });
  }

  /**
   * Revokes one token. Idempotent: a token that is already revoked keeps its
   * original `revokedAt` and reason, so the timestamp always says when it died
   * and why.
   */
  async revoke(jti: string, reason: RefreshRevokeReason): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { jti, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /**
   * Revokes every live session of an account. This is the "log out everywhere"
   * and the "the token was stolen" answer — one statement, no per-session loop.
   *
   * Returns how many sessions were killed, so the caller can log it.
   */
  async revokeAllForUser(userId: string, reason: RefreshRevokeReason): Promise<number> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return count;
  }

  /**
   * Deletes rows past their expiry. Called whenever a token is issued, so the
   * table needs no cron.
   *
   * Only *expired* rows go. A revoked-but-unexpired row is kept on purpose:
   * it is what makes a replayed token recognisable as a replay.
   */
  async prune(): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}
