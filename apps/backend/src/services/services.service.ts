import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/filters/http-exception.filter';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../common/decorators/auth.decorators';
import type { Viewer, Paginated } from '../shared/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import {
  bookingRowToWire,
  reviewRowToWire,
  serviceRowToService,
  type ServiceWithDistance,
} from './serialize';
import type {
  CreateBookingDto,
  CreateReviewDto,
  CreateServiceDto,
  DecideBookingDto,
  ModerateServiceDto,
  UpdateServiceDto,
} from './dto/service.dto';
import { DEFAULT_RADIUS_KM, type QueryServicesDto } from './dto/query-services.dto';
import type { Booking, Review, Service, ServiceEdit, PendingEdit } from '../shared/types';
import { pendingEditAt, pendingEditFields } from '../shared/pending-edit';

/** The rows every read needs, in one shape. */
const SERVICE_INCLUDE = {
  // `pro` comes along because the listing is featured while the owner's
  // subscription runs — the flag is derived from it on every read.
  owner: { select: { id: true, name: true, avatar: true, pro: true } },
} satisfies Prisma.ServiceInclude;

const REVIEW_INCLUDE = {
  author: { select: { id: true, name: true, avatar: true } },
} satisfies Prisma.ReviewInclude;

const BOOKING_INCLUDE = {
  from: { select: { id: true, name: true, avatar: true } },
} satisfies Prisma.BookingInclude;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Services — the directory, reviews, bookings.
 *
 * The ordering rule that shapes the list: **Pro listings sort first**, then by
 * distance (with a search point) or rating (without). Ratings are only ever
 * recomputed here, from the reviews table — a client cannot post a rating onto
 * a service directly, and the average is `AVG` rounded to one decimal.
 */
