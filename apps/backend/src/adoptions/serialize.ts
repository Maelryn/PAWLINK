import type {
  Adoption as AdoptionRow,
  AdoptionRequest as AdoptionRequestRow,
  Service as ServiceRow,
  User as UserRow,
} from '@prisma/client';
import type { AdoptionProfile, AdoptionRequest, AdoptionEdit, UserLite } from '../shared/types';
import type { Viewer } from '../shared/pagination';

/**
 * The ONLY place an `adoptions` row becomes the frontend `AdoptionProfile`
 * (`apps/web/lib/types.ts`), and an `adoption_requests` row an
 * `AdoptionRequest`.
 */

/** What the row must carry for the mapper to work. */
export type AdoptionRowWithRelations = AdoptionRow & {
  owner: Pick<UserRow, 'id' | 'name' | 'phone'>;
  shelter: Pick<ServiceRow, 'id' | 'name'> | null;
};

/** The subsets of an `AdoptionRequest` row plus its author, in wire shape. */
export type RequestRowWithAuthor = AdoptionRequestRow & {
  from: Pick<UserRow, 'id' | 'name' | 'avatar'>;
};

function toLite(user: Pick<UserRow, 'id' | 'name' | 'avatar'>): UserLite {
  return { id: user.id, name: user.name, avatar: user.avatar };
}

/**
 * The phone-reveal rule (docs/BACKEND_PROMPT.md §3.6), enforced HERE rather
 * than in a controller so every read path applies it identically:
 *
 * `ownerPhone` is present **iff** the viewer is the listing owner, an admin, or
 * holds an **accepted** request on this listing. Everyone else — including the
 * anonymous visitor and a pending requester — gets the field omitted.
 */
export function phoneVisibleTo(
  row: Pick<AdoptionRow, 'id' | 'ownerId'>,
  viewer: Viewer | undefined,
  acceptedAdoptionIds: ReadonlySet<string>,
): boolean {
  if (!viewer) return false;
  if (viewer.sub === row.ownerId) return true;
  if (viewer.role === 'admin') return true;
  return acceptedAdoptionIds.has(row.id);
}

export function adoptionRowToProfile(
  row: AdoptionRowWithRelations,
  viewer?: Viewer,
  acceptedAdoptionIds: ReadonlySet<string> = new Set(),
): AdoptionProfile {
  const showPhone = phoneVisibleTo(row, viewer, acceptedAdoptionIds);
  // A null `ownerPhone` (the owner never confirmed a number) omits the field,
  // exactly like a viewer who may not see it.
  const ownerPhone = showPhone ? (row.ownerPhone ?? undefined) : undefined;

  return {
    id: row.id,
    name: row.name,
    species: row.species,
    ...(row.breed ? { breed: row.breed } : {}),
    sex: row.sex,
    ageMonths: row.ageMonths,
    photos: [...row.photos],
    healthStatus: row.healthStatus,
    vaccinations: row.vaccinations as AdoptionProfile['vaccinations'],
    medicalHistory: row.medicalHistory as AdoptionProfile['medicalHistory'],
    behavior: [...row.behavior],
    careNeeds: [...row.careNeeds],
    story: row.story,
    // `shelter` is the linked Service listing; a personal listing answers with
    // the owner themself so the shape never needs a null check on the client.
    shelter: row.shelter
      ? { id: row.shelter.id, name: row.shelter.name }
      : { id: row.owner.id, name: row.owner.name },
    ownerId: row.ownerId,
    ...(ownerPhone ? { ownerPhone } : {}),
    location: { lat: row.lat, lng: row.lng, ...(row.address ? { address: row.address } : {}) },
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    // The owner's proposed change: public only once a moderator approves it.
    ...(row.pendingEdit ? { pendingEdit: row.pendingEdit as unknown as AdoptionEdit } : {}),
  };
}

export function requestRowToWire(row: RequestRowWithAuthor): AdoptionRequest {
  return {
    id: row.id,
    adoptionId: row.adoptionId,
    from: toLite(row.from),
    message: row.message,
    housing: row.housing,
    experience: row.experience,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
