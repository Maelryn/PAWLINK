import { Injectable, Logger } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { User as UserRow } from '@prisma/client';
import { ApiError } from '../common/filters/http-exception.filter';
import { userRowToUser } from '../users/serialize';
import { UsersService, isSignableRole, normalizeEmail } from '../users/users.service';
import type { User } from '../shared/types';
import { OtpService } from './otp.service';
import type { AuthTokenPayload } from './tokens.service';
import { TokensService } from './tokens.service';
import { RefreshTokenService } from './refresh-token.service';

/** Everything a freshly authenticated caller receives. */
export interface SessionResult {
  accessToken: string;
  /** Goes into the httpOnly cookie — the controller keeps it out of the body. */
  refreshToken: string;
  user: User;
}

/** What the API answers: the cookie carries the refresh token, the body does not. */
export interface SessionResponse {
  accessToken: string;
  user: User;
}

/** What `register` / `resend-code` answer. */
export interface OtpSentResult {
  phone: string;
  expiresAt: Date;
  /** Present only outside production — see docs/BACKEND_PROMPT.md §3.2. */
  code?: string;
}

const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly otp: OtpService,
    private readonly tokens: TokensService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  /**
   * Creates an unverified account and texts it a code.
   *
   * A `vet` sign-up is stored as `role: 'vet'` but with `licenseVerified: false`:
   * the professional role is only granted by an admin later (§3.2). The pending
   * **service listing** the web UI creates for a vet/pro business arrives in
   * Phase 3 — until then `serviceId` stays undefined.
   */
  async register(input: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: string;
    city?: string;
    /** Validated against HELP_TYPES by the DTO, so the cast below is safe. */
    helpTypes?: string[];
  }): Promise<OtpSentResult> {
    if (!isSignableRole(input.role)) {
      throw new ApiError(400, 'AUTH_ROLE_NOT_ALLOWED', 'Ce rôle ne peut pas être choisi à l\'inscription.');
    }

    const email = normalizeEmail(input.email);
    if (await this.users.findByEmail(email)) {
      throw new ApiError(409, 'AUTH_EMAIL_TAKEN', 'Un compte existe déjà avec cet e-mail.');
    }
    // The OTP lookup is scoped by phone, so two accounts must never share one.
    if (await this.users.findByPhone(input.phone)) {
      throw new ApiError(409, 'AUTH_PHONE_TAKEN', 'Un compte existe déjà avec ce numéro.');
    }

    const passwordHash = await hash(input.password, ARGON2_OPTIONS);
    const user = await this.users.create({
      name: input.name.trim(),
      email,
      passwordHash,
      phone: input.phone,
      role: input.role,
      city: input.city,
      helpTypes: input.helpTypes as UserRow['helpTypes'],
    });

    const issued = await this.otp.issue(user.id, user.phone as string);
    return { phone: user.phone as string, expiresAt: issued.expiresAt, ...(issued.devCode ? { code: issued.devCode } : {}) };
  }

  /** Confirms the SMS code and opens the first session. */
  async verifyPhone(input: { code: string; phone?: string }): Promise<SessionResult> {
    const { userId } = await this.otp.confirm({ code: input.code, phone: input.phone });
    await this.users.setPhoneVerified(userId, true);

    const row = await this.users.findById(userId);
    if (!row) throw new ApiError(401, 'AUTH_ACCOUNT_DELETED', 'Ce compte n\'existe plus.');
    return this.openSession(row);
  }

  /** Re-sends a code. An unknown phone is answered exactly like a known one. */
  async resendCode(phone: string): Promise<OtpSentResult> {
    const user = await this.users.findByPhone(phone);
    if (!user) throw new ApiError(404, 'AUTH_USER_NOT_FOUND', 'Aucun compte avec ce numéro.');

    const issued = await this.otp.issue(user.id, user.phone as string);
    return { phone: user.phone as string, expiresAt: issued.expiresAt, ...(issued.devCode ? { code: issued.devCode } : {}) };
  }

  async login(input: { email: string; password: string }): Promise<SessionResult> {
    const user = await this.users.findByEmail(input.email);

    // One message for "no such account" and "wrong password" — never an oracle.
    if (!user || !user.passwordHash) {
      throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'E-mail ou mot de passe incorrect.');
    }
    const passwordOk = await verify(user.passwordHash, input.password).catch(() => false);
    if (!passwordOk) {
      throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'E-mail ou mot de passe incorrect.');
    }
    if (!user.phoneVerified) {
      throw new ApiError(403, 'AUTH_PHONE_NOT_VERIFIED', 'Confirmez votre numéro de téléphone avant de vous connecter.');
    }

    return this.openSession(user);
  }

  /**
   * Rotation, against the server-side store (PHASE1_PLAN.md risk R1).
   *
   * The JWT proves the token was signed here. The store decides whether it is
   * *still allowed* to be used. Four outcomes:
   *
   *   - **live** → rotate: the old row is revoked and a new one is written, so
   *     the cookie the client holds is never the one that was already spent.
   *   - **revoked by a rotation, coming back** → it was copied. Every session
   *     of the account is killed.
   *   - **revoked by a logout, coming back** → a client that has not noticed.
   *     Refused, but the account's other devices keep working.
   *   - **missing** → not a session this server knows about. Refused.
   *
   * The access token stays stateless: it lives 15 minutes and a logout cannot
   * recall one that was already issued. Revoking the *refresh* token is what
   * ends the session, because the access token cannot be renewed.
   */
  async refresh(payload: { sub: string; jti: string }): Promise<{ accessToken: string; refreshToken: string }> {
    // The store is consulted **first**: "is this a live session?" is the
    // question, and answering it before touching the account keeps the answer
    // the same whether or not the account behind the token still exists.
    const stored = await this.refreshTokens.find(payload.jti);
    if (!stored) {
      // The signature was valid, so the token was minted here — but it is not
      // in the store. Either it predates the store (a session opened before
      // the migration) or the row was pruned. Neither is a live session.
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'Session invalide ou expirée.');
    }

    if (stored.revokedAt) {
      // The token is dead. **Why** it is dead decides what happens next.
      if (stored.revokedReason === 'logout') {
        // The account holder ended this session on purpose. A client that
        // still holds the cookie is stale, not an attacker — refusing is
        // enough, and punishing the account here would log them out of the
        // *other* devices they are still using.
        throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'Session expirée, reconnectez-vous.');
      }

      // **Reuse of a rotated token.** It was already spent, so whoever is
      // presenting it now holds a copy. Every session of the account dies.
      const killed = await this.refreshTokens.revokeAllForUser(payload.sub, 'reuse');
      this.logger.warn(
        `Refresh token reuse detected — ${killed} session(s) revoked for the account.`,
      );
      throw new ApiError(
        401,
        'AUTH_TOKEN_REUSED',
        'Session révoquée pour sécurité. Reconnectez-vous.',
      );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'Session invalide ou expirée.');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.passwordHash) {
      throw new ApiError(401, 'AUTH_ACCOUNT_DELETED', 'Ce compte n\'existe plus.');
    }

    // Rotate: the row that was just spent is marked, never deleted, so a later
    // replay of it is recognised as a replay.
    await this.refreshTokens.revoke(payload.jti, 'rotated');
    return this.issueTokens(user);
  }

  /**
   * Ends the session server-side.
   *
   * The refresh token is revoked, so the cookie in the browser cannot be
   * exchanged for a new session. The access token it was paired with stays
   * valid until it expires (15 minutes) — it is stateless, and a deny-list for
   * access tokens is a different table with a different cost.
   *
   * A missing or already-dead token is not an error: the goal is that the
   * session is over, and it already is.
   */
  async logout(sub: string | undefined, jti?: string): Promise<void> {
    if (jti) {
      await this.refreshTokens.revoke(jti, 'logout');
      this.logger.log(`Session revoked for ${sub ?? 'an unknown account'}.`);
    }
  }

  private async openSession(row: UserRow): Promise<SessionResult> {
    const tokens = await this.issueTokens(row);
    return { ...tokens, user: userRowToUser(row) };
  }

  private async issueTokens(row: UserRow): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: AuthTokenPayload = { sub: row.id, role: row.role, name: row.name };
    const signed = await this.tokens.signRefresh(payload);

    // The row is what makes the token revocable, so it is written **before**
    // the token is handed out: a token the server has no record of could never
    // be revoked, and it would be a live session that nothing can kill.
    await this.refreshTokens.issue(row.id, signed.jti, signed.expiresAt);
    // Expired rows are dead weight — drop them on the way through, so the
    // table needs no cron and cannot grow without bound.
    await this.refreshTokens.prune();

    return {
      accessToken: await this.tokens.signAccess(payload),
      refreshToken: signed.token,
    };
  }
}
