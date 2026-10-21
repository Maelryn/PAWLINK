import { describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MeService } from './me.service';

/**
 * `POST /me/pro` — the demo subscription.
 *
 * The three rules the endpoint promises are exactly the three things that are
 * hard to see in an integration test: a listing first, the same plan cannot be
 * bought twice, and the days left are never lost. Each one is pinned here.
 */

const DAY = 86_400_000;
const NOW = new Date('2026-10-21T12:00:00.000Z');

interface Row {
  id: string;
  name: string;
  avatar: string;
  role: string;
  email: string | null;
  passwordHash: string | null;
  phone: string | null;
  phoneVerified: boolean;
  licenseVerified: boolean;
  helpTypes: string[];
  lat: number | null;
  lng: number | null;
  address: string | null;
  rating: number | null;
  city: string | null;
  bio: string | null;
  photo: string | null;
  available: boolean | null;
  serviceId: string | null;
  pro: unknown;
  createdAt: Date;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: 'u1',
    name: 'Cabinet Vétérinaire',
    avatar: '',
    role: 'vet',
    email: 'vet@pawlink.dz',
    passwordHash: 'hash',
    phone: '+213 26 00 00 07',
    phoneVerified: true,
    licenseVerified: true,
    helpTypes: [],
    lat: null,
    lng: null,
    address: null,
    rating: null,
    city: null,
    bio: null,
    photo: null,
    available: null,
    serviceId: 's1',
    pro: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

/** A MeService wired to one account and one listing, with every write recorded. */
async function serviceFor(options: {
  user?: Partial<Row>;
  status?: 'pending' | 'approved' | 'rejected';
  noListing?: boolean;
} = {}) {
  const current = row(options.user);
  const notified: Array<{ userId: string; kind: string }> = [];

  let userRow = current;
  const users = {
    findById: jest.fn(async () => userRow),
    updateProfile: jest.fn(),
    setPhoneVerified: jest.fn(),
  };

  const serviceUpdate = jest.fn(async (_args: unknown) => ({}));
  const prisma = {
    service: {
      findUnique: jest.fn(async () =>
        options.noListing ? null : { id: 's1', status: options.status ?? 'approved' },
      ),
      update: serviceUpdate,
    },
    user: {
      update: jest.fn(async ({ data }: { data: { pro: unknown } }) => {
        userRow = { ...current, pro: data.pro };
        return userRow;
      }),
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };

  const notifications = {
    notify: jest.fn(async (userId: string, kind: string) => {
      notified.push({ userId, kind });
      return { id: 'n1', userId, kind, subject: '', href: '', read: false, createdAt: '' };
    }),
  };

  const moduleRef = await Test.createTestingModule({ providers: [MeService] })
    .useMocker((token) => {
      if (token === UsersService) return users;
      if (token === PrismaService) return prisma;
      if (token === NotificationsService) return notifications;
      return {};
    })
    .compile();

  return { service: moduleRef.get(MeService), notified, prisma, serviceUpdate, users };
}

describe('POST /me/pro — the demo subscription', () => {
  it('refuses an account without a business listing', async () => {
    const { service } = await serviceFor({ user: { serviceId: null } });
    await expect(service.activatePro('u1', { plan: 'pro', period: 'month' })).rejects.toMatchObject({
      status: 403,
      response: { code: 'PRO_NO_LISTING' },
    });
  });

  it('refuses a listing that is not approved yet', async () => {
    const { service } = await serviceFor({ status: 'pending' });
    await expect(service.activatePro('u1', { plan: 'pro', period: 'month' })).rejects.toMatchObject({
      status: 403,
      response: { code: 'PRO_LISTING_NOT_APPROVED' },
    });
  });

  it('activates the subscription and features the listing', async () => {
    const { service, notified, serviceUpdate } = await serviceFor();
    const before = Date.now();
    const result = await service.activatePro('u1', { plan: 'pro', period: 'month' });

    expect(result.demo).toBe(true);
    expect(result.free).toBe(false);
    expect(result.user.pro?.plan).toBe('pro');
    expect(new Date(result.user.pro!.until).getTime()).toBeGreaterThanOrEqual(before + 30 * DAY);
    // The listing is featured in the same transaction as the subscription.
    expect(serviceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pro: true } }),
    );
    expect(notified).toEqual([{ userId: 'u1', kind: 'proActive' }]);
  });

  it('makes the subscription free with the demo promo code', async () => {
    const { service } = await serviceFor();
    const result = await service.activatePro('u1', {
      plan: 'pro',
      period: 'year',
      promoCode: ' demodday ',
    });
    // A typo must not silently make a year free: only the exact code counts.
    expect(result.free).toBe(false);

    const exact = await service.activatePro('u1', {
      plan: 'plus',
      period: 'month',
      promoCode: ' demodday '.replace('demodday', 'DEMODAY'),
    });
    expect(exact.free).toBe(true);
  });

  it('refuses to sell the same plan twice while it runs', async () => {
    const until = new Date(Date.now() + 10 * DAY).toISOString();
    const { service } = await serviceFor({
      user: { pro: { plan: 'pro', since: NOW.toISOString(), until } },
    });

    await expect(
      service.activatePro('u1', { plan: 'pro', period: 'month' }),
    ).rejects.toMatchObject({ status: 409, response: { code: 'PRO_ALREADY_ACTIVE' } });
  });

  it('upgrades Pro → Pro+ and keeps the days left', async () => {
    const until = new Date(Date.now() + 10 * DAY).toISOString();
    const since = '2026-09-01T00:00:00.000Z';
    const { service } = await serviceFor({
      user: { pro: { plan: 'pro', since, until } },
    });

    const result = await service.activatePro('u1', { plan: 'plus', period: 'month' });

    expect(result.user.pro?.plan).toBe('plus');
    // The new month starts where the old one ended — no day is lost.
    expect(result.user.pro?.since).toBe(since);
    expect(Date.parse(result.user.pro!.until)).toBe(Date.parse(until) + 30 * DAY);
  });

  it('starts a fresh subscription when the old one has expired', async () => {
    const expired = new Date(Date.now() - 5 * DAY).toISOString();
    const { service } = await serviceFor({
      user: { pro: { plan: 'pro', since: '2026-08-01T00:00:00.000Z', until: expired } },
    });

    const result = await service.activatePro('u1', { plan: 'pro', period: 'month' });

    // The five days since expiry are not bought back.
    // 5 s of slack: the clock moves between the call and the assertion.
    expect(Date.parse(result.user.pro!.until)).toBeGreaterThanOrEqual(Date.now() + 30 * DAY - 5_000);
    expect(result.user.pro?.since).not.toBe('2026-08-01T00:00:00.000Z');
  });
});
