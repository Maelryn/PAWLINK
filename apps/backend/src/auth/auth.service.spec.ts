import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { verify } from '@node-rs/argon2';
import type { User as UserRow } from '@prisma/client';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokensService } from './tokens.service';
import { UsersService } from '../users/users.service';

jest.mock('@node-rs/argon2', () => ({
  hash: jest.fn(async () => '$argon2id$mocked'),
  verify: jest.fn(async () => true),
}));

const argon2Verify = verify as unknown as jest.Mock;

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
    signRefresh: jest.fn(async (): Promise<string> => 'refresh.jwt.token'),
  };
  const service = new AuthService(
    users as unknown as UsersService,
    otp as unknown as OtpService,
    tokens as unknown as TokensService,
  );
  return { service, users, otp, tokens };
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
    const result = await h.service.refresh({ sub: 'u1', role: 'reporter', name: 'Yasmine Belkacem' });

    expect(result.accessToken).toBe('access.jwt.token');
    expect(result.refreshToken).toBe('refresh.jwt.token');
    expect(h.tokens.signRefresh).toHaveBeenCalledTimes(1);
  });

  it('re-reads the row so a role change takes effect immediately', async () => {
    const h = harness();
    h.users.findById.mockResolvedValue(makeRow({ role: 'admin' }));
    await h.service.refresh({ sub: 'u1', role: 'reporter', name: 'Yasmine Belkacem' });

    expect(h.tokens.signAccess).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });

  it('refuses a deleted account', async () => {
    const h = harness();
    h.users.findById.mockResolvedValue(null);
    const { status, body } = await errorOf(h.service.refresh({ sub: 'u1', role: 'reporter', name: 'x' }));

    expect(status).toBe(401);
    expect(body).toMatchObject({ code: 'AUTH_ACCOUNT_DELETED' });
  });
});

describe('AuthService.logout', () => {
  it('resolves — the cookie is cleared by the controller', async () => {
    const h = harness();
    await expect(h.service.logout('u1')).resolves.toBeUndefined();
  });
});
