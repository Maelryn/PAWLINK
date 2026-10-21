import { describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../common/decorators/auth.decorators';
import type { NotificationsService } from '../notifications/notifications.service';
import { ServicesService } from './services.service';

/**
 * ServicesService with every collaborator stubbed.
 *
 * What only a unit test can pin here:
 *   - the review/booking state machines and every 409;
 *   - the **rating recompute** (AVG to one decimal + count) happening inside
 *     the same transaction as the insert;
 *   - the notification mapping table (recipient · kind · subject · href);
 *   - the list ordering: `pro DESC` ahead of distance/rating, radius only when
 *     a search point exists. The exact SQL text is proven by the e2e suite.
 */

const OWNER: AuthenticatedUser = { sub: 'u-owner', role: 'reporter', name: 'Amina' };
const CLIENT: AuthenticatedUser = { sub: 'u-client', role: 'reporter', name: 'Sofiane' };
const ADMIN: AuthenticatedUser = { sub: 'u-admin', role: 'admin', name: 'Inès' };

const SERVICE_ROW = {
  id: 's1',
  type: 'vet' as const,
  name: 'Clinique El Djazaïr',
  lat: 36.632,
  lng: 4.205,
  address: 'Tizi Ouzou',
  phone: '+213 555 00 00',
  openNow: true,
  rating: 4.6,
  reviewCount: 12,
  photo: null,
  tags: ['urgence'],
  description: 'Clinique vétérinaire 24h/24.',
  hours: '24h/24',
  ownerId: 'u-owner',
  verified: true,
  pro: true,
  status: 'approved' as const,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  owner: { id: 'u-owner', name: 'Amina', avatar: '' },
};

const BOOKING_ROW = {
  id: 'b1',
  serviceId: 's1',
  fromId: 'u-client',
  date: '2026-10-20',
  time: '14:30',
  animal: 'Rex (chien, 3 ans)',
  reason: 'Vaccination',
  status: 'sent' as const,
  createdAt: new Date('2026-10-12T00:00:00Z'),
  from: { id: 'u-client', name: 'Sofiane', avatar: '' },
  service: { ...SERVICE_ROW },
};

interface Options {
  service?: Record<string, unknown> | null;
  booking?: Record<string, unknown> | null;
  reviewCreateFails?: boolean;
  aggregates?: { avg: number; count: number };
}

function makeService(options: Options = {}) {
  const notified: Array<{ userId: string; kind: string; subject: string; href: string }> = [];
  const written: Array<{ model: string; data: Record<string, unknown> }> = [];
  const statements: string[] = [];

  const serviceRow = options.service ?? SERVICE_ROW;
  const booking = options.booking ?? BOOKING_ROW;
  const aggregates = options.aggregates ?? { avg: 4.35, count: 13 };

  const prisma = {
    service: {
      findUnique: async () => serviceRow,
      findMany: async () => [serviceRow],
      count: async () => 1,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        written.push({ model: 'service.create', data });
        return { ...serviceRow, ...data };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        written.push({ model: 'service.update', data });
        return { ...serviceRow, ...data };
      },
    },
    review: {
      findUnique: async () => null,
      findMany: async () => [],
      count: async () => 0,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (options.reviewCreateFails) {
          throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
        }
        written.push({ model: 'review.create', data });
        return {
          id: 'rev1',
          createdAt: new Date('2026-10-13T00:00:00Z'),
          reply: null,
          ...data,
          author: { id: 'u-client', name: 'Sofiane', avatar: '' },
        };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        written.push({ model: 'review.update', data });
        return { id: 'rev1', serviceId: 's1', authorId: 'u-client', rating: 5, text: 'Excellent', createdAt: new Date('2026-10-13T00:00:00Z'), ...data, author: { id: 'u-client', name: 'Sofiane', avatar: '' } };
      },
      aggregate: async () => ({ _avg: { rating: aggregates.avg }, _count: { _all: aggregates.count } }),
    },
    booking: {
      findUnique: async () => booking,
      findMany: async () => [booking],
      count: async () => 1,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        written.push({ model: 'booking.create', data });
        return { ...BOOKING_ROW, ...data };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        written.push({ model: 'booking.update', data });
        return { ...BOOKING_ROW, ...data };
      },
    },
    $queryRaw: async (query: unknown) => {
      statements.push(readSql(query));
      return [];
    },
    $transaction: async (arg: unknown): Promise<unknown> => {
      if (Array.isArray(arg)) return Promise.all(arg);
      // Interactive transaction: the stub runs the callback with the same
      // delegates, so the recompute order is observable.
      return (arg as (tx: unknown) => Promise<unknown>)(prisma);
    },
  } as unknown as PrismaService;

  const notifications = {
    notify: jest.fn(async (userId: string, kind: string, subject: string, href: string) => {
      notified.push({ userId, kind, subject, href });
      return { id: 'n1', userId, kind, subject, href, read: false, createdAt: '' };
    }),
  } as unknown as NotificationsService;

  return {
    service: new ServicesService(prisma, notifications),
    notified,
    written,
    statements,
  };
}

/** `Prisma.sql` stringifies to `[object Object]`; flatten strings+values. */
function readSql(query: unknown): string {
  const sql = query as { strings?: string[]; values?: unknown[] };
  if (!sql?.strings) return String(query);
  const values = sql.values ?? [];
  return sql.strings
    .map((part, index) => (index < values.length ? `${part}$${index + 1}` : part))
    .join('');
}

