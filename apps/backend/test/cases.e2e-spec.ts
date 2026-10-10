import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { getStorageToken } from '@nestjs/throttler';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { configureApp } from '../src/setup';
import { AppModule } from '../src/app.module';
import { prismaClientOptions } from '../src/common/prisma/client-options';
import { bboxContains } from '../src/cases/bbox';
import { describeWithDatabase, uniqueEmail, uniquePhone } from './support/e2e-gate';

/**
 * The Phase 2 acceptance flow (PHASE2_PLAN.md §9 + PHASE2_VERIFICATION.md §5).
 *
 * probe → create → bbox → suspicious held → help + socket → confirm ×2 →
 * flag ×3 → status by role → AI in a second language → 6th report rate-limited.
 *
 * Three rules from Phase 1 are kept:
 *
 *   - **skip with a reason, never pass silently** — `describeWithDatabase`
 *     reports *skipped* when the database is unreachable, with the reason
 *     printed once by `test/global-setup.ts`.
 *   - **override the throttler storage**, not the guard: `overrideGuard` cannot
 *     reach an `APP_GUARD`, and without this the register route's own 5-per-10-
 *     minute limit would 429 the suite.
 *   - every status code is asserted, because Nest's default for `POST` is 201
 *     and several of these are 200.
 */

/** A storage that never records a hit, so no per-route limit can trip. */
const neverCount: ThrottlerStorage = {
  increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
};

/** The Kabylie wildfire case the probe fixture is geotagged to. */
const KABYLIE = { lat: 36.632, lng: 4.205 };
/** Outside Algeria, so the `inAlgeria` check fails and the report is held. */
const PARIS = { lat: 48.8566, lng: 2.3522 };

/** A bbox around Tizi Ouzou, wide enough for every seeded Kabylie case. */
const KABYLIE_BBOX = '3.9,36.5,4.4,36.9';
/** A bbox around Algiers only, which excludes Tizi Ouzou. */
const ALGIERS_BBOX = '3.05,36.79,3.10,36.82';

const PASSWORD = 'pawlink-e2e-2026';

interface Session {
  email: string;
  phone: string;
  token: string;
  id: string;
}

interface CaseResponse {
  id: string;
  triage: string;
  status: string;
  moderation?: 'pending' | 'approved' | 'hidden';
  trust: {
    level: string;
    score: number;
    checks: Array<{ id: string; ok: boolean | null; detail?: string }>;
    confirmations: number;
    flags: number;
  };
  ai: {
    triage: string;
    forcedUrgentByRule: boolean;
    disclaimer: string;
    model: string;
    suggestedServices: Array<{ distanceKm: number }>;
  };
  location: { lat: number; lng: number };
  reporter: { id: string; name: string; avatar: string };
  helpers: Array<{ user: { id: string; name: string }; helpType: string }>;
  createdAt: string;
  updatedAt: string;
}

