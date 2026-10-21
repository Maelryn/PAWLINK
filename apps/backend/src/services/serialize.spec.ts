import { describe, expect, it } from '@jest/globals';
import type { ServiceRowWithOwner } from './serialize';
import { serviceRowToService } from './serialize';

/**
 * The Pro flag on a listing is **derived from the owner's subscription**, never
 * read from the `services.pro` column.
 *
 * That is the whole point: a subscription that expired an hour ago must turn
 * the listing off by itself, without a cleanup job — and the column cannot know
 * that. The serializer is the only place the wire shape is built, so this is
 * where the rule is pinned.
 */

function row(overrides: Partial<ServiceRowWithOwner> = {}): ServiceRowWithOwner {
  return {
    id: 's1',
    type: 'vet',
    name: 'Cabinet Vétérinaire',
    lat: 36.632,
    lng: 4.205,
    address: 'Tizi Ouzou',
    phone: '+213 26 00 00 07',
    openNow: true,
    rating: 4.6,
    reviewCount: 12,
    photo: null,
    tags: ['vaccins'],
    description: null,
    hours: null,
    ownerId: 'u1',
    // The stale cache says "featured" in every case below.
    pro: true,
    verified: true,
    status: 'approved',
    pendingEdit: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    owner: {
      id: 'u1',
      name: 'Cabinet Vétérinaire',
      avatar: '',
      pro: {
        plan: 'pro',
        since: '2026-09-01T00:00:00.000Z',
        until: '2999-01-01T00:00:00.000Z',
      },
    },
    ...overrides,
  } as ServiceRowWithOwner;
}

describe('the derived Pro flag', () => {
  it('features the listing while the owner’s subscription runs', () => {
    expect(serviceRowToService(row()).pro).toBe(true);
  });

  it('does not feature it once the subscription has expired — even if the column says pro', () => {
    const expired = row({
      owner: {
        id: 'u1',
        name: 'Cabinet',
        avatar: '',
        pro: { plan: 'pro', since: '2025-01-01T00:00:00.000Z', until: '2025-02-01T00:00:00.000Z' },
      },
    });
    expect(serviceRowToService(expired).pro).toBe(false);
  });

  it('does not feature a listing whose owner never subscribed', () => {
    expect(serviceRowToService(row({ owner: null })).pro).toBe(false);
  });
});

describe('the pending edit', () => {
  it('carries the owner’s proposed change on the wire', () => {
    const service = serviceRowToService(
      row({ pendingEdit: { name: 'Nouveau nom', at: '2026-10-20T10:00:00.000Z' } }),
    );
    expect(service.pendingEdit).toMatchObject({ name: 'Nouveau nom' });
  });

  it('omits the field entirely when nothing waits', () => {
    expect(serviceRowToService(row())).not.toHaveProperty('pendingEdit');
  });
});
