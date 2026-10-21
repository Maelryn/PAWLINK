import { describe, expect, it } from '@jest/globals';
import type { Adoption as AdoptionRow, Service as ServiceRow, User as UserRow } from '@prisma/client';
import { adoptionRowToProfile, phoneVisibleTo, requestRowToWire } from './serialize';
import type { Viewer } from '../shared/pagination';

/**
 * The phone-reveal matrix (docs/BACKEND_PROMPT.md §3.6) — the headline rule of
 * Phase 3, pinned where it is enforced: the serializer. A controller that
 * forgets a filter cannot leak `ownerPhone`, because the decision lives here
 * and every response path goes through it.
 */

const OWNER: Viewer = { sub: 'u-owner', role: 'reporter' };
const ADMIN: Viewer = { sub: 'u-admin', role: 'admin' };
const ACCEPTED: Viewer = { sub: 'u-accepted', role: 'reporter' };
const PENDING: Viewer = { sub: 'u-pending', role: 'reporter' };
const STRANGER: Viewer = { sub: 'u-stranger', role: 'reporter' };

const LISTING = { id: 'a1', ownerId: 'u-owner' };
const ACCEPTED_SET = new Set(['a1']);

function row(
  overrides: Partial<AdoptionRow> & {
    owner?: Pick<UserRow, 'id' | 'name' | 'phone'>;
    shelter?: Pick<ServiceRow, 'id' | 'name'> | null;
  } = {},
) {
  return {
    id: 'a1',
    name: 'Rex',
    species: 'dog' as const,
    breed: null,
    sex: 'male' as const,
    ageMonths: 14,
    photos: ['https://res.cloudinary.com/demo/rex.jpg'],
    healthStatus: 'Bon état général',
    vaccinations: [{ name: 'Rage', date: '2026-01-12' }],
    medicalHistory: [],
    behavior: ['calm'],
    careNeeds: ['jardin'],
    story: 'Trouvé sur la route de Blida.',
    shelterId: null,
    ownerId: 'u-owner',
    ownerPhone: '+213 555 01 02 03',
    lat: 36.632,
    lng: 4.205,
    address: 'Tizi Ouzou',
    status: 'approved' as const,
    createdAt: new Date('2026-10-10T10:00:00Z'),
    updatedAt: new Date('2026-10-10T10:00:00Z'),
    owner: { id: 'u-owner', name: 'Amina', phone: '+213 555 01 02 03' },
    shelter: null,
    ...overrides,
  } satisfies AdoptionRow & {
    owner: Pick<UserRow, 'id' | 'name' | 'phone'>;
    shelter: Pick<ServiceRow, 'id' | 'name'> | null;
  };
}

describe('the phone-reveal matrix', () => {
  it('shows the phone to the listing owner', () => {
    expect(phoneVisibleTo(LISTING, OWNER, new Set())).toBe(true);
  });

  it('shows the phone to an admin', () => {
    expect(phoneVisibleTo(LISTING, ADMIN, new Set())).toBe(true);
  });

  it('shows the phone to a requester whose request was accepted', () => {
    expect(phoneVisibleTo(LISTING, ACCEPTED, ACCEPTED_SET)).toBe(true);
  });

  it('hides the phone from a requester still waiting (pending)', () => {
    expect(phoneVisibleTo(LISTING, PENDING, new Set())).toBe(false);
  });

  it('hides the phone from any other signed-in user', () => {
    expect(phoneVisibleTo(LISTING, STRANGER, new Set())).toBe(false);
  });

  it('hides the phone from an anonymous visitor', () => {
    expect(phoneVisibleTo(LISTING, undefined, new Set())).toBe(false);
  });

  it('omits ownerPhone (never null) when the viewer may not see it', () => {
    const profile = adoptionRowToProfile(row(), STRANGER, new Set());
    expect('ownerPhone' in profile).toBe(false);
    expect(JSON.stringify(profile)).not.toContain('555');
  });

  it('omits ownerPhone when the owner never confirmed a number', () => {
    const profile = adoptionRowToProfile(row({ ownerPhone: null }), OWNER, new Set());
    expect('ownerPhone' in profile).toBe(false);
  });

  it('never puts a phone on an AdoptionRequest, whatever the viewer is', () => {
    const wire = requestRowToWire({
      id: 'r1',
      adoptionId: 'a1',
      fromId: 'u-accepted',
      message: 'Je peux adopter Rex.',
      housing: 'house' as const,
      experience: true,
      status: 'sent' as const,
      createdAt: new Date('2026-10-10T10:00:00Z'),
      from: { id: 'u-accepted', name: 'Sofiane', avatar: '' },
    });
    expect('phone' in wire).toBe(false);
    expect('ownerPhone' in wire).toBe(false);
    expect(JSON.stringify(wire)).not.toContain('555');
  });
});

describe('adoptionRowToProfile', () => {
  it('falls back to the owner as shelter for a personal listing', () => {
    const profile = adoptionRowToProfile(row(), STRANGER, new Set());
    expect(profile.shelter).toEqual({ id: 'u-owner', name: 'Amina' });
  });

  it('joins the shelter Service when one is linked', () => {
    const profile = adoptionRowToProfile(
      row({ shelterId: 's6', shelter: { id: 's6', name: 'Refuge de Kabylie' } }),
      STRANGER,
      new Set(),
    );
    expect(profile.shelter).toEqual({ id: 's6', name: 'Refuge de Kabylie' });
  });

  it('serializes dates as ISO strings and keeps the wire field set', () => {
    const profile = adoptionRowToProfile(row(), OWNER, new Set());
    expect(profile.createdAt).toBe('2026-10-10T10:00:00.000Z');
    expect(profile.location).toEqual({ lat: 36.632, lng: 4.205, address: 'Tizi Ouzou' });
    expect(profile.ownerPhone).toBe('+213 555 01 02 03');
  });
});
