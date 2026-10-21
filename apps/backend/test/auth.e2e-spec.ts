import { Controller, Get, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { getStorageToken } from '@nestjs/throttler';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { configureApp } from '../src/setup';
import { AppModule } from '../src/app.module';
import { prismaClientOptions } from '../src/common/prisma/client-options';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { REFRESH_COOKIE } from '../src/auth/strategies/jwt-refresh.strategy';
import { cookieFrom, describeWithDatabase, uniqueEmail, uniquePhone } from './support/e2e-gate';

/**
 * A route only an admin may reach. Phase 1 has no real `/admin/*` endpoint (they
 * arrive in Phase 4), so this probe is what proves the role check works end to
 * end: a `reporter` token must be turned away with `403 FORBIDDEN`.
 *
 * It carries no `@Public()`, so it also proves the global bearer guard protects
 * routes by default.
 */
@Controller('probe')
export class AdminProbeController {
  @Get('admin')
  @UseGuards(AdminGuard)
  adminOnly(): { ok: true } {
    return { ok: true };
  }
}

/** A storage that never records a hit, so no per-route limit can trip. */
const neverCount: ThrottlerStorage = {
  increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
};

interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email?: string;
    phone?: string;
    role: string;
    phoneVerified: boolean;
    createdAt?: string;
  };
}

/**
 * The Phase 1 acceptance flow (docs/BACKEND_PROMPT.md §7), in the order the spec
 * lists it: register → verify → /me → refresh → logout → role denial → admin
 * rejection → bad password → OTP attempt cap → profile update → delete.
 *
 * The steps share one account, so they run in order inside a single file.
 */