@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────────────────────── reads ─────────────────────────────

  /**
   * The directory. One raw PostGIS statement: `ST_DWithin` on the geography
   * column when a search point is given (GIST index applies), `COUNT(*) OVER ()`
   * for the real total, `pro DESC` ahead of everything else.
   */
  async list(query: QueryServicesDto, viewer?: Viewer): Promise<Paginated<ServiceWithDistance>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));

    const where: Prisma.Sql[] = [];
    if (viewer?.role !== 'admin') {
      // Approved listings plus the caller's own in any status — the same gate
      // adoptions use, so a pending listing never leaks to the marketplace.
      where.push(
        viewer
          ? Prisma.sql`(status = 'approved' OR "ownerId" = ${viewer.sub})`
          : Prisma.sql`status = 'approved'`,
      );
    }
    if (query.type) where.push(Prisma.sql`type = ${query.type}::"ServiceType"`);
    const term = query.q?.trim();
    if (term) {
      const like = `%${term}%`;
      where.push(
        Prisma.sql`(name ILIKE ${like} OR description ILIKE ${like} OR EXISTS (SELECT 1 FROM unnest(tags) t WHERE t ILIKE ${like}))`,
      );
    }

    const geo = typeof query.lat === 'number' && typeof query.lng === 'number';
    if (geo) {
      const radiusKm = query.radiusKm ?? DEFAULT_RADIUS_KM;
      where.push(
        Prisma.sql`ST_DWithin(location, ${point(query.lat!, query.lng!)}, ${Math.round(radiusKm * 1000)})`,
      );
    }

    const kmSelect = geo
      ? Prisma.sql`, round((ST_Distance(location, ${point(query.lat!, query.lng!)}) / 1000)::numeric, 1) AS km`
      : Prisma.empty;
    // A listing is featured while its owner's Pro subscription runs, so the
    // order reads the owner's subscription — not the `pro` column, which
    // cannot know about a subscription that expired an hour ago.
    const featured = Prisma.sql`
      (EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = services."ownerId"
          -- The parentheses are load-bearing: "::" binds tighter than "->>",
          -- so pro->>'until'::timestamptz casts the *key* 'until' and every
          -- read of the directory dies with "invalid input syntax for type
          -- timestamp with time zone". Extract first, cast second.
          AND (u.pro->>'until')::timestamptz > now()
      ))::int
    `;
    const orderBy = geo
      ? Prisma.sql`ORDER BY ${featured} DESC, km ASC, "createdAt" DESC`
      : Prisma.sql`ORDER BY ${featured} DESC, rating DESC, "createdAt" DESC`;

    const rows = await this.prisma.$queryRaw<Array<{ id: string; total: bigint; km: number | null }>>(
      Prisma.sql`
        SELECT id, COUNT(*) OVER () AS total${kmSelect}
        FROM services
        WHERE ${where.length > 0 ? Prisma.join(where, ' AND ') : Prisma.sql`TRUE`}
        ${orderBy}
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
    );
    if (rows.length === 0) return { items: [], total: 0, page, pageSize };

    const distances = new Map(rows.map((r) => [r.id, r.km === null ? undefined : Number(r.km)]));
    const loaded = await this.prisma.service.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: SERVICE_INCLUDE,
    });
    const byId = new Map(loaded.map((s) => [s.id, s]));

    const items = rows
      .map((r) => byId.get(r.id))
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .map((row) => serviceRowToService(row, distances.get(row.id)));

    return { items, total: Number(rows[0].total), page, pageSize };
  }

  /** One listing: approved, or the owner's own, or an admin's view. */
  async findOne(id: string, viewer?: Viewer): Promise<Service> {
    const row = await this.prisma.service.findUnique({ where: { id }, include: SERVICE_INCLUDE });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Ce service n’existe pas.');
    const isOwner = viewer?.sub === row.ownerId;
    if (row.status !== 'approved' && !isOwner && viewer?.role !== 'admin') {
      throw new ApiError(404, 'NOT_FOUND', 'Ce service n’existe pas.');
    }
    return serviceRowToService(row);
  }

  /** The reviews of a listing, newest first. */
  async reviews(serviceId: string, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<Paginated<Review>> {
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
    const p = Math.max(1, page);
    const where: Prisma.ReviewWhereInput = { serviceId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items: rows.map(reviewRowToWire), total, page: p, pageSize: size };
  }

  /** My bookings — `GET /me/bookings`. */
  async myBookings(userId: string, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<Paginated<Booking>> {
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
    const p = Math.max(1, page);
    const where: Prisma.BookingWhereInput = { fromId: userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items: rows.map(bookingRowToWire), total, page: p, pageSize: size };
  }

  // ───────────────────────────── writes ─────────────────────────────

  /** `POST /services` — always `pending`, owner from the JWT. */
  async create(dto: CreateServiceDto, user: AuthenticatedUser): Promise<Service> {
    const row = await this.prisma.service.create({
      data: {
        type: dto.type,
        name: dto.name,
        lat: dto.lat,
        lng: dto.lng,
        address: dto.address ?? null,
        phone: dto.phone ?? null,
        openNow: dto.openNow ?? null,
        photo: dto.photo ?? null,
        tags: dto.tags ?? [],
        description: dto.description ?? null,
        hours: dto.hours ?? null,
        ownerId: user.sub,
        status: 'pending',
      },
      include: SERVICE_INCLUDE,
    });
    return serviceRowToService(row);
  }

  /**
   * `PATCH /services/:id` — owner only, content fields only.
   *
   * The **second review**: on a live listing the change waits for a moderator
   * as `pendingEdit` and the public version stays as it is
   * (`PATCH /admin/services/:id/edit`). A listing still waiting for its first
   * moderation changes straight away.
   */
  async update(id: string, dto: UpdateServiceDto, user: AuthenticatedUser): Promise<Service> {
    const row = await this.prisma.service.findUnique({ where: { id } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Ce service n’existe pas.');
    if (row.ownerId !== user.sub) {
      throw new ApiError(403, 'SERVICE_NOT_OWNER', 'Seul le propriétaire peut modifier cette fiche.');
    }

    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.hours !== undefined) patch.hours = dto.hours;
    if (dto.openNow !== undefined) patch.openNow = dto.openNow;
    if (dto.photo !== undefined) patch.photo = dto.photo;
    if (dto.tags !== undefined) patch.tags = dto.tags;
    // The position travels as one `location` object — the shape the web edits
    // (`ServiceEdit`) and the shape the pending edit is read back with.
    if (dto.lat !== undefined || dto.lng !== undefined || dto.address !== undefined) {
      patch.location = {
        lat: dto.lat ?? row.lat,
        lng: dto.lng ?? row.lng,
        ...(dto.address ?? row.address ? { address: dto.address ?? row.address } : {}),
      };
    }

    const live = row.status === 'approved';
    const data: Prisma.ServiceUpdateInput = live
      ? { pendingEdit: { ...patch, at: new Date().toISOString() } as Prisma.InputJsonValue }
      : servicePatchToRow(patch);

    const updated = await this.prisma.service.update({
      where: { id },
      data,
      include: SERVICE_INCLUDE,
    });
    return serviceRowToService(updated);
  }

  /**
   * `PATCH /admin/services/:id/edit` — the moderator decides on a proposed change.
   *
   * `approve` merges the change into the public listing; `reject` drops it. The
   * owner is told either way.
   */
  async decideEdit(id: string, decision: 'approve' | 'reject'): Promise<Service> {
    const row = await this.prisma.service.findUnique({ where: { id } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Ce service n’existe pas.');

    const edit = row.pendingEdit;
    if (!edit) {
      throw new ApiError(404, 'NO_PENDING_EDIT', 'Cette fiche n’a pas de modification en attente.');
    }

    const patch = pendingEditFields(edit);
    const updated = await this.prisma.service.update({
      where: { id },
      data:
        decision === 'approve'
          ? { ...servicePatchToRow(patch), pendingEdit: Prisma.DbNull }
          : { pendingEdit: Prisma.DbNull },
      include: SERVICE_INCLUDE,
    });

    if (row.ownerId) {
      await this.notifications.notify(
        row.ownerId,
        decision === 'approve' ? 'editApproved' : 'editRejected',
        row.name,
        '/account?tab=pro',
      );
    }
    return serviceRowToService(updated);
  }

  /**
   * The listings waiting for a moderator — the second review queue
   * (`GET /admin/pending-edits`).
   */
  async pendingEdits(): Promise<PendingEdit[]> {
    const rows = await this.prisma.service.findMany({
      where: { pendingEdit: { not: Prisma.DbNull } },
      include: SERVICE_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => ({
      kind: 'service' as const,
      id: row.id,
      title: row.name,
      ownerId: row.ownerId ?? '',
      ownerName: row.owner?.name ?? '',
      at: pendingEditAt(row.pendingEdit, row.updatedAt),
      edit: row.pendingEdit as unknown as ServiceEdit,
    }));
  }

  /**
   * `POST /services/:id/reviews` — one per user per service (the
   * `reviews_service_author_unique` index; the P2002 becomes 409), never on
   * your own listing, and the service's `rating`/`reviewCount` are recomputed
   * **in the same transaction** so the average can never drift from the rows.
   */
  async addReview(serviceId: string, dto: CreateReviewDto, user: AuthenticatedUser): Promise<Review> {
    const service = await this.visibleService(serviceId, user);
    if (service.ownerId === user.sub) {
      throw new ApiError(403, 'REVIEW_OWNER', 'Vous ne pouvez pas noter votre propre service.');
    }

    let review;
    try {
      review = await this.prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
          data: { serviceId, authorId: user.sub, rating: dto.rating, text: dto.text },
          include: REVIEW_INCLUDE,
        });
        const agg = await tx.review.aggregate({
          where: { serviceId },
          _avg: { rating: true },
          _count: { _all: true },
        });
        await tx.service.update({
          where: { id: serviceId },
          data: {
            rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
            reviewCount: agg._count._all,
          },
        });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, 'REVIEW_EXISTS', 'Vous avez déjà noté ce service.');
      }
      throw error;
    }

    if (service.ownerId) {
      await this.notifications.notify(service.ownerId, 'review', user.name, `/services/${serviceId}`);
    }
    return reviewRowToWire(review);
  }

  /** `PATCH /services/:id/reviews/:reviewId` — the business answers. Owner only. */
  async replyReview(serviceId: string, reviewId: string, reply: string, user: AuthenticatedUser): Promise<Review> {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || service.status === 'rejected') {
      throw new ApiError(404, 'NOT_FOUND', 'Ce service n’existe pas.');
    }
    if (service.ownerId !== user.sub) {
      throw new ApiError(403, 'SERVICE_NOT_OWNER', 'Seul le propriétaire peut répondre aux avis.');
    }
    const review = await this.prisma.review.findUnique({ where: { id: reviewId }, include: REVIEW_INCLUDE });
    if (!review || review.serviceId !== serviceId) {
      throw new ApiError(404, 'NOT_FOUND', 'Cet avis n’existe pas.');
    }
    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { reply },
      include: REVIEW_INCLUDE,
    });
    return reviewRowToWire(updated);
  }

  /** `POST /services/:id/bookings` — `sent` until the owner decides. */
  async book(serviceId: string, dto: CreateBookingDto, user: AuthenticatedUser): Promise<Booking> {
    const service = await this.visibleService(serviceId, user);
    const booking = await this.prisma.booking.create({
      data: {
        serviceId,
        fromId: user.sub,
        date: dto.date,
        time: dto.time,
        animal: dto.animal,
        reason: dto.reason,
        status: 'sent',
      },
      include: BOOKING_INCLUDE,
    });
    if (service.ownerId) {
      await this.notifications.notify(service.ownerId, 'booking', user.name, '/account?tab=pro');
    }
    return bookingRowToWire(booking);
  }

  /**
   * `PATCH /bookings/:id` — the service owner's terminal answer. Notifies the
   * booker with the service's name and a link to it.
   */
  async decideBooking(id: string, dto: DecideBookingDto, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { ...BOOKING_INCLUDE, service: true },
    });
    if (!booking) throw new ApiError(404, 'NOT_FOUND', 'Cette réservation n’existe pas.');
    if (booking.service.ownerId !== user.sub) {
      throw new ApiError(403, 'BOOKING_NOT_OWNER', 'Seul le prestataire peut répondre.');
    }
    if (booking.status !== 'sent') {
      throw new ApiError(409, 'BOOKING_ALREADY_ANSWERED', 'Cette réservation a déjà reçu une réponse.');
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: dto.status },
      include: BOOKING_INCLUDE,
    });

    await this.notifications.notify(
      booking.fromId,
      dto.status === 'confirmed' ? 'bookingConfirmed' : 'bookingDeclined',
      booking.service.name,
      `/services/${booking.serviceId}`,
    );
    return bookingRowToWire(updated);
  }

  /** The booker withdraws a request; the provider receives a cancellation notice. */
  async cancelBooking(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { ...BOOKING_INCLUDE, service: true } });
    if (!booking) throw new ApiError(404, 'NOT_FOUND', 'Cette réservation n’existe pas.');
    if (booking.fromId !== user.sub) throw new ApiError(403, 'BOOKING_NOT_BOOKER', 'Seule la personne qui a réservé peut annuler.');
    if (booking.status !== 'sent' && booking.status !== 'confirmed') throw new ApiError(409, 'BOOKING_ALREADY_ANSWERED', 'Cette réservation est déjà close.');
    const updated = await this.prisma.booking.update({ where: { id }, data: { status: 'cancelled' }, include: BOOKING_INCLUDE });
    if (booking.service.ownerId) await this.notifications.notify(booking.service.ownerId, 'bookingCancelled', booking.service.name, `/services/${booking.serviceId}`);
    return bookingRowToWire(updated);
  }

  /** `PATCH /admin/services/:id` — approve publishes + verifies + notifies; reject is silent. */
  async moderate(id: string, dto: ModerateServiceDto): Promise<Service> {
    const row = await this.prisma.service.findUnique({ where: { id } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Ce service n’existe pas.');

    const approved = dto.status === 'approved';
    const updated = await this.prisma.service.update({
      where: { id },
      // Approving also sets `verified`: the admin's decision IS the license /
      // registration check the `Service.verified` field documents.
      data: approved ? { status: 'approved', verified: true } : { status: 'rejected' },
      include: SERVICE_INCLUDE,
    });

    // `store.moderateService` fires nothing on reject — matched exactly.
    if (approved && row.ownerId) {
      await this.notifications.notify(row.ownerId, 'serviceApproved', row.name, `/services/${id}`);
    }
    return serviceRowToService(updated);
  }

  // ───────────────────────────── helpers ─────────────────────────────

  /** A listing that exists and the caller may see, or a 404. */
  private async visibleService(serviceId: string, user: AuthenticatedUser) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    const visible =
      service &&
      (service.status === 'approved' || service.ownerId === user.sub || user.role === 'admin');
    if (!visible || !service) {
      throw new ApiError(404, 'NOT_FOUND', 'Ce service n’existe pas.');
    }
    return service;
  }
}

function point(lat: number, lng: number): Prisma.Sql {
  return Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}

/**
 * The proposed change → the columns of the `services` row.
 *
 * `location` is the one field that splits into three columns, and the
 * `location` trigger keeps the geography column in step.
 */
function servicePatchToRow(patch: Record<string, unknown>): Prisma.ServiceUpdateInput {
  const data: Prisma.ServiceUpdateInput = {};
  if (patch.name !== undefined) data.name = String(patch.name);
  if (patch.phone !== undefined) data.phone = patch.phone === null ? null : String(patch.phone);
  if (patch.description !== undefined) {
    data.description = patch.description === null ? null : String(patch.description);
  }
  if (patch.hours !== undefined) data.hours = patch.hours === null ? null : String(patch.hours);
  if (patch.openNow !== undefined) data.openNow = patch.openNow as boolean | null;
  if (patch.photo !== undefined) data.photo = patch.photo === null ? null : String(patch.photo);
  if (patch.tags !== undefined) data.tags = patch.tags as string[];

  const location = patch.location as { lat?: number; lng?: number; address?: string } | undefined;
  if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
    data.lat = location.lat;
    data.lng = location.lng;
    data.address = location.address ?? null;
  }

  return data;
}
