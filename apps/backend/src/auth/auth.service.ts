import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { User as UserRow } from '@prisma/client';
import { ApiError } from '../common/filters/http-exception.filter';
import { userRowToUser } from '../users/serialize';
import { UsersService, isSignableRole, normalizeEmail } from '../users/users.service';
import type { User } from '../shared/types';
import { OtpService } from './otp.service';
import type { AuthTokenPayload } from './tokens.service';
import { TokensService } from './tokens.service';

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
  constructor(
    private readonly users: UsersService,
    private readonly otp: OtpService,
    private readonly tokens: TokensService,
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
   * Rotation: a new access token **and** a new refresh token, so a stolen
   * refresh cookie expires early. The refresh token never enters the response
   * body — the controller puts it in the httpOnly cookie.
   */
  async refresh(payload: AuthTokenPayload): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.passwordHash) {
      throw new ApiError(401, 'AUTH_ACCOUNT_DELETED', 'Ce compte n\'existe plus.');
    }
    return this.issueTokens(user);
  }

  /**
   * No server-side session store yet, so clearing the cookie is all a logout can
   * do: the access token stays valid until it expires (15m by default) and a
   * refresh token stays usable until rotation. A `refresh_tokens` table is the
   * Phase 4 fix — flagged in PHASE1_PLAN.md risk R1.
   */
  async logout(sub: string | undefined): Promise<void> {
    if (sub) {
      // keep the hook warm for the Phase 4 store
    }
  }

  private async openSession(row: UserRow): Promise<SessionResult> {
    const tokens = await this.issueTokens(row);
    return { ...tokens, user: userRowToUser(row) };
  }

  private async issueTokens(row: UserRow): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: AuthTokenPayload = { sub: row.id, role: row.role, name: row.name };
    return {
      accessToken: await this.tokens.signAccess(payload),
      refreshToken: await this.tokens.signRefresh(payload),
    };
  }
}
