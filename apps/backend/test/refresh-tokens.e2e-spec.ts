import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { configureApp } from '../src/setup';
import { AppModule } from '../src/app.module';
import { prismaClientOptions } from '../src/common/prisma/client-options';
import { cookieFrom, describeWithDatabase, uniqueEmail, uniquePhone } from './support/e2e-gate';

/**
 * The server-side refresh-token store (PHASE1_PLAN.md risk R1).
 *
 * The unit suite proves the rules with a mocked Prisma. This one proves them
 * against a real database, because the whole point of the store is what is
 * **persisted**: a row that says "this token is dead" has to survive the
 * request that killed it, and the next request has to see it.
 *
 * What is asserted here:
 *
 *   - logging in writes a row,
 *   - rotating marks the old row and writes a new one,
 *   - logging out marks the row, and the dead cookie is then refused,
 *   - a stale cookie after a logout does **not** kill the account's other
 *     sessions (a stale client is not an attacker),
 *   - replaying a *rotated* cookie **does** kill them (a rotated token coming
 *     back means it was copied).
 */
describeWithDatabase('Phase 4 — the refresh-token store', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const email = uniqueEmail();
  const phone = uniquePhone();
  const password = 'pawlink-e2e-2026';
  /** The ids of the accounts this suite creates, for the cleanup. */
  const accountIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient(prismaClientOptions());
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    // register → verify, so the account has a confirmed phone and can sign in
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'E2E Store', email, password, phone, role: 'reporter' })
      .expect(202);
    const code: string = registered.body.code;

    await request(app.getHttpServer())
      .post('/auth/verify-phone')
      .send({ code, phone })
      .expect(200);
  });

  afterAll(async () => {
    // The rows cascade with the user, but the suite cleans up explicitly so a
    // failed run cannot leave a live session behind. The ids are matched by id,
    // not by email: the account deleted in step 7 is anonymised, so its email
    // is already gone.
    const prisma = new PrismaClient(prismaClientOptions());
    const users = await prisma.user.findMany({
      where: { OR: [{ email }, { id: { in: accountIds } }] },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
    await app.close();
  });

  async function signIn(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return cookieFrom(response.headers);
  }

  /**
   * The `jti` a cookie carries — the handle the store keys on.
   *
   * The cookie is the token; the token's `jti` is the row's id. Decoding it is
   * the only way to say "this exact row" rather than "a row of this account".
   */
  function jtiOf(cookie: string): string {
    const token = decodeURIComponent(cookie.split('=')[1] ?? '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.jti as string;
  }

  it('1. signing in writes a row, so the session can be revoked later', async () => {
    const cookie = await signIn();

    const row = await prisma.refreshToken.findUnique({ where: { jti: jtiOf(cookie) } });
    expect(row).not.toBeNull();
    expect(row!.revokedAt).toBeNull();
    expect(row!.revokedReason).toBeNull();
    // the row's expiry is the token's own expiry
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('2. a refresh rotates: the old row is marked, a new one is written', async () => {
    const cookie = await signIn();
    const jti = jtiOf(cookie);
    const before = await prisma.refreshToken.count({ where: { user: { email } } });

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);

    const spent = await prisma.refreshToken.findUnique({ where: { jti } });
    expect(spent!.revokedAt).not.toBeNull();
    expect(spent!.revokedReason).toBe('rotated');
    // and the new cookie is a new row
    const after = await prisma.refreshToken.count({ where: { user: { email } } });
    expect(after).toBe(before + 1);
    expect(cookieFrom(response.headers)).toMatch(/^refreshToken=/);
  });

  it('3. logging out revokes the row, and the dead cookie is then refused', async () => {
    const cookie = await signIn();
    const jti = jtiOf(cookie);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    const dead = await prisma.refreshToken.findUnique({ where: { jti } });
    expect(dead!.revokedAt).not.toBeNull();
    expect(dead!.revokedReason).toBe('logout');

    // The cookie is dead: it cannot be exchanged for a new session.
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
    expect(response.body.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('4. a stale cookie after a logout does NOT kill the account\'s other sessions', async () => {
    // A client that has not noticed the logout is not an attacker. Punishing
    // the account here would log the user out of the phone they are still using.
    const stale = await signIn();
    const other = await signIn();

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', stale)
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', stale)
      .expect(401);

    // the other session still works
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', other)
      .expect(200);
  });

  it('5. replaying a ROTATED cookie is treated as theft: every session dies', async () => {
    const first = await signIn();

    // rotate it, so the first cookie is spent
    const rotated = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', first)
      .expect(200);
    const second = cookieFrom(rotated.headers);

    // now replay the spent one — this is what a copied cookie looks like
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', first)
      .expect(401);
    expect(response.body.code).toBe('AUTH_TOKEN_REUSED');

    // and the live session of that account is dead too
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', second)
      .expect(401);
  });

  it('6. a token the server never issued is refused, even with a valid signature', async () => {
    // A refresh token signed with the real secret but absent from the store
    // predates the store or was forged — either way it is not a live session.
    const { JwtService } = await import('@nestjs/jwt');
    const { refreshSecret, jwtIssuer } = await import('../src/auth/secrets');
    const { randomUUID } = await import('node:crypto');

    const jwt = new JwtService({});
    const forged = await jwt.signAsync(
      { sub: 'whoever', role: 'reporter', name: 'Nobody' },
      { secret: refreshSecret(), issuer: jwtIssuer(), jwtid: randomUUID(), expiresIn: '1h' },
    );

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${forged}`)
      .expect(401);
    expect(response.body.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('7. deleting the account kills every session it had', async () => {
    // A separate account, so the rest of the suite keeps its sessions.
    const doomedEmail = uniqueEmail();
    const doomedPhone = uniquePhone();
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'E2E Doomed', email: doomedEmail, password, phone: doomedPhone, role: 'reporter' })
      .expect(202);

    const verified = await request(app.getHttpServer())
      .post('/auth/verify-phone')
      .send({ code: registered.body.code, phone: doomedPhone })
      .expect(200);
    const cookie = cookieFrom(verified.headers);
    const accessToken: string = verified.body.accessToken;
    accountIds.push(verified.body.user.id);

    await request(app.getHttpServer())
      .delete('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    // the cookie can no longer be exchanged for a session
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
    expect(response.body.code).toBe('AUTH_TOKEN_INVALID');
  });
});
