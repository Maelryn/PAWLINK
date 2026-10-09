import type { HelpType, Role, User as UserRow } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { GeoPoint, User, UserLite } from '../shared/types';

/**
 * The ONLY place a database row becomes the frontend `User` shape
 * (`apps/web/lib/types.ts`). Every response that carries a user goes through
 * here, so the typed client the frontend generates from Swagger can never drift
 * from the contract (docs/BACKEND_PROMPT.md §3.1).
 *
 * Rules enforced by construction:
 *   - `passwordHash` is never read, so it can never leak.
 *   - optional fields are `undefined` (omitted by JSON.stringify), never `null`.
 *   - dates are ISO 8601 UTC strings.
 *   - `pro` is validated Json, reshaped, never passed through raw.
 */

const HELP_TYPES: readonly string[] = [
  'transport',
  'foster',
  'food',
  'medical',
  'search',
  'boarding',
  'funds',
];

const ROLES: readonly string[] = ['reporter', 'volunteer', 'vet', 'admin'];

function isHelpType(value: unknown): value is HelpType {
  return typeof value === 'string' && HELP_TYPES.includes(value);
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.includes(value);
}

interface ProShape {
  plan: 'pro';
  since: string;
  until: string;
}

/** `pro` is a Json column: validate the shape before handing it to the client. */
function readPro(value: Prisma.JsonValue | null): ProShape | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  if (row.plan !== 'pro') return undefined;
  if (typeof row.since !== 'string' || typeof row.until !== 'string') return undefined;
  return { plan: 'pro', since: row.since, until: row.until };
}

/** Row → `User`. `passwordHash` is deliberately not part of the input surface. */
export function userRowToUser(u: UserRow): User {
  const location: GeoPoint | undefined =
    u.lat != null && u.lng != null
      ? { lat: u.lat, lng: u.lng, address: u.address ?? undefined }
      : undefined;

  return {
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    role: isRole(u.role) ? u.role : 'reporter',
    email: u.email ?? undefined,
    phone: u.phone ?? undefined,
    phoneVerified: u.phoneVerified,
    licenseVerified: u.licenseVerified,
    // Filtered defensively: raw SQL can hand back a plain string[] for this column.
    helpTypes: u.helpTypes.filter(isHelpType),
    location,
    rating: u.rating ?? undefined,
    city: u.city ?? undefined,
    bio: u.bio ?? undefined,
    photo: u.photo ?? undefined,
    available: u.available ?? undefined,
    serviceId: u.serviceId ?? undefined,
    pro: readPro(u.pro),
    createdAt: u.createdAt.toISOString(),
  };
}

/** Row → `UserLite` (embedded reporter/author/helper objects). */
export function userRowToUserLite(u: Pick<UserRow, 'id' | 'name' | 'avatar'>): UserLite {
  return { id: u.id, name: u.name, avatar: u.avatar };
}
