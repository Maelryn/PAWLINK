import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { getStorageToken } from '@nestjs/throttler';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { configureApp } from '../src/setup';
import { AppModule } from '../src/app.module';
import { prismaClientOptions } from '../src/common/prisma/client-options';
import { describeWithDatabase, uniqueEmail, uniquePhone } from './support/e2e-gate';

const neverCount: ThrottlerStorage = {
  increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
};

const PASSWORD = 'pawlink-e2e-2026';

interface Session {
  email: string;
  phone: string;
  token: string;
  id: string;
}

describeWithDatabase('Phase 4 — admin: stats, users/roles, moderation queues', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  let reporter: Session;
  let adminToken = '';

  async function register(): Promise<Session> {
    const email = uniqueEmail();
    const phone = uniquePhone();
    const created = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'E2E admin', email, password: PASSWORD, phone, role: 'reporter' })
      .expect(202);
    const verified = await request(app.getHttpServer())
      .post('/auth/verify-phone')
      .send({ code: created.body.code, phone })
      .expect(200);
    return {
      email,
      phone,
      token: verified.body.accessToken as string,
      id: verified.body.user.id as string,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getStorageToken())
      .useValue(neverCount)
      .compile();

    app = configureApp(moduleRef.createNestApplication());
    await app.listen(0);
    prisma = new PrismaClient(prismaClientOptions());

    reporter = await register();
    await prisma.user.update({ where: { id: reporter.id }, data: { role: 'admin' } });
    const relogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: reporter.email, password: PASSWORD })
      .expect(200);
    adminToken = relogin.body.accessToken as string;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-' } } });
    await prisma.$disconnect().catch(() => undefined);
    await app.close();
  });

  it('GET /admin/stats → 200 with counts', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(typeof res.body.users).toBe('number');
    expect(typeof res.body.cases).toBe('number');
    expect(typeof res.body.adoptions).toBe('number');
    expect(typeof res.body.services).toBe('number');
  });

  it('GET /admin/stats → 403 for non-admin', async () => {
    // register a fresh non-admin
    const s = await register();
    await request(app.getHttpServer())
      .get('/admin/stats')
      .set('Authorization', `Bearer ${s.token}`)
      .expect(403);
  });

  it('GET /admin/users → 200 paginated', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('PATCH /admin/users/:id/role → changes role', async () => {
    const target = await register();
    const res = await request(app.getHttpServer())
      .patch(`/admin/users/${target.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'volunteer' })
      .expect(200);
    expect(res.body.role).toBe('volunteer');
  });

  it('GET /admin/cases → 200 (queue)', async () => {
    await request(app.getHttpServer())
      .get('/admin/cases')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('GET /admin/adoptions → 200 (queue)', async () => {
    await request(app.getHttpServer())
      .get('/admin/adoptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('GET /admin/services → 200 (queue)', async () => {
    await request(app.getHttpServer())
      .get('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