describeWithDatabase('Phase 2 — cases, trust, AI, realtime', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  /** The account that files the reports; verified by phone like any other. */
  let reporter: Session;
  let volunteer: Session;
  let adminToken = '';

  /** Every `probeId` this suite minted, so a re-run never collides. */
  const probeIds: string[] = [];

  let baseUrl = '';

  async function register(role: 'reporter' | 'volunteer'): Promise<Session> {
    const email = uniqueEmail();
    const phone = uniquePhone();
    const created = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: `E2E ${role}`, email, password: PASSWORD, phone, role })
      .expect(202);

    const verified = await request(app.getHttpServer())
      .post('/auth/verify-phone')
      .send({ code: created.body.code, phone })
      .expect(200);

    return { email, phone, token: verified.body.accessToken as string, id: verified.body.user.id as string };
  }

  /** Uploads one of the checked-in fixtures and returns its probe. */
  async function probe(token: string, fixture: string) {
    const response = await request(app.getHttpServer())
      .post('/uploads/probe')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', `${__dirname}/fixtures/${fixture}`)
      .expect(200);

    probeIds.push(response.body.probeId as string);
    return response.body as {
      probeId: string;
      exif: { gps?: { lat: number; lng: number }; takenAt?: string; camera?: string };
      dHash: string;
    };
  }

  async function createCase(token: string, body: Record<string, unknown>): Promise<CaseResponse> {
    const response = await request(app.getHttpServer())
      .post('/cases')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect([200, 201]).toContain(response.status);
    return response.body as CaseResponse;
  }

  /**
   * A brand-new account. The acceptance flow deliberately spends one reporter's
   * five-reports-per-hour budget before the later steps, so anything after that
   * files under its own identity — which is also what the rate limit is for.
   */
  async function freshReporter(): Promise<Session> {
    return register('reporter');
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getStorageToken())
      .useValue(neverCount)
      .compile();

    app = configureApp(moduleRef.createNestApplication());
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 4000;
    baseUrl = `http://127.0.0.1:${port}`;

    prisma = new PrismaClient(prismaClientOptions());

    // The seed writes no `photo_hashes` rows, so anything in there is debris
    // from an earlier run against this same database — and a surviving hash
    // would make every one of this suite's probes look like a reused photo.
    await prisma.photoHash.deleteMany({ where: { subjectType: 'case' } });

    reporter = await register('reporter');
    volunteer = await register('volunteer');
  });

  afterAll(async () => {
    // The suite's own rows are cleaned up so it can be replayed against a
    // database that already holds the seed and a previous run.
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: 'e2e-' } } } });
    await prisma.caseFlag.deleteMany({ where: { user: { email: { startsWith: 'e2e-' } } } });
    await prisma.caseConfirm.deleteMany({ where: { user: { email: { startsWith: 'e2e-' } } } });
    await prisma.caseHelper.deleteMany({ where: { user: { email: { startsWith: 'e2e-' } } } });
    await prisma.case.deleteMany({ where: { reporter: { email: { startsWith: 'e2e-' } } } });
    await prisma.photoProbe.deleteMany({ where: { user: { email: { startsWith: 'e2e-' } } } });
    // The seed writes no `photo_hashes` rows either, so this suite leaves none.
    await prisma.photoHash.deleteMany({ where: { subjectType: 'case' } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-' } } });
    await prisma.$disconnect().catch(() => undefined);
    await app.close();
  });

  // ── 1. uploads: the probe is what makes the EXIF server-side ──
  describe('1 · POST /uploads/probe — EXIF and dHash read from the original', () => {
    it('reads GPS, DateTimeOriginal and the camera from a real JPEG', async () => {
      const result = await probe(reporter.token, 'with-exif.jpg');

      expect(result.probeId).toMatch(/^[\w-]{10,}$/);
      expect(result.exif.gps?.lat).toBeCloseTo(KABYLIE.lat, 2);
      expect(result.exif.gps?.lng).toBeCloseTo(KABYLIE.lng, 2);
      expect(result.exif.camera).toBeTruthy();
      expect(result.exif.takenAt).toMatch(/^\d{4}-\d{2}-\d{02}T/);
      expect(result.dHash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('answers an empty exif for a photo with no metadata, never an error', async () => {
      // `exifr` returns `undefined` for a JPEG with no APP1 segment, and the
      // service has to turn that into "no data" rather than a failure.
      const result = await probe(reporter.token, 'no-exif.jpg');
      expect(result.exif).toEqual({});
      // same pixels, so the same perceptual hash
      expect(result.dHash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('gives the same dHash for a recompressed copy — that is what catches a reused photo', async () => {
      const original = await probe(reporter.token, 'with-exif.jpg');
      const recompressed = await probe(reporter.token, 'recompressed.jpg');

      const { DHashService } = await import('../src/uploads/dhash.service');
      const service = new DHashService();
      const a = { bits: BigInt(`0x${original.dHash}`), hex: original.dHash };
      const b = { bits: BigInt(`0x${recompressed.dHash}`), hex: recompressed.dHash };

      expect(service.hamming(a, b)).toBeLessThanOrEqual(8);
    });

    it('answers a typed UPLOADS_NOT_CONFIGURED with no Cloudinary keys', async () => {
      const response = await request(app.getHttpServer())
        .post('/uploads/signature')
        .set('Authorization', `Bearer ${reporter.token}`)
        .expect(501);

      expect(response.body.code).toBe('UPLOADS_NOT_CONFIGURED');
    });

    it('needs a bearer token', async () => {
      await request(app.getHttpServer()).post('/uploads/probe').expect(401);
    });
  });

  // ── 2. POST /cases — the headline acceptance ──
  describe('2 · POST /cases — the response carries ai and trust', () => {
    it('computes trust server-side and stays public for a verified reporter', async () => {
      const withExif = probeIds[0];

      const created = await createCase(reporter.token, {
        title: 'Chaton coincé sous un portail',
        species: 'cat',
        category: 'companion',
        location: { ...KABYLIE, address: 'Tizi Ouzou' },
        photos: ['https://res.cloudinary.com/demo/image/upload/v1/e2e-kitten.jpg'],
        probeIds: [withExif],
        description: 'Un chaton coincé sous un portail, il pleure et ne peut pas sortir seul.',
        conditionTags: ['trapped', 'young'],
        reporterOnSite: true,
      });

      // the headline: both objects are in the response body
      expect(created.ai).toBeDefined();
      expect(created.trust).toBeDefined();
      expect(created.trust.level).toBe('verified');
      expect(created.moderation).toBeUndefined();
      expect(created.status).toBe('open');

      // the client cannot write any of these
      expect(created.id).not.toBe('spoofed');
      expect(created.trust.checks.map((c) => c.id)).toEqual([
        'account',
        'inAlgeria',
        'photoGps',
        'photoFresh',
        'onSite',
        'animalDetected',
        'duplicate',
        'rateLimit',
      ]);
      expect(created.trust.checks.find((c) => c.id === 'account')?.ok).toBe(true);
      expect(created.trust.checks.find((c) => c.id === 'inAlgeria')?.ok).toBe(true);

      // the AI ran, the safety rules raised it, and the disclaimer is there
      expect(created.ai.triage).toBe('urgent');
      expect(created.ai.forcedUrgentByRule).toBe(true);
      expect(created.ai.disclaimer).toMatch(/vétérinaire/i);

      // the suggestions are real PostGIS distances
      expect(created.ai.suggestedServices.length).toBeGreaterThan(0);
      for (const service of created.ai.suggestedServices) {
        expect(service.distanceKm).toBeGreaterThan(0);
      }

      // no secret anywhere in the body
      expect(JSON.stringify(created)).not.toMatch(/passwordHash|accessToken|apiKey/i);
    });

    it('ignores a client-supplied trust object', async () => {
      const created = await createCase(reporter.token, {
        title: 'Tentative de spoofing de la confiance',
        species: 'dog',
        category: 'companion',
        location: { ...KABYLIE },
        description: 'Un chien errant près du marché.',
        conditionTags: ['lost'],
        trust: { level: 'verified', score: 1, confirmations: 99, flags: 0, checks: [] },
        moderation: 'approved',
        id: 'spoofed-id',
        reporter: { id: 'someone-else', name: 'Someone Else', avatar: '' },
      });

      expect(created.id).not.toBe('spoofed-id');
      expect(created.trust.confirmations).toBe(0);
      expect(created.reporter.id).toBe(reporter.id);
    });

    it('refuses a photo without its own probe', async () => {
      const response = await request(app.getHttpServer())
        .post('/cases')
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({
          title: 'Photo sans probe',
          species: 'dog',
          category: 'companion',
          location: { ...KABYLIE },
          photos: ['https://res.cloudinary.com/demo/image/upload/v1/no-probe.jpg'],
          probeIds: [],
          description: 'Une photo sans son probe.',
          conditionTags: [],
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ── 3. the map ──
  describe('3 · GET /cases?bbox= — one PostGIS statement, moderation gated', () => {
    it('returns the created case inside a bbox that covers it', async () => {
      const response = await request(app.getHttpServer())
        .get(`/cases?bbox=${KABYLIE_BBOX}`)
        .expect(200);

      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.pageSize).toBeLessThanOrEqual(500);

      const found = response.body.items.find(
        (c: CaseResponse) => c.location.lat === KABYLIE.lat && c.location.lng === KABYLIE.lng,
      );
      expect(found).toBeDefined();
      expect(bboxContains({ minLng: 3.9, minLat: 36.5, maxLng: 4.4, maxLat: 36.9 }, found.location)).toBe(true);
    });

    it('does not return it from a bbox that excludes it', async () => {
      const response = await request(app.getHttpServer())
        .get(`/cases?bbox=${ALGIERS_BBOX}`)
        .expect(200);

      for (const item of response.body.items as CaseResponse[]) {
        expect(bboxContains({ minLng: 3.05, minLat: 36.79, maxLng: 3.1, maxLat: 36.82 }, item.location)).toBe(true);
      }
    });

    it('orders urgent first, then createdAt DESC', async () => {
      const response = await request(app.getHttpServer())
        .get(`/cases?bbox=${KABYLIE_BBOX}`)
        .expect(200);

      const rank = (triage: string) => ['urgent', 'monitoring', 'stable'].indexOf(triage);
      const items = response.body.items as CaseResponse[];
      for (let i = 1; i < items.length; i++) {
        expect(rank(items[i - 1].triage)).toBeLessThanOrEqual(rank(items[i].triage));
      }
    });

    it('hides the seeded pending case from the public map', async () => {
      const seeded = await prisma.case.findFirst({ where: { moderation: 'pending' } });
      expect(seeded).not.toBeNull();

      const response = await request(app.getHttpServer())
        .get('/cases?bbox=-180,-90,180,90')
        .expect(400);
      // the world is not a bbox this API accepts
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('answers every invalid bbox with one VALIDATION_ERROR', async () => {
      for (const bbox of [',,,', '1,2,3', '0,0,0,200', 'a,b,c,d']) {
        const response = await request(app.getHttpServer()).get(`/cases?bbox=${bbox}`).expect(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
      }
    });

    it('composes its filters', async () => {
      const response = await request(app.getHttpServer())
        .get(`/cases?bbox=${KABYLIE_BBOX}&triage=urgent&species=cat`)
        .expect(200);

      for (const item of response.body.items as CaseResponse[]) {
        expect(item.triage).toBe('urgent');
      }
    });
  });

  // ── 4. a suspicious case is held ──
  describe('4 · a suspicious report is invisible in public and visible to an admin', () => {
    let heldCase: CaseResponse;

    it('holds an out-of-Algeria pin as pending', async () => {
      heldCase = await createCase(reporter.token, {
        title: 'Signalement hors d Algérie',
        species: 'dog',
        category: 'companion',
        location: { ...PARIS, address: 'Paris' },
        description: 'Un chien errant près du métro.',
        conditionTags: ['lost'],
      });

      expect(heldCase.moderation).toBe('pending');
      expect(heldCase.trust.level).toBe('suspicious');
      const failed = heldCase.trust.checks.filter((c) => c.ok === false).map((c) => c.id);
      expect(failed).toContain('inAlgeria');
    });

    it('holds a reused photo as a duplicate', async () => {
      const reused = await createCase(reporter.token, {
        title: 'Photo recyclée',
        species: 'cat',
        category: 'companion',
        location: { ...KABYLIE },
        photos: ['https://res.cloudinary.com/demo/image/upload/v1/e2e-kitten.jpg'],
        probeIds: [probeIds[0]],
        description: 'Le même chaton, une deuxième fois.',
        conditionTags: ['trapped'],
      });

      expect(reused.moderation).toBe('pending');
      expect(reused.trust.checks.find((c) => c.id === 'duplicate')?.ok).toBe(false);
      expect(reused.trust.checks.find((c) => c.id === 'duplicate')?.detail).toBeTruthy();
    });

    it('is absent from the public bbox', async () => {
      const response = await request(app.getHttpServer())
        .get(`/cases?bbox=${KABYLIE_BBOX}`)
        .expect(200);

      const ids = response.body.items.map((c: CaseResponse) => c.id);
      expect(ids).not.toContain(heldCase.id);
    });

    it('is a 404 for a stranger on GET /cases/:id', async () => {
      await request(app.getHttpServer()).get(`/cases/${heldCase.id}`).expect(404);
    });

    it('is readable by its own reporter', async () => {
      const response = await request(app.getHttpServer())
        .get(`/cases/${heldCase.id}`)
        .set('Authorization', `Bearer ${reporter.token}`)
        .expect(200);
      expect(response.body.id).toBe(heldCase.id);
    });

    it('appears in GET /admin/cases, and only for an admin', async () => {
      // admin exists only through `seed:admin`, so the suite promotes its own
      // account in the database rather than going through a self-signup path
      await prisma.user.update({ where: { id: volunteer.id }, data: { role: 'admin' } });
      const admin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: volunteer.email, password: PASSWORD })
        .expect(200);
      adminToken = admin.body.accessToken;

      const asReporter = await request(app.getHttpServer())
        .get('/admin/cases')
        .set('Authorization', `Bearer ${reporter.token}`)
        .expect(403);
      expect(asReporter.body.code).toBe('FORBIDDEN');

      const response = await request(app.getHttpServer())
        .get('/admin/cases?pageSize=500')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = response.body.items.map((c: CaseResponse) => c.id);
      expect(ids).toContain(heldCase.id);
      expect(response.body.total).toBeGreaterThanOrEqual(response.body.items.length);
    });

    it('becomes public once an admin approves it, and disappears when hidden', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/cases/${heldCase.id}/moderation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'approved' })
        .expect(200);

      const afterApproval = await request(app.getHttpServer())
        .get(`/cases?bbox=${KABYLIE_BBOX}`)
        .expect(200);
      // an out-of-Algeria pin is not in the Kabylie box, so it stays out of
      // this list for a geometry reason rather than a moderation one
      expect(afterApproval.body.items.map((c: CaseResponse) => c.id)).not.toContain(heldCase.id);

      const held = await createCase(reporter.token, {
        title: 'Cas à modérer puis cacher',
        species: 'dog',
        category: 'companion',
        location: { ...KABYLIE },
        description: 'Un chien qui attend près du stade.',
        conditionTags: ['lost'],
      });

      await request(app.getHttpServer())
        .patch(`/admin/cases/${held.id}/moderation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'hidden' })
        .expect(200);

      const afterHidden = await request(app.getHttpServer())
        .get(`/cases?bbox=${KABYLIE_BBOX}`)
        .expect(200);
      expect(afterHidden.body.items.map((c: CaseResponse) => c.id)).not.toContain(held.id);
    });
  });

  // ── 5. community: help, with a real socket attached ──
  describe('5 · POST /cases/:id/help — a socket sees it, the reporter is notified', () => {
    it('emits case.updated and help.offered, and writes a help notification', async () => {
      const owner = await freshReporter();
      const target = await createCase(owner.token, {
        title: 'Chat à nourrir',
        species: 'cat',
        category: 'companion',
        location: { ...KABYLIE },
        description: 'Un chat qui attend de la nourriture près du marché.',
        conditionTags: ['thin'],
      });

      const socket: Socket = io(`${baseUrl}/realtime`, {
        reconnection: false,
        auth: { token: owner.token },
      });
      const events: Array<{ name: string; payload: Record<string, unknown> }> = [];
      for (const name of ['case.created', 'case.updated', 'help.offered', 'notification']) {
        socket.on(name, (payload: Record<string, unknown>) => events.push({ name, payload }));
      }
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', (e) => reject(new Error(e.message)));
        setTimeout(() => reject(new Error('socket connect timeout')), 5000);
      });

      const helped = await request(app.getHttpServer())
        .post(`/cases/${target.id}/help`)
        .set('Authorization', `Bearer ${volunteer.token}`)
        .send({ helpType: 'food', message: 'Je passe avec des croquettes.' })
        .expect(200);

      expect(helped.body.status).toBe('in_progress');
      expect(helped.body.helpers.map((h: { user: { id: string } }) => h.user.id)).toContain(volunteer.id);

      // the broadcast is asynchronous, but it has to land
      await new Promise((r) => setTimeout(r, 400));
      socket.close();

      const names = events.map((e) => e.name);
      expect(names).toContain('case.updated');
      expect(names).toContain('help.offered');

      const offered = events.find((e) => e.name === 'help.offered')?.payload as
        | { caseId: string; helper: { name: string }; helpType: string }
        | undefined;
      expect(offered?.caseId).toBe(target.id);
      expect(offered?.helpType).toBe('food');
      expect(offered?.helper.name).toBeTruthy();

      // the reporter has a notification row (Phase 3's `/me/notifications` reads it)
      const notification = await prisma.notification.findFirst({
        where: { userId: owner.id, kind: 'help', href: `/cases/${target.id}` },
      });
      expect(notification).not.toBeNull();
      expect(names).toContain('notification');
    });

    it('refuses a connection with no handshake token', async () => {
      const socket = io(`${baseUrl}/realtime`, { reconnection: false });
      const rejected = await new Promise<boolean>((resolve) => {
        socket.on('connect_error', () => resolve(true));
        socket.on('connect', () => resolve(false));
        setTimeout(() => resolve(true), 5000);
      });
      socket.close();
      expect(rejected).toBe(true);
    });
  });

  // ── 6. confirmations ──
  describe('6 · POST /cases/:id/confirm — two confirmations verify a case', () => {
    it('raises an unverified case to verified on the second confirmation', async () => {
      // Five checks are known here — account, inAlgeria, onSite, duplicate,
      // rateLimit — and `onSite` fails because the reporter says they are 90 km
      // away. 4 of 5 is 0.8: below the 0.85 verified cut, above the 0.5
      // suspicious one, and `onSite` is not in the web's hardFail set. That is
      // the web's own "unverified" corner.
      const owner = await freshReporter();
      const target = await createCase(owner.token, {
        title: 'Chienne et ses chiots',
        species: 'dog',
        category: 'companion',
        location: { ...KABYLIE },
        description: 'Une chienne et ses chiots sous un buisson, ils ont l air maigres.',
        conditionTags: ['thin'],
        device: { lat: 35.7, lng: 5.4 },
      });
      expect(target.trust.score).toBeCloseTo(0.8, 2);
      expect(target.trust.level).toBe('unverified');

      const other = await register('reporter');
      const first = await request(app.getHttpServer())
        .post(`/cases/${target.id}/confirm`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(200);
      expect(first.body.trust.confirmations).toBe(1);

      const third = await register('reporter');
      const second = await request(app.getHttpServer())
        .post(`/cases/${target.id}/confirm`)
        .set('Authorization', `Bearer ${third.token}`)
        .expect(200);

      expect(second.body.trust.confirmations).toBe(2);
      expect(second.body.trust.level).toBe('verified');
      expect(second.body.trust.score).toBeGreaterThan(target.trust.score);
    });

    it('lets one account confirm only once', async () => {
      const owner = await freshReporter();
      const target = await createCase(owner.token, {
        title: 'Âne près de la route',
        species: 'donkey',
        category: 'livestock',
        location: { ...KABYLIE },
        description: 'Un âne qui reste au bord de la route depuis ce matin.',
        conditionTags: ['thin'],
      });

      await request(app.getHttpServer())
        .post(`/cases/${target.id}/confirm`)
        .set('Authorization', `Bearer ${volunteer.token}`)
        .expect(200);
      await request(app.getHttpServer())
        .post(`/cases/${target.id}/confirm`)
        .set('Authorization', `Bearer ${volunteer.token}`)
        .expect(409);
    });
  });

  // ── 7. flags ──
  describe('7 · POST /cases/:id/flag — three flags put a case back to pending', () => {
    it('hides the case from the public map on the third flag', async () => {
      const owner = await freshReporter();
      const target = await createCase(owner.token, {
        title: 'Brebis dans un ravin',
        species: 'sheep',
        category: 'livestock',
        location: { ...KABYLIE },
        description: 'Une brebis blessée au fond du ravin.',
        conditionTags: ['injured'],
      });

      const flippers = [await register('reporter'), await register('reporter'), await register('reporter')];
      for (const flipper of flippers) {
        await request(app.getHttpServer())
          .post(`/cases/${target.id}/flag`)
          .set('Authorization', `Bearer ${flipper.token}`)
          .send({ reason: 'signalement douteux' })
          .expect(200);
      }

      const flagged = await request(app.getHttpServer())
        .get(`/cases/${target.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(flagged.body.moderation).toBe('pending');
      expect(flagged.body.trust.flags).toBe(3);

      const publicList = await request(app.getHttpServer())
        .get(`/cases?bbox=${KABYLIE_BBOX}`)
        .expect(200);
      expect(publicList.body.items.map((c: CaseResponse) => c.id)).not.toContain(target.id);
    });
  });

  // ── 8. status by role ──
  describe('8 · PATCH /cases/:id/status — volunteer 200, reporter 403', () => {
    it('accepts a volunteer and refuses the reporter', async () => {
      const owner = await freshReporter();
      const target = await createCase(owner.token, {
        title: 'Cheval désorienté',
        species: 'horse',
        category: 'livestock',
        location: { ...KABYLIE },
        description: 'Un cheval désorienté dans un champ.',
        conditionTags: ['lost'],
      });

      const byVolunteer = await request(app.getHttpServer())
        .patch(`/cases/${target.id}/status`)
        .set('Authorization', `Bearer ${volunteer.token}`)
        .send({ status: 'in_progress' })
        .expect(200);
      expect(byVolunteer.body.status).toBe('in_progress');

      const byReporter = await request(app.getHttpServer())
        .patch(`/cases/${target.id}/status`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: 'resolved' })
        .expect(403);
      expect(byReporter.body.code).toBe('FORBIDDEN');

      const anonymous = await request(app.getHttpServer())
        .patch(`/cases/${target.id}/status`)
        .send({ status: 'resolved' })
        .expect(401);
      expect(anonymous.body.code).toBe('AUTH_UNAUTHORIZED');
    });
  });

  // ── 9. the AI, in a language the case was not written in ──
  describe('9 · POST /ai/analyze — safety rules override the model in every language', () => {
    it('forces urgent on an Arabic keyword', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/analyze')
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({
          description: 'حيوان ينزيف بشدة ولا يستطيع الحركة',
          species: 'dog',
          conditionTags: ['bleeding'],
          location: { ...KABYLIE },
          lang: 'ar',
        })
        .expect(201);

      expect(response.body.triage).toBe('urgent');
      expect(response.body.forcedUrgentByRule).toBe(true);
      expect(response.body.disclaimer.length).toBeGreaterThan(0);
      expect(response.body.suggestedServices.length).toBeGreaterThan(0);
      // never a diagnosis
      expect(JSON.stringify(response.body)).not.toMatch(/diagnos|traitement|médicament/i);
    });

    it('forces urgent on a Darija keyword', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/analyze')
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({
          description: 'ضربتو طوموبيل ومش قادر يقوم',
          species: 'cat',
          conditionTags: [],
          location: { ...KABYLIE },
          lang: 'ar',
        })
        .expect(201);

      expect(response.body.triage).toBe('urgent');
      expect(response.body.forcedUrgentByRule).toBe(true);
    });

    it('writes the answer in the language asked for', async () => {
      const body = {
        description: 'un chat amaigri qui dort dans la rue',
        species: 'cat',
        conditionTags: ['thin'],
        location: { ...KABYLIE },
      };

      const fr = await request(app.getHttpServer())
        .post('/ai/analyze')
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({ ...body, lang: 'fr' })
        .expect(201);
      const en = await request(app.getHttpServer())
        .post('/ai/analyze')
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({ ...body, lang: 'en' })
        .expect(201);

      expect(fr.body.summary).not.toBe(en.body.summary);
      expect(en.body.disclaimer).toMatch(/veterinarian/i);
      expect(fr.body.disclaimer).toMatch(/vétérinaire/i);
    });

    it('is null for animalDetected when no photo was sent', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/analyze')
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({ description: 'un chien dans la rue', species: 'dog', location: { ...KABYLIE } })
        .expect(201);

      expect(response.body.animalDetected).toBeNull();
    });
  });

  // ── 10. the rate limit ──
  describe('10 · the 6th report in an hour is refused', () => {
    it('answers 429 TRUST_RATE_LIMITED on the sixth report from one account', async () => {
      const limited = await register('reporter');
      const body = {
        title: 'Limite horaire',
        species: 'other' as const,
        category: 'companion' as const,
        location: { ...KABYLIE },
        description: 'Un signalement de plus dans l heure.',
        conditionTags: [],
      };

      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer())
          .post('/cases')
          .set('Authorization', `Bearer ${limited.token}`)
          .send({ ...body, title: `Limite horaire ${i + 1}` });
        expect([200, 201]).toContain(response.status);
      }

      const sixth = await request(app.getHttpServer())
        .post('/cases')
        .set('Authorization', `Bearer ${limited.token}`)
        .send({ ...body, title: 'Limite horaire 6' })
        .expect(429);

      expect(sixth.body.code).toBe('TRUST_RATE_LIMITED');
      // the throttler storage was overridden, so this is the trust pipeline
      // speaking and not the per-IP backstop
      expect(sixth.body.message).toMatch(/signalements/i);
    });
  });
});
