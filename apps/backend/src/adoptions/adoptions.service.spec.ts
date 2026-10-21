import { describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../common/decorators/auth.decorators';
import type { UploadsService } from '../uploads/uploads.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { ExifService } from '../uploads/exif.service';
import { AdoptionsService } from './adoptions.service';

/**
 * AdoptionsService with every collaborator stubbed.
 *
 * What only a unit test can pin here:
 *   - the state machines (`sent → accepted|declined`, terminal) and every 409;
 *   - the **notification mapping table** from docs/PHASE3_PROMPT.md §4.8 —
 *     recipient · kind · subject · href — asserted field by field, because a
 *     wrong `href` is a broken in-app link nobody notices until a user taps it;
 *   - the photo gate: ≤ 3 photos, camera EXIF required, no reused photo.
 */

const OWNER: AuthenticatedUser = { sub: 'u-owner', role: 'reporter', name: 'Amina' };
const REQUESTER: AuthenticatedUser = { sub: 'u-requester', role: 'reporter', name: 'Sofiane' };

const CAMERA_PROBE = {
  probeId: 'p1',
  exif: { camera: 'PawLink FixtureCam', takenAt: new Date('2026-10-13T08:00:00Z') },
  dHash: 'abcdef0123456789',
};

interface Options {
  adoption?: Record<string, unknown> | null;
  request?: Record<string, unknown> | null;
  ownerRow?: Record<string, unknown> | null;
  probes?: Array<{ probeId: string; exif: Record<string, unknown>; dHash: string | null }>;
  duplicateHash?: boolean;
  requestCreateFails?: boolean;
}

function makeService(options: Options = {}) {
  const notified: Array<{ userId: string; kind: string; subject: string; href: string }> = [];
  const written: Array<{ model: string; data: Record<string, unknown> }> = [];

  const adoption = options.adoption ?? {
    id: 'a1',
    name: 'Rex',
    species: 'dog',
    breed: null,
    sex: 'male',
    ageMonths: 14,
    photos: [],
    healthStatus: 'Bon état général',
    vaccinations: [],
    medicalHistory: [],
    behavior: ['calm'],
    careNeeds: ['jardin'],
    story: 'Trouvé sur la route de Blida.',
    shelterId: null,
    ownerId: 'u-owner',
    status: 'approved',
    ownerPhone: '+213 555 01 02 03',
    lat: 36.632,
    lng: 4.205,
    address: 'Tizi Ouzou',
    createdAt: new Date('2026-10-10T10:00:00Z'),
    updatedAt: new Date('2026-10-10T10:00:00Z'),
    owner: { id: 'u-owner', name: 'Amina', phone: '+213 555 01 02 03' },
    shelter: null,
  };
  const request = options.request ?? {
    id: 'r1',
    adoptionId: 'a1',
    fromId: 'u-requester',
    status: 'sent',
    message: 'Je peux adopter Rex.',
    housing: 'house',
    experience: true,
    createdAt: new Date('2026-10-11T09:00:00Z'),
    from: { id: 'u-requester', name: 'Sofiane', avatar: '' },
    adoption: { ...adoption, status: 'approved' },
  };

  const prisma = {
    adoption: {
      findUnique: async () => adoption,
      findMany: async () => [adoption],
      count: async () => 1,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        written.push({ model: 'adoption.create', data });
        return { ...adoption, ...data };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        written.push({ model: 'adoption.update', data });
        return { ...adoption, ...data };
      },
    },
    adoptionRequest: {
      findUnique: async () => request,
      findMany: async () => [request],
      count: async () => 1,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (options.requestCreateFails) {
          throw new Prisma.PrismaClientKnownRequestError('unique', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        written.push({ model: 'adoptionRequest.create', data });
        return { ...request, ...data };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        written.push({ model: 'adoptionRequest.update', data });
        return { ...request, ...data };
      },
    },
    user: { findUnique: async () => options.ownerRow ?? adoption.owner },
    service: { findUnique: async () => null },
    photoHash: { createMany: async ({ data }: { data: unknown[] }) => ({ count: data.length }) },
    $queryRaw: async () => (options.duplicateHash ? [{ found: 1 }] : []),
    $transaction: async <T>(arg: T | Promise<T>[]): Promise<unknown> =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as Promise<unknown>),
  } as unknown as PrismaService;

  const uploads = {
    consume: async () => options.probes ?? [CAMERA_PROBE],
  } as unknown as UploadsService;

  const notifications = {
    notify: jest.fn(async (userId: string, kind: string, subject: string, href: string) => {
      notified.push({ userId, kind, subject, href });
      return { id: 'n1', userId, kind, subject, href, read: false, createdAt: '' };
    }),
  } as unknown as NotificationsService;

  const service = new AdoptionsService(prisma, uploads, new ExifService(), notifications);
  return { service, notified, written };
}