describe('reviews', () => {
  it('notifies the owner with (review · author name · /services/{id})', async () => {
    const { service, notified } = makeService();
    await service.addReview('s1', { rating: 5, text: 'Excellent' }, CLIENT);
    expect(notified).toEqual([
      { userId: 'u-owner', kind: 'review', subject: 'Sofiane', href: '/services/s1' },
    ]);
  });

  it('recomputes rating (AVG, one decimal) and reviewCount in the same transaction as the insert', async () => {
    const { service, written } = makeService({ aggregates: { avg: 4.34, count: 13 } });
    await service.addReview('s1', { rating: 4, text: 'Très bien' }, CLIENT);

    const order = written.map((w) => w.model);
    expect(order).toContain('review.create');
    expect(order).toContain('service.update');
    expect(order.indexOf('review.create')).toBeLessThan(order.indexOf('service.update'));
    // 4.34 → 4.3, count from the aggregate — never from the request body
    expect(written.find((w) => w.model === 'service.update')?.data).toEqual({
      rating: 4.3,
      reviewCount: 13,
    });
  });

  it('answers 409 REVIEW_EXISTS when the unique index fires', async () => {
    const { service } = makeService({ reviewCreateFails: true });
    await expect(
      service.addReview('s1', { rating: 5, text: 'Encore' }, CLIENT),
    ).rejects.toMatchObject({ status: 409, response: { code: 'REVIEW_EXISTS' } });
  });

  it('refuses a review on your own service with 403 REVIEW_OWNER', async () => {
    const { service, notified } = makeService();
    await expect(
      service.addReview('s1', { rating: 5, text: 'Moi-même' }, OWNER),
    ).rejects.toMatchObject({ status: 403, response: { code: 'REVIEW_OWNER' } });
    expect(notified).toEqual([]);
  });

  it('lets only the service owner reply', async () => {
    const { service } = makeService();
    await expect(service.replyReview('s1', 'rev1', 'Merci !', CLIENT)).rejects.toMatchObject({
      status: 403,
      response: { code: 'SERVICE_NOT_OWNER' },
    });
  });
});

describe('bookings', () => {
  it('notifies the owner with (booking · booker name · /account?tab=pro)', async () => {
    const { service, notified } = makeService();
    await service.book(
      's1',
      { date: '2026-10-20', time: '14:30', animal: 'Rex', reason: 'Vaccination' },
      CLIENT,
    );
    expect(notified).toEqual([
      { userId: 'u-owner', kind: 'booking', subject: 'Sofiane', href: '/account?tab=pro' },
    ]);
  });

  it('creates bookings as sent — the status never comes from the body', async () => {
    const { service, written } = makeService();
    await service.book(
      's1',
      { date: '2026-10-20', time: '14:30', animal: 'Rex', reason: 'Vaccination' },
      CLIENT,
    );
    expect(written.find((w) => w.model === 'booking.create')?.data).toMatchObject({ status: 'sent' });
  });

  it('confirms: notifies (bookingConfirmed · service name · /services/{id})', async () => {
    const { service, notified } = makeService();
    const wire = await service.decideBooking('b1', { status: 'confirmed' }, OWNER);
    expect(wire.status).toBe('confirmed');
    expect(notified).toEqual([
      { userId: 'u-client', kind: 'bookingConfirmed', subject: 'Clinique El Djazaïr', href: '/services/s1' },
    ]);
  });

  it('declines: notifies bookingDeclined — same subject and href', async () => {
    const { service, notified } = makeService();
    await service.decideBooking('b1', { status: 'declined' }, OWNER);
    expect(notified[0]).toEqual({
      userId: 'u-client',
      kind: 'bookingDeclined',
      subject: 'Clinique El Djazaïr',
      href: '/services/s1',
    });
  });

  it('refuses a decision from anyone but the service owner', async () => {
    const { service, notified } = makeService();
    await expect(service.decideBooking('b1', { status: 'confirmed' }, CLIENT)).rejects.toMatchObject({
      status: 403,
      response: { code: 'BOOKING_NOT_OWNER' },
    });
    expect(notified).toEqual([]);
  });

  it('is terminal: a decided booking answers 409 BOOKING_ALREADY_ANSWERED', async () => {
    const { service } = makeService({
      booking: { ...BOOKING_ROW, status: 'confirmed' },
    });
    await expect(service.decideBooking('b1', { status: 'declined' }, OWNER)).rejects.toMatchObject({
      status: 409,
      response: { code: 'BOOKING_ALREADY_ANSWERED' },
    });
  });
});

describe('the directory query', () => {
  it('orders the featured (Pro) listings first, then distance, and filters by radius when a point is given', async () => {
    const { service, statements } = makeService();
    await service.list({ lat: 36.632, lng: 4.205, radiusKm: 25 });
    const sql = statements[0] ?? '';
    expect(sql).toContain('ST_DWithin');
    // The flag is derived from the owner's subscription, not from the stale column.
    expect(sql).toContain("u.pro->>'until'::timestamptz > now()");
    expect(sql).toContain('km ASC');
  });

  it('orders by rating, with no radius, when no search point is given', async () => {
    const { service, statements } = makeService();
    await service.list({});
    const sql = statements[0] ?? '';
    expect(sql).not.toContain('ST_DWithin');
    expect(sql).toContain("u.pro->>'until'::timestamptz > now()");
    expect(sql).toContain('rating DESC');
  });

  it('parameterizes the search term — never interpolates it', async () => {
    const { service, statements } = makeService();
    await service.list({ q: "'; DROP TABLE services; --" });
    const sql = statements[0] ?? '';
    expect(sql).toContain('ILIKE');
    expect(sql).not.toContain('DROP TABLE');
  });

  it('hides pending listings from a stranger but shows the caller their own', async () => {
    const { service, statements } = makeService();
    await service.list({}, CLIENT);
    expect(statements[0]).toContain('ownerId');
    await service.list({}, ADMIN);
    // no visibility gate for an admin
    expect(statements[1] ?? '').not.toContain('approved');
  });
});
