import type {
  Booking as BookingRow,
  Review as ReviewRow,
  Service as ServiceRow,
  User as UserRow,
} from '@prisma/client';
import type { Booking, Review, Service, ServiceEdit, UserLite } from '../shared/types';
import { isProActive, readProSubscription } from '../shared/pro';

/**
 * The ONLY place a `services`/`reviews`/`bookings` row becomes the frontend
 * wire shape (`apps/web/lib/types.ts`).
 */

export type ServiceRowWithOwner = ServiceRow & {
  owner: (Pick<UserRow, 'id' | 'name' | 'avatar'> & { pro: UserRow['pro'] }) | null;
};

function toLite(user: Pick<UserRow, 'id' | 'name' | 'avatar'>): UserLite {
  return { id: user.id, name: user.name, avatar: user.avatar };
}

/** `distanceKm` is attached by the geo list query (rounded to 0.1 km, as cases). */
export type ServiceWithDistance = Service & { distanceKm?: number };

export function serviceRowToService(row: ServiceRowWithOwner, distanceKm?: number): ServiceWithDistance {
  // The listing is featured while its owner's Pro subscription runs — derived
  // here, so an expired subscription turns the flag off by itself.
  const pro = isProActive(readProSubscription(row.owner?.pro));

  return {
    id: row.id,
    type: row.type,
    name: row.name,
    location: { lat: row.lat, lng: row.lng, ...(row.address ? { address: row.address } : {}) },
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.openNow !== null && row.openNow !== undefined ? { openNow: row.openNow } : {}),
    rating: row.rating,
    reviewCount: row.reviewCount,
    ...(row.photo ? { photo: row.photo } : {}),
    tags: [...row.tags],
    ...(row.description ? { description: row.description } : {}),
    ...(row.hours ? { hours: row.hours } : {}),
    ...(row.ownerId ? { ownerId: row.ownerId } : {}),
    verified: row.verified,
    pro,
    status: row.status,
    // The owner's proposed change: public only once a moderator approves it.
    ...(row.pendingEdit ? { pendingEdit: row.pendingEdit as unknown as ServiceEdit } : {}),
    ...(distanceKm !== undefined ? { distanceKm } : {}),
  };
}

export function reviewRowToWire(row: ReviewRow & { author: Pick<UserRow, 'id' | 'name' | 'avatar'> }): Review {
  return {
    id: row.id,
    serviceId: row.serviceId,
    author: toLite(row.author),
    rating: row.rating as Review['rating'],
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    ...(row.reply ? { reply: row.reply } : {}),
  };
}

export function bookingRowToWire(row: BookingRow & { from: Pick<UserRow, 'id' | 'name' | 'avatar'> }): Booking {
  return {
    id: row.id,
    serviceId: row.serviceId,
    from: toLite(row.from),
    date: row.date,
    time: row.time,
    animal: row.animal,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