describe('the adoption request state machine', () => {
  it('notifies the listing owner with (adoptRequest · requester name · /account?tab=requests)', async () => {
    const { service, notified } = makeService();
    await service.createRequest('a1', { message: 'Bonjour', housing: 'house', experience: true }, REQUESTER);
    expect(notified).toEqual([
      { userId: 'u-owner', kind: 'adoptRequest', subject: 'Sofiane', href: '/account?tab=requests' },
    ]);
  });

  it('answers 409 ADOPTION_REQUEST_EXISTS on a second request (unique index, mapped)', async () => {
    const { service } = makeService({ requestCreateFails: true });
    await expect(
      service.createRequest('a1', { message: 'Encore', housing: 'house', experience: false }, REQUESTER),
    ).rejects.toMatchObject({ status: 409, response: { code: 'ADOPTION_REQUEST_EXISTS' } });
  });

  it('refuses a request on a listing that is not approved, as a 404', async () => {
    const { service } = makeService({
      adoption: {
        id: 'a1',
        name: 'Rex',
        ownerId: 'u-owner',
        status: 'pending',
        owner: { id: 'u-owner', name: 'Amina', phone: null },
        shelter: null,
      },
    });
    await expect(
      service.createRequest('a1', { message: 'x', housing: 'house', experience: false }, REQUESTER),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a decision from anyone but the listing owner', async () => {
    const { service, notified } = makeService();
    await expect(
      service.decideRequest('r1', { status: 'accepted' }, REQUESTER),
    ).rejects.toMatchObject({ status: 403, response: { code: 'REQUEST_NOT_OWNER' } });
    expect(notified).toEqual([]);
  });

  it('is terminal: a decided request answers 409 REQUEST_ALREADY_ANSWERED', async () => {
    const { service } = makeService({
      request: {
        id: 'r1',
        adoptionId: 'a1',
        fromId: 'u-requester',
        status: 'accepted',
        createdAt: new Date(),
        from: { id: 'u-requester', name: 'Sofiane', avatar: '' },
        adoption: { id: 'a1', name: 'Rex', ownerId: 'u-owner', status: 'approved', owner: { id: 'u-owner', name: 'Amina', phone: null }, shelter: null },
      },
    });
    await expect(
      service.decideRequest('r1', { status: 'declined' }, OWNER),
    ).rejects.toMatchObject({ status: 409, response: { code: 'REQUEST_ALREADY_ANSWERED' } });
  });

  it('notifies the requester with (adoptAccepted · animal name · /adopt/{id})', async () => {
    const { service, notified } = makeService();
    const wire = await service.decideRequest('r1', { status: 'accepted' }, OWNER);
    expect(wire.status).toBe('accepted');
    expect(notified).toEqual([
      { userId: 'u-requester', kind: 'adoptAccepted', subject: 'Rex', href: '/adopt/a1' },
    ]);
  });

  it('notifies adoptDeclined on a decline — same subject and href', async () => {
    const { service, notified } = makeService();
    await service.decideRequest('r1', { status: 'declined' }, OWNER);
    expect(notified[0]).toEqual({
      userId: 'u-requester',
      kind: 'adoptDeclined',
      subject: 'Rex',
      href: '/adopt/a1',
    });
  });
});

describe('the adoption photo gate', () => {
  const baseDto = {
    name: 'Rex',
    species: 'dog' as const,
    sex: 'male' as const,
    ageMonths: 14,
    photos: ['https://res.cloudinary.com/demo/a.jpg'],
    probeIds: ['p1'],
    healthStatus: 'Bon état',
    story: 'Histoire.',
    location: { lat: 36.6, lng: 4.2 },
  };

  it('refuses more than 3 photos with 413 ADOPTION_TOO_MANY_PHOTOS', async () => {
    const { service } = makeService();
    await expect(
      service.create(
        { ...baseDto, photos: ['a', 'b', 'c', 'd'].map((x) => `https://x/${x}.jpg`), probeIds: ['1', '2', '3', '4'] },
        OWNER,
      ),
    ).rejects.toMatchObject({ status: 413, response: { code: 'ADOPTION_TOO_MANY_PHOTOS' } });
  });

  it('refuses a photo without camera identity with 400 ADOPTION_PHOTO_NO_EXIF', async () => {
    const { service } = makeService({
      probes: [{ probeId: 'p1', exif: { takenAt: new Date() }, dHash: 'abcdef0123456789' }],
    });
    await expect(service.create(baseDto, OWNER)).rejects.toMatchObject({
      status: 400,
      response: { code: 'ADOPTION_PHOTO_NO_EXIF' },
    });
  });

  it('refuses a photo already used on PawLink with 409 ADOPTION_PHOTO_DUPLICATE', async () => {
    const { service } = makeService({ duplicateHash: true });
    await expect(service.create(baseDto, OWNER)).rejects.toMatchObject({
      status: 409,
      response: { code: 'ADOPTION_PHOTO_DUPLICATE' },
    });
  });

  it('refuses mismatched photos/probeIds before touching the probes', async () => {
    const { service } = makeService();
    await expect(service.create({ ...baseDto, probeIds: [] }, OWNER)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('creates pending with the owner phone from their row — never from the body', async () => {
    const { service, written } = makeService();
    const profile = await service.create(baseDto, OWNER);
    const create = written.find((w) => w.model === 'adoption.create');
    expect(create?.data).toMatchObject({
      ownerId: 'u-owner',
      status: 'pending',
      ownerPhone: '+213 555 01 02 03',
    });
    expect(profile.status).toBe('pending');
    expect(profile.ownerPhone).toBe('+213 555 01 02 03'); // the owner sees their own
  });
});

describe('the admin decision', () => {
  it('approve notifies (listingApproved · animal name · /adopt/{id})', async () => {
    const { service, notified } = makeService();
    await service.moderate('a1', { status: 'approved' });
    expect(notified).toEqual([
      { userId: 'u-owner', kind: 'listingApproved', subject: 'Rex', href: '/adopt/a1' },
    ]);
  });

  it('reject notifies listingRejected — same recipient, subject and href', async () => {
    const { service, notified } = makeService();
    await service.moderate('a1', { status: 'rejected' });
    expect(notified[0]).toEqual({
      userId: 'u-owner',
      kind: 'listingRejected',
      subject: 'Rex',
      href: '/adopt/a1',
    });
  });
});