describeWithDatabase('Phase 1 — auth + profile', () => {
  let app: INestApplication;

  // unique per run, so the suite can be replayed against a database that
  // already holds the seed data
  const email = uniqueEmail();
  const phone = uniquePhone();
  const password = 'pawlink-e2e-2026';

  let accessToken = '';
  let refreshCookie = '';
  let otpCode = '';
  let userId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AdminProbeController],
    })
      // The acceptance flow walks through more register calls than the
      // 5-per-10-minutes per-route limit allows, so the throttler is neutralised
      // for this run: its storage never records a hit. `overrideGuard` cannot do
      // this — the guard is registered as an APP_GUARD, which the guard override
      // does not reach. Rate limiting is asserted by its own decorators and is
      // not what this suite measures.
      .overrideProvider(getStorageToken())
      .useValue(neverCount)
      .compile();

    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    // The account is anonymised by `DELETE /me`, so its email is gone and the
    // rows are matched by id. The refresh-token rows cascade with the user, but
    // they are removed explicitly so a failed run cannot leave a session behind.
    if (userId) {
      const prisma = new PrismaClient(prismaClientOptions());
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.$disconnect();
    }
    await app.close();
  });

  it('1. POST /auth/register → 202, code staged, no secret in the response', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'E2E Reporter', email, password, phone, role: 'reporter' })
      .expect(202);

    expect(response.body).toMatchObject({ phone });
    expect(response.body.code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|argon2|accessToken/);
    otpCode = response.body.code;

    const duplicate = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'E2E Reporter', email, password, phone, role: 'reporter' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('AUTH_EMAIL_TAKEN');
  });

  it('2. POST /auth/verify-phone → { accessToken, user } + httpOnly refresh cookie', async () => {
    const verified = await request(app.getHttpServer())
      .post('/auth/verify-phone')
      .send({ code: otpCode, phone })
      .expect(200);

    const body = verified.body as AuthResponse;
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.user).toMatchObject({ email, phone, phoneVerified: true, role: 'reporter' });
    // the frontend contract: no nulls, no secrets
    expect(JSON.stringify(body.user)).not.toMatch(/passwordHash|argon2|null/);
    expect(body.user.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    accessToken = body.accessToken;
    userId = body.user.id;
    refreshCookie = cookieFrom(verified.headers);
    expect(refreshCookie).toMatch(/^refreshToken=/);
    expect(verified.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
  });

  it('3. GET /me with the bearer token → the same user, straight from the row', async () => {
    const response = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({ email, phone, phoneVerified: true, role: 'reporter' });
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|argon2|null/);
  });

  it('3b. GET /me without a token → 401 AUTH_UNAUTHORIZED (protected by default)', async () => {
    const response = await request(app.getHttpServer()).get('/me').expect(401);
    expect(response.body).toEqual({
      statusCode: 401,
      message: expect.any(String),
      code: 'AUTH_UNAUTHORIZED',
    });
  });

  it('4. POST /auth/refresh → 200 with a new access token and a rotated cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    const rotated = cookieFrom(response.headers);
    expect(rotated).toMatch(/^refreshToken=/);
    // rotation: the cookie must not simply be replayed unchanged
    expect(rotated).not.toBe(refreshCookie);
    refreshCookie = rotated;

    const stillWorks = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${response.body.accessToken}`)
      .expect(200);
    expect(stillWorks.body.email).toBe(email);
  });

  it('4b. POST /auth/refresh without the cookie → 401 AUTH_NO_REFRESH_COOKIE', async () => {
    const response = await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    expect(response.body.code).toBe('AUTH_NO_REFRESH_COOKIE');
  });

  it('5. POST /auth/logout → 204 and the cookie is cleared', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', refreshCookie)
      .expect(204);

    // 204 carries no body; the cleared cookie is the whole answer
    expect(response.body).toEqual({});
    expect(response.headers['set-cookie'][0]).toMatch(/refreshToken=;/);
  });

  it('5b. the cleared cookie is useless for a refresh', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=;`)
      .expect(401);
  });

  it('6. a reporter token on an admin-only route → 403 FORBIDDEN', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/admin')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(response.body).toEqual({
      statusCode: 403,
      message: expect.any(String),
      code: 'FORBIDDEN',
    });
  });

  it('6b. the admin-only route without a token → 401, never 200', async () => {
    await request(app.getHttpServer()).get('/probe/admin').expect(401);
  });

  it('7. POST /auth/register with role "admin" → 400 AUTH_ROLE_NOT_ALLOWED', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'E2E Admin', email: uniqueEmail(), password, phone: uniquePhone(), role: 'admin' })
      .expect(400);

    expect(response.body.code).toBe('AUTH_ROLE_NOT_ALLOWED');
  });

  it('8. POST /auth/login with a wrong password → 401 AUTH_INVALID_CREDENTIALS', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'definitely-not-it' })
      .expect(401);

    expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(JSON.stringify(response.body)).not.toMatch(/password/i);
  });

  it('8b. POST /auth/login before the OTP was confirmed → 403 AUTH_PHONE_NOT_VERIFIED', async () => {
    const unverified = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'E2E Unverified', email: unverified, password, phone: uniquePhone(), role: 'reporter' })
      .expect(202);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: unverified, password })
      .expect(403);

    expect(response.body.code).toBe('AUTH_PHONE_NOT_VERIFIED');
  });

  it('9. the 5th wrong OTP → 429 AUTH_OTP_TOO_MANY_ATTEMPTS, and the code stays burned', async () => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'E2E OTP', email: uniqueEmail(), password, phone: uniquePhone(), role: 'reporter' })
      .expect(202);
    const correctCode: string = registered.body.code;

    const sendWrongCode = () =>
      request(app.getHttpServer())
        .post('/auth/verify-phone')
        .send({ code: '000000', phone: registered.body.phone });

    await sendWrongCode().expect(400);
    await sendWrongCode().expect(400);
    await sendWrongCode().expect(400);
    await sendWrongCode().expect(400);
    const fifth = await sendWrongCode();
    expect(fifth.status).toBe(429);
    expect(fifth.body.code).toBe('AUTH_OTP_TOO_MANY_ATTEMPTS');

    // even the right code is refused once the attempts are spent
    const correct = await request(app.getHttpServer())
      .post('/auth/verify-phone')
      .send({ code: correctCode, phone: registered.body.phone });
    expect(correct.status).toBe(429);
  });

  it('10. PATCH /me → the updated profile, through the shared serializer', async () => {
    const response = await request(app.getHttpServer())
      .patch('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ city: 'Oran', bio: 'Bénévole le week-end.', available: true, helpTypes: ['transport', 'search'] })
      .expect(200);

    expect(response.body).toMatchObject({
      city: 'Oran',
      bio: 'Bénévole le week-end.',
      available: true,
      helpTypes: ['transport', 'search'],
    });
    expect(JSON.stringify(response.body)).not.toMatch(/null/);
  });

  it('10b. PATCH /me cannot escalate a role or change an email (whitelisted away)', async () => {
    const response = await request(app.getHttpServer())
      .patch('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ role: 'admin', email: 'someone-else@pawlink.dz', phoneVerified: true })
      .expect(200);

    expect(response.body.role).toBe('reporter');
    expect(response.body.email).toBe(email);
  });

  it('11. DELETE /me → 204, then /me with the same token → 401 AUTH_ACCOUNT_DELETED', async () => {
    await request(app.getHttpServer()).delete('/me').set('Authorization', `Bearer ${accessToken}`).expect(204);

    const after = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(after.body.code).toBe('AUTH_ACCOUNT_DELETED');
  });
});
