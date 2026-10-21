import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { verify } from '@node-rs/argon2';
import type { User as UserRow } from '@prisma/client';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokensService } from './tokens.service';
import { RefreshTokenService } from './refresh-token.service';
import { UsersService } from '../users/users.service';

jest.mock('@node-rs/argon2', () => ({
  hash: jest.fn(async () => '$argon2id$mocked'),
  verify: jest.fn(async () => true),
}));

const argon2Verify = verify as unknown as jest.Mock;

/** The subset of the `refresh_tokens` row the service actually reads. */
interface StoredRefreshToken {
  jti: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: 'rotated' | 'logout' | 'reuse' | null;
}

/** A live row — the normal case: signed here, not yet spent, not expired. */
function liveToken(overrides: Partial<StoredRefreshToken> = {}): StoredRefreshToken {
  return {
    jti: 'jti-1',
    userId: 'u1',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    revokedReason: null,
    ...overrides,
  };
}

function makeRow(overrides: Partial<UserRow> = {}): UserRow {
  const now = new Date('2026-10-03T10:00:00.000Z');
  return {
    id: 'u1',
    name: 'Yasmine Belkacem',
    avatar: '',
    role: 'reporter',
    email: 'yasmine@pawlink.dz',
    passwordHash: '$argon2id$stored',
    phone: '+213 26 00 00 01',
    phoneVerified: false,
    licenseVerified: false,
    helpTypes: [],
    lat: null,
    lng: null,
    address: null,
    rating: null,
    city: null,
    bio: null,
    photo: null,
    available: null,
    serviceId: null,
    pro: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as UserRow;
}

function harness() {
  const users = {
    findByEmail: jest.fn(async (): Promise<UserRow | null> => null),
    findByPhone: jest.fn(async (): Promise<UserRow | null> => null),
    findById: jest.fn(async (): Promise<UserRow | null> => makeRow()),
    create: jest.fn(async (data: Record<string, unknown>) => makeRow(data as Partial<UserRow>)),
    setPhoneVerified: jest.fn(async () => makeRow({ phoneVerified: true })),
  };
  const otp = {
    issue: jest.fn(async (): Promise<{ expiresAt: Date; devCode?: string }> => ({
      expiresAt: new Date(),
      devCode: '123456',
    })),
    confirm: jest.fn(async (): Promise<{ userId: string }> => ({ userId: 'u1' })),
  };
  const tokens = {
    signAccess: jest.fn(async (): Promise<string> => 'access.jwt.token'),
    signRefresh: jest.fn(
      async (): Promise<{ token: string; jti: string; expiresAt: Date }> => ({
        token: 'refresh.jwt.token',
        jti: 'jti-1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }),
    ),
  };
  const refreshTokens = {
    issue: jest.fn(async () => undefined),
    find: jest.fn(async (): Promise<StoredRefreshToken | null> => liveToken()),
    revoke: jest.fn(async () => undefined),
    revokeAllForUser: jest.fn(async (): Promise<number> => 1),
    prune: jest.fn(async () => undefined),
  };
  const service = new AuthService(
    users as unknown as UsersService,
    otp as unknown as OtpService,
    tokens as unknown as TokensService,
    refreshTokens as unknown as RefreshTokenService,
  );
  return { service, users, otp, tokens, refreshTokens };
}

const REGISTER = {
  name: 'Nour Benali',
  email: 'Nour@PawLink.dz',
  password: 'pawlink2026',
  phone: '+213 26 00 00 07',
  role: 'reporter',
};

function errorOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  return promise.then(
    () => {
      throw new Error('expected the call to reject');
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(HttpException);
      const http = error as HttpException;
      return { status: http.getStatus(), body: http.getResponse() };
    },
  );
}

describe('AuthService.register', () => {
  let h: ReturnType<typeof harness>;

  beforeEach(() => {
    h = harness();
    argon2Verify.mockResolvedValue(true as never);
  });

  it('creates an unverified account and texts it a code', async () => {
    const result = await h.service.register(REGISTER);

    expect(h.users.create).toHaveBeenCalledWith({
      name: 'Nour Benali',
      email: 'nour@pawlink.dz', // normalized
      passwordHash: expect.any(String),
      phone: '+213 26 00 00 07',
      role: 'reporter',
      city: undefined,
      helpTypes: undefined,
    });
    expect(h.otp.issue).toHaveBeenCalledWith('u1', '+213 26 00 00 07');
    expect(result).toMatchObject({ phone: '+213 26 00 00 07', code: '123456' });
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('rejects admin with AUTH_ROLE_NOT_ALLOWED before touching the database', async () => {
    const { status, body } = await errorOf(h.service.register({ ...REGISTER, role: 'admin' }));

    expect(status).toBe(400);
    expect(body).toMatchObject({ code: 'AUTH_ROLE_NOT_ALLOWED' });
    expect(h.users.create).not.toHaveBeenCalled();
    expect(h.users.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects a made-up role the same way', async () => {
    const { body } = await errorOf(h.service.register({ ...REGISTER, role: 'superadmin' }));
    expect(body).toMatchObject({ code: 'AUTH_ROLE_NOT_ALLOWED' });
  });

  it('rejects a duplicate email with AUTH_EMAIL_TAKEN', async () => {
    h.users.findByEmail.mockResolvedValue(makeRow());
    const { status, body } = await errorOf(h.service.register(REGISTER));

    expect(status).toBe(409);
    expect(body).toMatchObject({ code: 'AUTH_EMAIL_TAKEN' });
    expect(h.users.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate phone, because OTP confirmation is scoped by phone', async () => {
    h.users.findByPhone.mockResolvedValue(makeRow());
    const { status, body } = await errorOf(h.service.register(REGISTER));

    expect(status).toBe(409);
    expect(body).toMatchObject({ code: 'AUTH_PHONE_TAKEN' });
    expect(h.users.create).not.toHaveBeenCalled();
  });

  it('stores a vet sign-up as a vet, without the license', async () => {
    await h.service.register({ ...REGISTER, role: 'vet' });
    const created = h.users.create.mock.calls[0][0] as Record<string, unknown>;
    expect(created.role).toBe('vet');
    expect(created.licenseVerified).toBeUndefined(); // UsersService defaults it to false
  });

  it('omits the code from the result in production', async () => {
    h.otp.issue.mockResolvedValue({ expiresAt: new Date() });
    const result = await h.service.register(REGISTER);
    expect(result.code).toBeUndefined();
    expect(Object.keys(result)).toEqual(['phone', 'expiresAt']);
  });
});

describe('AuthService.verifyPhone', () => {
  it('marks the phone verified and opens the session', async () => {
    const h = harness();
    h.users.findById.mockResolvedValue(makeRow());
    const session = await h.service.verifyPhone({ code: '123456', phone: '+213 26 00 00 01' });

    expect(h.otp.confirm).toHaveBeenCalledWith({ code: '123456', phone: '+213 26 00 00 01' });
    expect(h.users.setPhoneVerified).toHaveBeenCalledWith('u1', true);
    expect(session.accessToken).toBe('access.jwt.token');
    expect(session.refreshToken).toBe('refresh.jwt.token');
    expect(session.user).toMatchObject({ id: 'u1', email: 'yasmine@pawlink.dz' });
    // the hash must never survive into the response
    expect(JSON.stringify(session.user)).not.toMatch(/argon2|passwordHash/);
  });

  it('propagates an OTP failure without verifying anything', async () => {
    const h = harness();
    h.otp.confirm.mockResolvedValue(Promise.reject(new HttpException({ code: 'X' }, 400)) as never);

    await errorOf(h.service.verifyPhone({ code: '000000' }));
    expect(h.users.setPhoneVerified).not.toHaveBeenCalled();
  });

  it('refuses to issue a session for a vanished account', async () => {
    const h = harness();
    h.users.findById.mockResolvedValue(null);
    const { status, body } = await errorOf(h.service.verifyPhone({ code: '123456' }));

    expect(status).toBe(401);
    expect(body).toMatchObject({ code: 'AUTH_ACCOUNT_DELETED' });
  });

  it('records the refresh token, so the session can be revoked later', async () => {
    // Without this row the cookie would be a bearer token with a 30-day life
    // and no way to take it back.
    const h = harness();
    await h.service.verifyPhone({ code: '123456' });

    expect(h.refreshTokens.issue).toHaveBeenCalledWith('u1', 'jti-1', expect.any(Date));
    expect(h.refreshTokens.prune).toHaveBeenCalled();
  });
});

describe('AuthService.resendCode', () => {
  it('issues a new code for a known phone', async () => {
    const h = harness();
    h.users.findByPhone.mockResolvedValue(makeRow());

    const result = await h.service.resendCode('+213 26 00 00 01');
    expect(h.otp.issue).toHaveBeenCalledWith('u1', '+213 26 00 00 01');
    expect(result.code).toBe('123456');
  });

  it('does not silently accept an unknown phone', async () => {
    const h = harness();
    const { status } = await errorOf(h.service.resendCode('+213 00 00 00 00'));
    expect(status).toBe(404);
    expect(h.otp.issue).not.toHaveBeenCalled();
  });
});

describe('AuthService.login', () => {
  let h: ReturnType<typeof harness>;

  beforeEach(() => {
    h = harness();
    argon2Verify.mockResolvedValue(true as never);
  });

  it('opens a session for a verified account with the right password', async () => {
    h.users.findByEmail.mockResolvedValue(makeRow({ phoneVerified: true }));

    const session = await h.service.login({ email: 'Yasmine@PawLink.DZ', password: 'pawlink2026' });

    expect(h.users.findByEmail).toHaveBeenCalledWith('Yasmine@PawLink.DZ');
    expect(session.user).toMatchObject({ id: 'u1', phoneVerified: true });
    expect(JSON.stringify(session.user)).not.toMatch(/passwordHash|argon2/);
  });

  it('answers AUTH_INVALID_CREDENTIALS for an unknown email', async () => {
    const { status, body } = await errorOf(h.service.login({ email: 'nobody@pawlink.dz', password: 'x' }));
    expect(status).toBe(401);
    expect(body).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('answers AUTH_INVALID_CREDENTIALS for a deleted account (no hash)', async () => {
    h.users.findByEmail.mockResolvedValue(makeRow({ passwordHash: null }));
    const { status, body } = await errorOf(h.service.login({ email: 'yasmine@pawlink.dz', password: 'x' }));
    expect(status).toBe(401);
    expect(body).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('answers AUTH_INVALID_CREDENTIALS for a wrong password, identically', async () => {
    h.users.findByEmail.mockResolvedValue(makeRow({ phoneVerified: true }));
    argon2Verify.mockResolvedValue(false as never);

    const { status, body } = await errorOf(h.service.login({ email: 'yasmine@pawlink.dz', password: 'wrong' }));
    expect(status).toBe(401);
    expect(body).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('answers AUTH_PHONE_NOT_VERIFIED before the OTP was confirmed', async () => {
    h.users.findByEmail.mockResolvedValue(makeRow({ phoneVerified: false }));
    const { status, body } = await errorOf(h.service.login({ email: 'yasmine@pawlink.dz', password: 'x' }));

    expect(status).toBe(403);
    expect(body).toMatchObject({ code: 'AUTH_PHONE_NOT_VERIFIED' });
    expect(argon2Verify).toHaveBeenCalled();
  });
});

describe('AuthService.refresh', () => {
  it('rotates: a new access token AND a new refresh token', async () => {
    const h = harness();
    const result = await h.service.refresh({ sub: 'u1', jti: 'jti-1' });

    expect(result.accessToken).toBe('access.jwt.token');
    expect(result.refreshToken).toBe('refresh.jwt.token');
    expect(h.tokens.signRefresh).toHaveBeenCalledTimes(1);
  });

  it('re-reads the row so a role change takes effect immediately', async () => {
    const h = harness();
    h.users.findById.mockResolvedValue(makeRow({ role: 'admin' }));
    await h.service.refresh({ sub: 'u1', jti: 'jti-1' });

    expect(h.tokens.signAccess).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });

  it('refuses a deleted account', async () => {
    const h = harness();
    h.users.findById.mockResolvedValue(null);
    const { status, body } = await errorOf(h.service.refresh({ sub: 'u1', jti: 'jti-1' }));

    expect(status).toBe(401);
    expect(body).toMatchObject({ code: 'AUTH_ACCOUNT_DELETED' });
  });

  it('revokes the token it is replacing, and stores the new one', async () => {
    // Rotation without a deny-list is theatre: the old cookie would still work.
    const h = harness();
    await h.service.refresh({ sub: 'u1', jti: 'jti-1' });

    expect(h.refreshTokens.revoke).toHaveBeenCalledWith('jti-1', 'rotated');
    expect(h.refreshTokens.issue).toHaveBeenCalledWith(
      'u1',
      'jti-1',
      expect.any(Date),
    );
  });

  it('refuses a token the store does not know', async () => {
    // A valid signature but no row: the session predates the store, or the row
    // was pruned. Neither is a live session.
    const h = harness();
    h.refreshTokens.find.mockResolvedValue(null);
    const { status, body } = await errorOf(h.service.refresh({ sub: 'u1', jti: 'ghost' }));

    expect(status).toBe(401);
    expect(body).toMatchObject({ code: 'AUTH_TOKEN_INVALID' });
    expect(h.refreshTokens.issue).not.toHaveBeenCalled();
  });

  it('refuses an expired row', async () => {
    const h = harness();
    h.refreshTokens.find.mockResolvedValue(
      liveToken({ expiresAt: new Date(Date.now() - 1000) }),
    );
    const { status, body } = await errorOf(h.service.refresh({ sub: 'u1', jti: 'jti-1' }));

    expect(status).toBe(401);
    expect(body).toMatchObject({ code: 'AUTH_TOKEN_INVALID' });
  });

  it('treats a replayed token as theft: every session of the account dies', async () => {
    // The token was already rotated, so whoever presents it holds a copy.
    const h = harness();
    h.refreshTokens.find.mockResolvedValue(
      liveToken({ revokedAt: new Date(), revokedReason: 'rotated' }),
    );
    const { status, body } = await errorOf(h.service.refresh({ sub: 'u1', jti: 'jti-1' }));

    expect(status).toBe(401);
    expect(body).toMatchObject({ code: 'AUTH_TOKEN_REUSED' });
    expect(h.refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1', 'reuse');
    // and it does NOT mint a new session
    expect(h.tokens.signRefresh).not.toHaveBeenCalled();
  });

  it('does not punish the account for a stale client after a logout', async () => {
    // The session was ended on purpose. A client still holding the cookie is
    // stale, not an attacker — killing every session here would log the user
    // out of the other devices they are still using.
    const h = harness();
    h.refreshTokens.find.mockResolvedValue(
      liveToken({ revokedAt: new Date(), revokedReason: 'logout' }),
    );
    const { status, body } = await errorOf(h.service.refresh({ sub: 'u1', jti: 'jti-1' }));

    expect(status).toBe(401);
    expect(body).toMatchObject({ code: 'AUTH_TOKEN_INVALID' });
    expect(h.refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
  });
});

describe('AuthService.logout', () => {
  it('revokes the presented token, so the session really ends', async () => {
    const h = harness();
    await h.service.logout('u1', 'jti-1');

    expect(h.refreshTokens.revoke).toHaveBeenCalledWith('jti-1', 'logout');
  });

  it('is a no-op when there is no token to revoke', async () => {
    const h = harness();
    await expect(h.service.logout(undefined, undefined)).resolves.toBeUndefined();

    expect(h.refreshTokens.revoke).not.toHaveBeenCalled();
  });
});
