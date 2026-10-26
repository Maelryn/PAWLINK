import type { Prisma, User as UserRow } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { userRowToUser, userRowToUserLite } from './serialize';

/** A complete, realistic row — the shape Prisma hands back for `user.findUnique`. */
function makeRow(overrides: Partial<UserRow> = {}): UserRow {
  const now = new Date('2026-10-03T10:00:00.000Z');
  return {
    id: 'u1',
    name: 'Yasmine Belkacem',
    avatar: '',
    role: 'reporter',
    email: 'yasmine@pawlink.dz',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$YWJjZGVmZ2hpamtsbW5vcA',
    phone: '+213 26 00 00 01',
    phoneVerified: true,
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

describe('userRowToUser', () => {
  it('never leaks the password hash', () => {
    const user = userRowToUser(makeRow());
    expect(JSON.stringify(user)).not.toMatch(/argon2|passwordHash|hash/i);
    expect(Object.keys(user)).not.toContain('passwordHash');
  });

  it('omits optional fields instead of sending null', () => {
    const user = userRowToUser(makeRow());
    expect(user.city).toBeUndefined();
    expect(user.bio).toBeUndefined();
    expect(user.photo).toBeUndefined();
    expect(user.available).toBeUndefined();
    expect(user.serviceId).toBeUndefined();
    expect(user.pro).toBeUndefined();
    expect(user.location).toBeUndefined();
    // JSON.stringify drops undefined keys, so the wire shape has no nulls either.
    expect(JSON.stringify(user)).not.toMatch(/null/);
  });

  it('keeps a populated profile intact', () => {
    const user = userRowToUser(
      makeRow({
        role: 'vet',
        licenseVerified: true,
        helpTypes: ['medical'],
        rating: 4.9,
        city: 'Larbaâ Nath Irathen',
        bio: 'Vétérinaire',
        photo: 'https://example.test/p.jpg',
        available: true,
        availability: 'usually',
        serviceId: 's2',
      }),
    );
    expect(user).toMatchObject({
      id: 'u1',
      name: 'Yasmine Belkacem',
      role: 'vet',
      licenseVerified: true,
      helpTypes: ['medical'],
      rating: 4.9,
      city: 'Larbaâ Nath Irathen',
      available: true,
      availability: 'usually',
      serviceId: 's2',
      phoneVerified: true,
    });
  });

  it('omits availability when the row has none (old accounts)', () => {
    expect(userRowToUser(makeRow({ availability: null })).availability).toBeUndefined();
    expect(userRowToUser(makeRow({ availability: 'away' })).availability).toBe('away');
  });

  it('serializes createdAt as an ISO 8601 UTC string', () => {
    const user = userRowToUser(makeRow());
    expect(user.createdAt).toBe('2026-10-03T10:00:00.000Z');
    expect(new Date(user.createdAt as string).toISOString()).toBe('2026-10-03T10:00:00.000Z');
  });

  it('builds location only when both coordinates exist', () => {
    expect(userRowToUser(makeRow({ lat: 36.75, lng: 3.05 })).location).toEqual({
      lat: 36.75,
      lng: 3.05,
      address: undefined,
    });
    // half a coordinate is a bug, not a location
    expect(userRowToUser(makeRow({ lat: 36.75, lng: null })).location).toBeUndefined();
  });

  it('reshapes a valid pro subscription', () => {
    const pro: Prisma.JsonValue = { plan: 'pro', since: '2026-09-01T00:00:00.000Z', until: '2026-12-01T00:00:00.000Z' };
    expect(userRowToUser(makeRow({ pro })).pro).toEqual({
      plan: 'pro',
      since: '2026-09-01T00:00:00.000Z',
      until: '2026-12-01T00:00:00.000Z',
    });
  });

  it('drops a malformed pro payload instead of passing it through', () => {
    expect(userRowToUser(makeRow({ pro: { plan: 'free' } as unknown as Prisma.JsonValue })).pro).toBeUndefined();
    expect(userRowToUser(makeRow({ pro: [] as unknown as Prisma.JsonValue })).pro).toBeUndefined();
    expect(userRowToUser(makeRow({ pro: null })).pro).toBeUndefined();
  });

  it('falls back to reporter for an unknown role string', () => {
    expect(userRowToUser(makeRow({ role: 'superuser' as UserRow['role'] })).role).toBe('reporter');
  });

  it('filters out unknown help types', () => {
    const user = userRowToUser(makeRow({ helpTypes: ['medical', 'levitation'] as UserRow['helpTypes'] }));
    expect(user.helpTypes).toEqual(['medical']);
  });
});

describe('userRowToUserLite', () => {
  it('carries only id, name and avatar', () => {
    expect(userRowToUserLite({ id: 'u7', name: 'Nour Benali', avatar: '' })).toEqual({
      id: 'u7',
      name: 'Nour Benali',
      avatar: '',
    });
  });
});
