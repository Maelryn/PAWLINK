import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { getStorageToken } from '@nestjs/throttler';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import sharp from 'sharp';
import { configureApp } from '../src/setup';
import { AppModule } from '../src/app.module';
import { prismaClientOptions } from '../src/common/prisma/client-options';
import { describeWithDatabase, uniqueEmail, uniquePhone } from './support/e2e-gate';

/**
 * Phase 3 — the marketplace: adoptions, services, reviews, bookings, zones,
 * notifications (docs/PHASE3_PROMPT.md §7).
 *
 * The two headline rules are proven end-to-end against a real PostGIS:
 *   - the **phone-reveal** rule: an accepted requester sees `ownerPhone`; a
 *     pending requester, a stranger and an anonymous visitor never do;
 *   - **one review per user per service**, with `rating`/`reviewCount`
 *     recomputed exactly once.
 *
 * Every listing photo is generated at run time with a unique shape and real
 * camera EXIF, because the adoption gate demands a camera identity *and* a
 * photo never used elsewhere on PawLink — two identical fixtures would look
 * like the same photo to the dHash check.
 */

/** Throttler storage that never counts, so the suite can flow freely. */
const neverCount: ThrottlerStorage = {
  increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
};

const KABYLIE = { lat: 36.632, lng: 4.205 };
const ORAN = { lat: 35.7, lng: -0.63 };
const PASSWORD = 'pawlink-e2e-2026';

interface Session {
  email: string;
  phone: string;
  token: string;
  id: string;
}

describeWithDatabase('Phase 3 — marketplace: adoptions, services, zones, notifications', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let baseUrl = '';

  /** The adoption/service owner — the account every decision flows back to. */
  let owner: Session;
  let requester: Session;
  let stranger: Session;
  let admin: Session;

  /** Zone ids this suite created, so afterAll can reclaim them. */
  const zoneIds: string[] = [];
  /** Monotonic seed so every generated photo has a distinct dHash. */
  let photoSeed = 1;

  async function register(role: 'reporter' | 'volunteer'): Promise<Session> {
    const email = uniqueEmail();
    const phone = uniquePhone();
    const created = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: `E2E mkt ${role}`, email, password: PASSWORD, phone, role })
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

  /** Promotes an account in the database — there is no self-serve admin path. */
  async function promote(session: Session): Promise<string> {
    await prisma.user.update({ where: { id: session.id }, data: { role: 'admin' } });
    const relogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: session.email, password: PASSWORD })
      .expect(200);
    return relogin.body.accessToken as string;
  }

  /**
   * A unique camera photo with deterministic pixels.
   *
   * The image is seeded noise, not a shape: the adoption gate rejects a photo
   * whose dHash was already seen anywhere on PawLink, and two smooth shapes a
   * pixel apart hash *identically* — which silently makes later listings look
   * like copies of earlier ones. Noise makes every seed a different photo.
   * The same seed still always yields the same bytes, which is what the
   * "photo already used" case below relies on.
   */
  async function cameraJpeg(seed: number): Promise<Buffer> {
    let state = (seed * 2654435761) >>> 0 || 1;
    const next = () => {
      // xorshift32 — tiny, deterministic, and enough to decorrelate seeds.
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state;
    };
    const pixels = Buffer.alloc(160 * 160 * 3);
    for (let i = 0; i < pixels.length; i += 3) {
      const v = next();
      pixels[i] = v & 0xff;
      pixels[i + 1] = (v >>> 8) & 0xff;
      pixels[i + 2] = (v >>> 16) & 0xff;
    }
    return sharp(pixels, { raw: { width: 160, height: 160, channels: 3 } })
      .jpeg()
      .withExif({
        IFD0: { Make: 'PawLink', Model: 'E2ECam' },
        IFD2: { DateTimeOriginal: '2026:10:13 12:00:00' },
      })
      .toBuffer();
  }

  /** Probes a generated photo; returns a plausible Cloudinary URL + probeId. */
  async function photo(token: string, seed = photoSeed++): Promise<{ url: string; probeId: string }> {
    const bytes = await cameraJpeg(seed);
    const probed = await request(app.getHttpServer())
      .post('/uploads/probe')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', bytes, `e2e-${seed}.jpg`)
      .expect(200);
    return {
      url: `https://res.cloudinary.com/demo/image/upload/v1/e2e-mkt-${seed}.jpg`,
      probeId: probed.body.probeId as string,
    };
  }

  /** Creates a listing (status `pending`) with `count` freshly probed photos. */
  async function createAdoption(
    token: string,
    name: string,
    count: number,
    location = KABYLIE,
  ): Promise<{ id: string; status: string }> {
    const made = await Promise.all(Array.from({ length: count }, () => photo(token)));
    const response = await request(app.getHttpServer())
      .post('/adoptions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        species: 'dog',
        sex: 'male',
        ageMonths: 14,
        photos: made.map((p) => p.url),
        probeIds: made.map((p) => p.probeId),
        healthStatus: 'Bon état général',
        story: 'Trouvé sur la route, très sociable.',
        location: { ...location, address: 'Tizi Ouzou' },
      });
    expect([200, 201]).toContain(response.status);
    return response.body as { id: string; status: string };
  }

  /** Creates a listing and has the admin publish it. */
  async function approvedAdoption(token: string, name: string): Promise<{ id: string }> {
    const listing = await createAdoption(token, name, 1);
    const moderated = await request(app.getHttpServer())
      .patch(`/admin/adoptions/${listing.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'approved' })
      .expect(200);
    expect(moderated.body.status).toBe('approved');
    return listing;
  }

  async function createService(
    token: string,
    name: string,
    location: { lat: number; lng: number },
  ): Promise<{ id: string; status: string }> {
    const response = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'vet',
        name,
        lat: location.lat,
        lng: location.lng,
        address: 'Algérie',
        phone: '+213 555 00 00',
        tags: ['urgence'],
      });
    expect([200, 201]).toContain(response.status);
    return response.body as { id: string; status: string };
  }

  async function approveService(id: string): Promise<void> {
    const moderated = await request(app.getHttpServer())
      .patch(`/admin/services/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'approved' })
      .expect(200);
    expect(moderated.body.status).toBe('approved');
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getStorageToken())
      .useValue(neverCount)
      .compile();

    app = configureApp(moduleRef.createNestApplication());
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 4000;
    baseUrl = `http://127.0.0.1:${port}`;

    prisma = new PrismaClient(prismaClientOptions());

    owner = await register('reporter');
    requester = await register('reporter');
    stranger = await register('reporter');
    const maybeAdmin = await register('reporter');
    const token = await promote(maybeAdmin);
    admin = { ...maybeAdmin, token };
  });

  afterAll(async () => {
    // Dependency order — every FK from Phase 3 is optional or Cascade, but
    // deleting explicitly keeps the suite replayable against a seeded db.
    await prisma.adoptionRequest.deleteMany({
      where: {
        OR: [
          { from: { email: { startsWith: 'e2e-' } } },
          { adoption: { owner: { email: { startsWith: 'e2e-' } } } },
        ],
      },
    });
    await prisma.adoption.deleteMany({ where: { owner: { email: { startsWith: 'e2e-' } } } });
    await prisma.review.deleteMany({ where: { author: { email: { startsWith: 'e2e-' } } } });
    await prisma.booking.deleteMany({ where: { from: { email: { startsWith: 'e2e-' } } } });
    await prisma.service.deleteMany({ where: { owner: { email: { startsWith: 'e2e-' } } } });
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: 'e2e-' } } } });
    // The seed writes no adoption hashes; the cases suite owns subjectType 'case'.
    await prisma.photoHash.deleteMany({ where: { subjectType: 'adoption' } });
    await prisma.photoProbe.deleteMany({ where: { user: { email: { startsWith: 'e2e-' } } } });
    if (zoneIds.length > 0) {
      await prisma.emergencyZone.deleteMany({ where: { id: { in: zoneIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-' } } });
    await prisma.$disconnect().catch(() => undefined);
    await app.close();
  });

  // ── 1. the phone-reveal rule (Phase 3 headline) ──
  describe('1 · the phone-reveal rule', () => {
    it('shows ownerPhone to an accepted requester — and to nobody else', async () => {
      const accepted = await approvedAdoption(owner.token, 'Rex accepté');
      const declined = await approvedAdoption(owner.token, 'Mila déclinée');

      // ── before any decision: the requester sees no phone ──
      const ask = await request(app.getHttpServer())
        .post(`/adoptions/${accepted.id}/requests`)
        .set('Authorization', `Bearer ${requester.token}`)
        .send({ message: 'Je peux adopter Rex.', housing: 'house', experience: true })
        .expect(201);
      expect(ask.body.status).toBe('sent');

      const beforeDecision = await request(app.getHttpServer())
        .get(`/adoptions/${accepted.id}`)
        .set('Authorization', `Bearer ${requester.token}`)
        .expect(200);
      expect('ownerPhone' in beforeDecision.body).toBe(false);

      // ── the owner accepts ──
      const decide = await request(app.getHttpServer())
        .patch(`/requests/${ask.body.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: 'accepted' })
        .expect(200);
      expect(decide.body.status).toBe('accepted');

      const afterAccepted = await request(app.getHttpServer())
        .get(`/adoptions/${accepted.id}`)
        .set('Authorization', `Bearer ${requester.token}`)
        .expect(200);
      expect(afterAccepted.body.ownerPhone).toBe(owner.phone);

      // ── a stranger and an anonymous visitor still see nothing ──
      const asStranger = await request(app.getHttpServer())
        .get(`/adoptions/${accepted.id}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(200);
      expect('ownerPhone' in asStranger.body).toBe(false);

      const anonymous = await request(app.getHttpServer())
        .get(`/adoptions/${accepted.id}`)
        .expect(200);
      expect('ownerPhone' in anonymous.body).toBe(false);

      // ── a *declined* requester on another listing never earns the phone ──
      const ask2 = await request(app.getHttpServer())
        .post(`/adoptions/${declined.id}/requests`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ message: 'Moi aussi je peux.', housing: 'apartment', experience: false })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/requests/${ask2.body.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: 'declined' })
        .expect(200);

      const afterDeclined = await request(app.getHttpServer())
        .get(`/adoptions/${declined.id}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(200);
      expect('ownerPhone' in afterDeclined.body).toBe(false);

      // and the owner always sees their own phone
      const asOwner = await request(app.getHttpServer())
        .get(`/adoptions/${accepted.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(asOwner.body.ownerPhone).toBe(owner.phone);
    });

    it('never puts a phone on an AdoptionRequest, and hides pending listings', async () => {
      const pending = await createAdoption(owner.token, 'En attente', 1);

      // an unapproved listing is a 404 for a stranger …
      await request(app.getHttpServer())
        .get(`/adoptions/${pending.id}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(404);
      // … and absent from the approved-only default list
      const list = await request(app.getHttpServer())
        .get('/adoptions?pageSize=100')
        .expect(200);
      expect(list.body.items.map((a: { id: string }) => a.id)).not.toContain(pending.id);

      // but its owner still finds it via /me/adoptions, in any status
      const mine = await request(app.getHttpServer())
        .get('/me/adoptions?pageSize=100')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(mine.body.items.map((a: { id: string }) => a.id)).toContain(pending.id);

      const requests = await request(app.getHttpServer())
        .get('/me/requests')
        .set('Authorization', `Bearer ${requester.token}`)
        .expect(200);
      expect(requests.body.items.length).toBeGreaterThan(0);
      for (const item of requests.body.items) {
        expect('phone' in item).toBe(false);
        expect('ownerPhone' in item).toBe(false);
      }
    });
  });

  // ── 2. reviews: one per user per service, rating recomputed once ──
  describe('2 · reviews', () => {
    let serviceId = '';

    beforeAll(async () => {
      const service = await createService(owner.token, 'Clinique El Djazaïr', KABYLIE);
      await approveService(service.id);
      serviceId = service.id;
    });

    it('accepts one review per user, recomputes rating+count once, and refuses the second', async () => {
      const first = await request(app.getHttpServer())
        .post(`/services/${serviceId}/reviews`)
        .set('Authorization', `Bearer ${requester.token}`)
        .send({ rating: 4, text: 'Très bien, accueil rapide.' })
        .expect(201);
      expect(first.body.rating).toBe(4);

      const afterFirst = await request(app.getHttpServer()).get(`/services/${serviceId}`).expect(200);
      expect(afterFirst.body.rating).toBe(4);
      expect(afterFirst.body.reviewCount).toBe(1);

      // the second attempt by the same user is refused …
      const second = await request(app.getHttpServer())
        .post(`/services/${serviceId}/reviews`)
        .set('Authorization', `Bearer ${requester.token}`)
        .send({ rating: 1, text: 'Changement d’avis.' })
        .expect(409);
      expect(second.body.code).toBe('REVIEW_EXISTS');

      // … and changed nothing: updated exactly once
      const afterRefused = await request(app.getHttpServer()).get(`/services/${serviceId}`).expect(200);
      expect(afterRefused.body.rating).toBe(4);
      expect(afterRefused.body.reviewCount).toBe(1);

      // a different user's 5★ makes it the average of exactly two reviews
      await request(app.getHttpServer())
        .post(`/services/${serviceId}/reviews`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ rating: 5, text: 'Excellent.' })
        .expect(201);
      const afterSecond = await request(app.getHttpServer()).get(`/services/${serviceId}`).expect(200);
      expect(afterSecond.body.rating).toBe(4.5);
      expect(afterSecond.body.reviewCount).toBe(2);

      // the owner is notified of each review, with the author's name
      const notifications = await request(app.getHttpServer())
        .get('/me/notifications?pageSize=100')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      const reviewNotes = notifications.body.items.filter(
        (n: { kind: string; href: string }) => n.kind === 'review' && n.href === `/services/${serviceId}`,
      );
      expect(reviewNotes.map((n: { subject: string }) => n.subject).sort()).toEqual([
        'E2E mkt reporter',
        'E2E mkt reporter',
      ]);
    });

    it('refuses a review on your own service and a reply from anyone else', async () => {
      const own = await request(app.getHttpServer())
        .post(`/services/${serviceId}/reviews`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ rating: 5, text: 'Moi-même.' })
        .expect(403);
      expect(own.body.code).toBe('REVIEW_OWNER');

      const reviews = await request(app.getHttpServer())
        .get(`/services/${serviceId}/reviews`)
        .expect(200);
      const reviewId = reviews.body.items[0].id as string;

      const notOwner = await request(app.getHttpServer())
        .patch(`/services/${serviceId}/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ reply: 'Merci !' })
        .expect(403);
      expect(notOwner.body.code).toBe('SERVICE_NOT_OWNER');

      const ownerReply = await request(app.getHttpServer())
        .patch(`/services/${serviceId}/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ reply: 'Merci à vous !' })
        .expect(200);
      expect(ownerReply.body.reply).toBe('Merci à vous !');
    });
  });

  // ── 3. admin moderation of a listing ──
  describe('3 · admin moderation', () => {
    it('approve publishes + notifies; reject notifies; a non-admin cannot moderate', async () => {
      const listing = await createAdoption(owner.token, 'Nour à modérer', 1);

      const forbidden = await request(app.getHttpServer())
        .patch(`/admin/adoptions/${listing.id}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ status: 'approved' })
        .expect(403);
      expect(forbidden.body.code).toBe('FORBIDDEN');

      const approved = await request(app.getHttpServer())
        .patch(`/admin/adoptions/${listing.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'approved' })
        .expect(200);
      expect(approved.body.status).toBe('approved');
      expect(approved.body.ownerPhone).toBeUndefined();

      const visible = await request(app.getHttpServer())
        .get('/adoptions?pageSize=100')
        .expect(200);
      expect(visible.body.items.map((a: { id: string }) => a.id)).toContain(listing.id);

      const notifications = await request(app.getHttpServer())
        .get('/me/notifications?pageSize=100')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      const note = notifications.body.items.find(
        (n: { kind: string; href: string }) =>
          n.kind === 'listingApproved' && n.href === `/adopt/${listing.id}`,
      );
      expect(note).toBeDefined();
      expect(note.subject).toBe('Nour à modérer');

      // a second listing: rejected, notified, and never public
      const doomed = await createAdoption(owner.token, 'Bilal rejeté', 1);
      await request(app.getHttpServer())
        .patch(`/admin/adoptions/${doomed.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'rejected' })
        .expect(200);

      const rejectedNotes = await request(app.getHttpServer())
        .get('/me/notifications?pageSize=100')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(
        rejectedNotes.body.items.some(
          (n: { kind: string; href: string }) =>
            n.kind === 'listingRejected' && n.href === `/adopt/${doomed.id}`,
        ),
      ).toBe(true);

      await request(app.getHttpServer())
        .get(`/adoptions/${doomed.id}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(404);
    });

    it('owner-only edits: PATCH /adoptions/:id and PATCH /services/:id refuse strangers', async () => {
      const listing = await approvedAdoption(owner.token, 'Zineb à éditer');
      const edit = await request(app.getHttpServer())
        .patch(`/adoptions/${listing.id}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ story: 'Histoire volée.' })
        .expect(403);
      expect(edit.body.code).toBe('ADOPTION_NOT_OWNER');

      const ok = await request(app.getHttpServer())
        .patch(`/adoptions/${listing.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ story: 'Histoire mise à jour.' })
        .expect(200);
      expect(ok.body.story).toBe('Histoire mise à jour.');
      // content-only: the status never moves through the owner's PATCH
      expect(ok.body.status).toBe('approved');

      const service = await createService(owner.token, 'Refuge de Kabylie', KABYLIE);
      await approveService(service.id);
      const serviceEdit = await request(app.getHttpServer())
        .patch(`/services/${service.id}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ name: 'Volé' })
        .expect(403);
      expect(serviceEdit.body.code).toBe('SERVICE_NOT_OWNER');
    });
  });

  // ── 4. the booking flow ──
  describe('4 · bookings', () => {
    it('create → owner confirms → the booker reads `confirmed` + a notification', async () => {
      const service = await createService(owner.token, 'Toiletteur El Djazaïr', KABYLIE);
      await approveService(service.id);

      const booking = await request(app.getHttpServer())
        .post(`/services/${service.id}/bookings`)
        .set('Authorization', `Bearer ${requester.token}`)
        .send({ date: '2026-10-20', time: '14:30', animal: 'Rex (chien, 3 ans)', reason: 'Toiletage' })
        .expect(201);
      expect(booking.body.status).toBe('sent');

      // the owner is notified of the request itself
      const ownerNotes = await request(app.getHttpServer())
        .get('/me/notifications?pageSize=100')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(
        ownerNotes.body.items.some(
          (n: { kind: string; href: string }) =>
            n.kind === 'booking' && n.href === '/account?tab=pro',
        ),
      ).toBe(true);

      // a stranger cannot decide it
      const forbidden = await request(app.getHttpServer())
        .patch(`/bookings/${booking.body.id}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ status: 'confirmed' })
        .expect(403);
      expect(forbidden.body.code).toBe('BOOKING_NOT_OWNER');

      // the owner confirms
      const confirmed = await request(app.getHttpServer())
        .patch(`/bookings/${booking.body.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: 'confirmed' })
        .expect(200);
      expect(confirmed.body.status).toBe('confirmed');

      // terminal: a second answer is a 409
      const again = await request(app.getHttpServer())
        .patch(`/bookings/${booking.body.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: 'declined' })
        .expect(409);
      expect(again.body.code).toBe('BOOKING_ALREADY_ANSWERED');

      // the booker reads it back and finds the notification
      const mine = await request(app.getHttpServer())
        .get('/me/bookings?pageSize=100')
        .set('Authorization', `Bearer ${requester.token}`)
        .expect(200);
      const read = mine.body.items.find((b: { id: string }) => b.id === booking.body.id);
      expect(read.status).toBe('confirmed');
      expect(read.from.id).toBe(requester.id);

      const bookerNotes = await request(app.getHttpServer())
        .get('/me/notifications?pageSize=100')
        .set('Authorization', `Bearer ${requester.token}`)
        .expect(200);
      const confirmedNote = bookerNotes.body.items.find(
        (n: { kind: string; href: string }) =>
          n.kind === 'bookingConfirmed' && n.href === `/services/${service.id}`,
      );
      expect(confirmedNote).toBeDefined();
      expect(confirmedNote.subject).toBe('Toiletteur El Djazaïr');
    });
  });

  // ── 5. /me/notifications ──
  describe('5 · GET /me/notifications + read-all', () => {
    it('returns the caller’s rows newest-first, and read-all marks every one read', async () => {
      // a fresh notification so this test does not depend on ordering
      const listing = await approvedAdoption(owner.token, 'Temsi pour notifications');
      await request(app.getHttpServer())
        .post(`/adoptions/${listing.id}/requests`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ message: 'Je peux adopter.', housing: 'apartment', experience: false })
        .expect(201);

      const rows = await request(app.getHttpServer())
        .get('/me/notifications?pageSize=100')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(rows.body.total).toBeGreaterThan(0);
      const newest = rows.body.items[0];
      expect(newest).toMatchObject({
        kind: 'adoptRequest',
        subject: 'E2E mkt reporter',
        href: '/account?tab=requests',
        read: false,
      });
      expect(typeof newest.createdAt).toBe('string');

      await request(app.getHttpServer())
        .post('/me/notifications/read-all')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(204);

      const after = await request(app.getHttpServer())
        .get('/me/notifications?pageSize=100')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(after.body.items.every((n: { read: boolean }) => n.read)).toBe(true);

      // read-all never touches anyone else's rows
      const strangers = await request(app.getHttpServer())
        .get('/me/notifications')
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(200);
      expect(strangers.body.items.length).toBeGreaterThan(0);
      expect(strangers.body.items.every((n: { read: boolean }) => !n.read)).toBe(true);
    });
  });

  // ── 6. emergency zones ──
  describe('6 · GET /emergency-zones', () => {
    it('returns the seeded zone with a GeoJSON polygon, a centroid and live stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/emergency-zones?active=true')
        .expect(200);

      const z1 = response.body.items.find((z: { id: string }) => z.id === 'z1');
      expect(z1).toBeDefined();
      expect(z1.polygon.type).toBe('Polygon');
      // GeoJSON is [lng, lat] everywhere, and the ring is closed
      const ring = z1.polygon.coordinates[0];
      expect(Array.isArray(ring[0])).toBe(true);
      expect(typeof ring[0][0]).toBe('number'); // lng
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      // the center is a real centroid, not the polygon's first point
      expect(z1.center).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
      // the seed filed cases against z1, so live stats are non-zero
      expect(z1.stats.cases).toBeGreaterThan(0);
      expect(typeof z1.name).toBe('string');
      expect(typeof z1.region).toBe('string');
    });

    it('POST is admin-only, validates the polygon, and computes the centroid', async () => {
      const forbidden = await request(app.getHttpServer())
        .post('/emergency-zones')
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ name: 'Zone pirate', region: 'Tizi Ouzou', type: 'flood', polygon: square(4.0, 36.6) })
        .expect(403);
      expect(forbidden.body.code).toBe('FORBIDDEN');

      const bad = await request(app.getHttpServer())
        .post('/emergency-zones')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          name: 'Zone ouverte',
          region: 'Tizi Ouzou',
          type: 'flood',
          polygon: {
            type: 'Polygon',
            coordinates: [
              [
                [4.0, 36.6],
                [4.1, 36.6],
                [4.1, 36.7],
                [4.05, 36.65], // first ≠ last: the ring is not closed
              ],
            ],
          },
        })
        .expect(400);
      expect(bad.body.code).toBe('ZONE_INVALID_POLYGON');

      const created = await request(app.getHttpServer())
        .post('/emergency-zones')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Zone e2e', region: 'Tizi Ouzou', type: 'flood', polygon: square(4.0, 36.6) })
        .expect(201);
      zoneIds.push(created.body.id);
      // center == ST_Centroid == the middle of the square
      expect(created.body.center.lng).toBeCloseTo(4.025, 3);
      expect(created.body.center.lat).toBeCloseTo(36.625, 3);
      expect(created.body.stats).toEqual({ cases: 0, urgent: 0, helpers: 0 });

      const patched = await request(app.getHttpServer())
        .patch(`/emergency-zones/${created.body.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ active: false })
        .expect(200);
      expect(patched.body.active).toBe(false);

      // an empty zone deletes cleanly — the seeded one cannot (cases point at it)
      await request(app.getHttpServer())
        .delete(`/emergency-zones/${created.body.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(204);

      const inUse = await request(app.getHttpServer())
        .delete('/emergency-zones/z1')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(409);
      expect(inUse.body.code).toBe('ZONE_IN_USE');
    });
  });

  // ── 7. the directory geo query ──
  describe('7 · GET /services?lat&lng&radiusKm', () => {
    it('excludes a far-away service and orders `pro` ahead of distance', async () => {
      // The seed ships its own approved services (incl. pro ones in Kabylie),
      // so the assertions are about *this* suite's rows by id.
      const pro = await createService(owner.token, 'Clinique Pro Kabylie', KABYLIE);
      const near = await createService(owner.token, 'Refuge Sans Pro Kabylie', {
        lat: 36.639,
        lng: 4.213,
      });
      const far = await createService(owner.token, 'Clinique Oran Lointaine', ORAN);
      await approveService(pro.id);
      await approveService(near.id);
      await approveService(far.id);
      // `pro` is a reserved commercial flag: no route sets it, so the test
      // promotes the listing in the database (same trick as the admin promotion).
      await prisma.service.update({ where: { id: pro.id }, data: { pro: true } });

      const response = await request(app.getHttpServer())
        .get('/services?lat=36.632&lng=4.205&radiusKm=50')
        .expect(200);
      const ids = response.body.items.map((s: { id: string }) => s.id);
      expect(ids).toContain(pro.id);
      expect(ids).toContain(near.id);
      expect(ids).not.toContain(far.id); // Oran is ~300 km away

      // pro-first: the pro listing outranks the *closer* non-pro one …
      expect(ids.indexOf(pro.id)).toBeLessThan(ids.indexOf(near.id));
      // … and the whole page is pro-run then non-pro-run
      const flags = response.body.items.map((s: { pro: boolean }) => s.pro);
      const firstNonPro = flags.indexOf(false);
      expect(firstNonPro).toBeGreaterThan(0);
      expect(flags.slice(firstNonPro).every((p: boolean) => !p)).toBe(true);

      const search = await request(app.getHttpServer())
        .get('/services?q=Lointaine')
        .expect(200);
      expect(search.body.items.map((s: { id: string }) => s.id)).toEqual([far.id]);
    });
  });

  // ── 8. realtime: the notification event ──
  describe('8 · a socket receives the notification event', () => {
    it('emits `notification` when a request lands on the owner’s listing', async () => {
      const listing = await approvedAdoption(owner.token, 'Suki en ligne');

      const socket: Socket = io(`${baseUrl}/realtime`, {
        reconnection: false,
        auth: { token: owner.token },
      });
      const events: Array<{ name: string; payload: Record<string, unknown> }> = [];
      socket.on('notification', (payload: Record<string, unknown>) =>
        events.push({ name: 'notification', payload }),
      );
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', (e) => reject(new Error(e.message)));
        setTimeout(() => reject(new Error('socket connect timeout')), 5000);
      });

      try {
        await request(app.getHttpServer())
          .post(`/adoptions/${listing.id}/requests`)
          .set('Authorization', `Bearer ${requester.token}`)
          .send({ message: 'Adoption, svp.', housing: 'house', experience: true })
          .expect(201);

        // the broadcast is asynchronous, but it has to land
        const deadline = Date.now() + 4000;
        while (
          events.length === 0 &&
          Date.now() < deadline
        ) {
          await new Promise((r) => setTimeout(r, 25));
        }
      } finally {
        socket.close();
      }

      expect(events.length).toBeGreaterThan(0);
      // the gateway wraps the row: `{ notification: AppNotification }`
      expect(events[0].payload).toMatchObject({
        notification: {
          kind: 'adoptRequest',
          href: '/account?tab=requests',
        },
      });
    });
  });

  // ── 9. the write gates: photo rules, request state machine, owner-only edits ──
  describe('9 · write gates', () => {
    it('enforces the photo rules: 3 max, camera EXIF, never used before', async () => {
      const made = await Promise.all([1, 2, 3, 4].map(() => photo(owner.token)));
      const urls = made.map((p) => p.url);
      const probes = made.map((p) => p.probeId);

      const tooMany = await request(app.getHttpServer())
        .post('/adoptions')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          name: 'Trop de photos',
          species: 'cat',
          sex: 'female',
          ageMonths: 8,
          photos: urls,
          probeIds: probes,
          healthStatus: 'Bon',
          story: 'Histoire.',
          location: { ...KABYLIE, address: 'Tizi Ouzou' },
        })
        .expect(413);
      expect(tooMany.body.code).toBe('ADOPTION_TOO_MANY_PHOTOS');

      // no camera EXIF: a phone-less, date-less jpeg is not a camera photo
      const plain = await sharp({
        create: { width: 160, height: 160, channels: 3, background: { r: 20, g: 140, b: 90 } },
      })
        .jpeg()
        .toBuffer();
      const plainProbe = await request(app.getHttpServer())
        .post('/uploads/probe')
        .set('Authorization', `Bearer ${owner.token}`)
        .attach('file', plain, 'sans-exif.jpg')
        .expect(200);
      const noExif = await request(app.getHttpServer())
        .post('/adoptions')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          name: 'Sans EXIF',
          species: 'cat',
          sex: 'female',
          ageMonths: 8,
          photos: ['https://res.cloudinary.com/demo/image/upload/v1/e2e-noexif.jpg'],
          probeIds: [plainProbe.body.probeId],
          healthStatus: 'Bon',
          story: 'Histoire.',
          location: { ...KABYLIE, address: 'Tizi Ouzou' },
        })
        .expect(400);
      expect(noExif.body.code).toBe('ADOPTION_PHOTO_NO_EXIF');

      // a photo already used on PawLink (same pixels, new probe) is refused
      const first = await photo(owner.token);
      const used = await request(app.getHttpServer())
        .post('/adoptions')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          name: 'Première annonce',
          species: 'cat',
          sex: 'female',
          ageMonths: 8,
          photos: [first.url],
          probeIds: [first.probeId],
          healthStatus: 'Bon',
          story: 'Histoire.',
          location: { ...KABYLIE, address: 'Tizi Ouzou' },
        })
        .expect(201);
      expect(used.body.status).toBe('pending');

      const reused = await photo(owner.token, Number(first.url.match(/-(\d+)\.jpg$/)?.[1] ?? 0));
      const duplicate = await request(app.getHttpServer())
        .post('/adoptions')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          name: 'Photo recyclée',
          species: 'cat',
          sex: 'female',
          ageMonths: 8,
          photos: [reused.url],
          probeIds: [reused.probeId],
          healthStatus: 'Bon',
          story: 'Histoire.',
          location: { ...KABYLIE, address: 'Tizi Ouzou' },
        })
        .expect(409);
      expect(duplicate.body.code).toBe('ADOPTION_PHOTO_DUPLICATE');
    });

    it('runs the request state machine: one per user, owner-only decisions, terminal', async () => {
      const listing = await approvedAdoption(owner.token, 'Machine à états');

      const first = await request(app.getHttpServer())
        .post(`/adoptions/${listing.id}/requests`)
        .set('Authorization', `Bearer ${requester.token}`)
        .send({ message: 'Première demande.', housing: 'house', experience: true })
        .expect(201);
      expect(first.body.status).toBe('sent');

      const second = await request(app.getHttpServer())
        .post(`/adoptions/${listing.id}/requests`)
        .set('Authorization', `Bearer ${requester.token}`)
        .send({ message: 'Seconde demande.', housing: 'house', experience: true })
        .expect(409);
      expect(second.body.code).toBe('ADOPTION_REQUEST_EXISTS');

      const ownListing = await request(app.getHttpServer())
        .post(`/adoptions/${listing.id}/requests`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ message: 'La mienne.', housing: 'house', experience: true })
        .expect(403);
      expect(ownListing.body.code).toBe('ADOPTION_OWN_LISTING');

      const strangerDecides = await request(app.getHttpServer())
        .patch(`/requests/${first.body.id}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ status: 'accepted' })
        .expect(403);
      expect(strangerDecides.body.code).toBe('REQUEST_NOT_OWNER');

      const decided = await request(app.getHttpServer())
        .patch(`/requests/${first.body.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: 'accepted' })
        .expect(200);
      expect(decided.body.status).toBe('accepted');

      const twice = await request(app.getHttpServer())
        .patch(`/requests/${first.body.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: 'declined' })
        .expect(409);
      expect(twice.body.code).toBe('REQUEST_ALREADY_ANSWERED');
    });

    it('keeps /me views consistent: my adoptions, my requests, my requests received', async () => {
      const mine = await request(app.getHttpServer())
        .get('/me/adoptions?pageSize=100')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(mine.body.total).toBeGreaterThan(0);
      for (const item of mine.body.items) expect(item.ownerId).toBe(owner.id);

      const received = await request(app.getHttpServer())
        .get('/me/requests/received?pageSize=100')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(received.body.total).toBeGreaterThan(0);
      // the owner's view carries the requester's contact route — but never a phone
      for (const item of received.body.items) {
        expect(item.from).toMatchObject({ id: expect.any(String), name: expect.any(String) });
        expect('phone' in item.from).toBe(false);
        expect('ownerPhone' in item).toBe(false);
      }
    });
  });
});

/** A closed unit square in Algeria, `deg` degrees wide, centered on (lng, lat). */
function square(lng: number, lat: number) {
  const d = 0.05;
  return {
    type: 'Polygon' as const,
    coordinates: [
      [
        [lng, lat],
        [lng + d, lat],
        [lng + d, lat + d],
        [lng, lat + d],
        [lng, lat],
      ],
    ],
  };
}
