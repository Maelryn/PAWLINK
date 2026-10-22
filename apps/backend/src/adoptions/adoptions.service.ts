import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/filters/http-exception.filter';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../common/decorators/auth.decorators';
import type { Viewer, Paginated } from '../shared/pagination';
import { UploadsService } from '../uploads/uploads.service';
import { ExifService } from '../uploads/exif.service';
import { DUPLICATE_THRESHOLD } from '../uploads/dhash.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  adoptionRowToProfile,
  requestRowToWire,
  type AdoptionRowWithRelations,
} from './serialize';
import { MAX_ADOPTION_PHOTOS } from './dto/adoption.dto';
import type {
  CreateAdoptionDto,
  CreateRequestDto,
  DecideRequestDto,
  ModerateAdoptionDto,
  UpdateAdoptionDto,
} from './dto/adoption.dto';
import type { QueryAdoptionsDto } from './dto/query-adoptions.dto';
import type { AdoptionProfile, AdoptionRequest, AdoptionEdit, PendingEdit } from '../shared/types';
import { pendingEditAt, pendingEditFields } from '../shared/pending-edit';

/** How far back a stored hash is still worth comparing against (same as cases). */
const HASH_LOOKBACK_DAYS = 90;

/** The rows every read needs, in one shape. */
const ADOPTION_INCLUDE = {
  owner: { select: { id: true, name: true, phone: true } },
  shelter: { select: { id: true, name: true } },
} satisfies Prisma.AdoptionInclude;

const REQUEST_INCLUDE = {
  // `phone` is selected but only serialized on an accepted request.
  from: { select: { id: true, name: true, avatar: true, phone: true } },
} satisfies Prisma.AdoptionRequestInclude;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Adoptions — listings, requests, and the phone-reveal rule (§3.6).
 *
 * The rule that shapes the file: **the phone is never in a response unless the
 * viewer earned it** — owner, admin, or an accepted requester. It is applied in
 * the serializer, with the accepted-requester set computed here, so every read
 * path (list, detail, `/me`) applies exactly the same logic.
 *
 * Listing status moves only through `PATCH /admin/adoptions/:id`; requests
 * move `sent → accepted | declined`, once, ever.
 */
@Injectable()
export class AdoptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly exif: ExifService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────────────────────── reads ─────────────────────────────

  /**
   * The marketplace list. Default `status=approved`; a non-admin caller only
   * ever sees approved listings **plus their own** in any status, so a pending
   * listing is a 404-empty result for everyone but its owner. Admins see
   * through the gate entirely — that is what the moderation queue needs.
   */
  async list(query: QueryAdoptionsDto, viewer?: Viewer): Promise<Paginated<AdoptionProfile>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));

    const gate: Prisma.AdoptionWhereInput =
      viewer?.role === 'admin'
        ? {}
        : {
            OR: [{ status: 'approved' }, ...(viewer ? [{ ownerId: viewer.sub }] : [])],
          };
    const where: Prisma.AdoptionWhereInput = {
      AND: [gate, { status: query.status ?? 'approved' }],
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.adoption.findMany({
        where,
        include: ADOPTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.adoption.count({ where }),
    ]);

    const accepted = await this.acceptedAdoptionIds(viewer, rows.map((r) => r.id));
    return {
      items: rows.map((row) => adoptionRowToProfile(row, viewer, accepted)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Moderation queue: every listing, ungated, with an optional status filter.
   * Admin only — the controller enforces it.
   */
  async listForAdmin(query: QueryAdoptionsDto): Promise<Paginated<AdoptionProfile>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));

    const where: Prisma.AdoptionWhereInput = {};
    if (query.status) where.status = query.status;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.adoption.findMany({
        where,
        include: ADOPTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.adoption.count({ where }),
    ]);

    // Admin viewer: accepted set not needed for phone reveal (admin always sees phone),
    // but pass an admin viewer for consistent serialization.
    const adminViewer: Viewer = { sub: '', role: 'admin' };
    const accepted = await this.acceptedAdoptionIds(adminViewer, rows.map((r) => r.id));
    return {
      items: rows.map((row) => adoptionRowToProfile(row, adminViewer, accepted)),
      total,
      page,
      pageSize,
    };
  }

  /** One listing. A non-approved listing is a 404 unless the caller owns it or is admin. */
  async findOne(id: string, viewer?: Viewer): Promise<AdoptionProfile> {
    const row = await this.prisma.adoption.findUnique({
      where: { id },
      include: ADOPTION_INCLUDE,
    });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Cette annonce n’existe pas.');

    const isOwner = viewer?.sub === row.ownerId;
    const isAdmin = viewer?.role === 'admin';
    if (row.status !== 'approved' && !isOwner && !isAdmin) {
      // Exactly as invisible as in the list — no hint that a pending id exists.
      throw new ApiError(404, 'NOT_FOUND', 'Cette annonce n’existe pas.');
    }

    const accepted = await this.acceptedAdoptionIds(viewer, [row.id]);
    return adoptionRowToProfile(row, viewer, accepted);
  }

  /** My listings, any status — `GET /me/adoptions`. */
  async mine(userId: string, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<Paginated<AdoptionProfile>> {
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
    const p = Math.max(1, page);
    const where: Prisma.AdoptionWhereInput = { ownerId: userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.adoption.findMany({
        where,
        include: ADOPTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.prisma.adoption.count({ where }),
    ]);
    // The owner always sees their own phone — the accepted set is irrelevant.
    return {
      items: rows.map((row) => adoptionRowToProfile(row, { sub: userId, role: 'reporter' }, new Set([row.id]))),
      total,
      page: p,
      pageSize: size,
    };
  }

  /** Requests I sent — `GET /me/requests`. */
  async myRequests(userId: string, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<Paginated<AdoptionRequest>> {
    return this.pageRequests({ fromId: userId }, page, pageSize);
  }

  /** Requests on my listings — `GET /me/requests/received`. */
  async receivedRequests(userId: string, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<Paginated<AdoptionRequest>> {
    return this.pageRequests({ adoption: { ownerId: userId } }, page, pageSize);
  }

  // ───────────────────────────── writes ─────────────────────────────

  /** `POST /adoptions` — always `pending`, owner from the JWT, phone from their row. */
  async create(dto: CreateAdoptionDto, user: AuthenticatedUser): Promise<AdoptionProfile> {
    if (dto.photos.length > MAX_ADOPTION_PHOTOS) {
      throw new ApiError(
        413,
        'ADOPTION_TOO_MANY_PHOTOS',
        `Une annonce accepte au plus ${MAX_ADOPTION_PHOTOS} photos.`,
      );
    }
    if (dto.photos.length !== dto.probeIds.length) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Un probeId par photo est requis (photos et probeIds de même longueur).',
      );
    }
    if (dto.shelterId) await this.assertShelter(dto.shelterId);
    const hashes = await this.checkPhotos(user.sub, dto.probeIds);

    const owner = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!owner) throw new ApiError(401, 'AUTH_ACCOUNT_DELETED', 'Ce compte n’existe plus.');

    const row = await this.prisma.adoption.create({
      data: {
        name: dto.name,
        species: dto.species,
        breed: dto.breed ?? null,
        sex: dto.sex,
        ageMonths: dto.ageMonths,
        photos: dto.photos,
        healthStatus: dto.healthStatus,
        vaccinations: (dto.vaccinations ?? []) as unknown as Prisma.InputJsonValue[],
        medicalHistory: (dto.medicalHistory ?? []) as unknown as Prisma.InputJsonValue[],
        behavior: dto.behavior ?? [],
        careNeeds: dto.careNeeds ?? [],
        story: dto.story,
        shelterId: dto.shelterId ?? null,
        ownerId: user.sub,
        ownerPhone: owner.phone ?? null,
        lat: dto.location.lat,
        lng: dto.location.lng,
        address: dto.location.address ?? null,
        status: 'pending',
      },
      include: ADOPTION_INCLUDE,
    });

    await this.storeHashes(row.id, hashes);
    // `create` does not propagate `include` into its return type the way
    // `findUnique`/`findMany` do — the relations are present at runtime, so the
    // same `as unknown as` narrowing `cases/serialize.ts` uses applies here.
    return adoptionRowToProfile(
      row as unknown as AdoptionRowWithRelations,
      { sub: user.sub, role: user.role },
      new Set([row.id]),
    );
  }

  /**
   * `PATCH /adoptions/:id` — owner only, content fields only.
   *
   * The **second review**: on a live listing the change is stored as
   * `pendingEdit` and the public version stays as it is until a moderator
   * approves it (`PATCH /admin/adoptions/:id/edit`). A listing that is still
   * waiting for its first moderation changes straight away, and a refused one
   * goes back to `pending` — the owner may try again.
   */
  async update(id: string, dto: UpdateAdoptionDto, user: AuthenticatedUser): Promise<AdoptionProfile> {
    const row = await this.prisma.adoption.findUnique({ where: { id }, include: ADOPTION_INCLUDE });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Cette annonce n’existe pas.');
    if (row.ownerId !== user.sub) {
      throw new ApiError(403, 'ADOPTION_NOT_OWNER', 'Seul le propriétaire peut modifier cette annonce.');
    }

    // Closing the listing travels through the same `PATCH /adoptions/:id`
    // (the shape the website uses) and keeps its own rule in `markAdopted`.
    if (dto.status === 'adopted') return this.markAdopted(id, user);

    // A photo swap goes through the same probe pipeline as a creation.
    const nextPhotos = dto.photos ?? row.photos;
    let hashes: Array<string | null> = [];
    if (dto.photos !== undefined) {
      if (nextPhotos.length > MAX_ADOPTION_PHOTOS) {
        throw new ApiError(
          413,
          'ADOPTION_TOO_MANY_PHOTOS',
          `Une annonce accepte au plus ${MAX_ADOPTION_PHOTOS} photos.`,
        );
      }
      const probes = dto.probeIds ?? [];
      if (nextPhotos.length !== probes.length) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Un probeId par photo est requis.');
      }
      hashes = await this.checkPhotos(user.sub, probes);
    }

    // The change itself — the fields the owner actually touched.
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.breed !== undefined) patch.breed = dto.breed;
    if (dto.photos !== undefined) patch.photos = dto.photos;
    if (dto.healthStatus !== undefined) patch.healthStatus = dto.healthStatus;
    if (dto.vaccinations !== undefined) patch.vaccinations = dto.vaccinations;
    if (dto.medicalHistory !== undefined) patch.medicalHistory = dto.medicalHistory;
    if (dto.behavior !== undefined) patch.behavior = dto.behavior;
    if (dto.careNeeds !== undefined) patch.careNeeds = dto.careNeeds;
    if (dto.story !== undefined) patch.story = dto.story;
    if (dto.location !== undefined) {
      patch.location = {
        lat: dto.location.lat,
        lng: dto.location.lng,
        ...(dto.location.address ? { address: dto.location.address } : {}),
      };
    }

    // A live listing waits for a moderator; the others change straight away.
    const live = row.status === 'approved';
    const data: Prisma.AdoptionUpdateInput = live
      ? { pendingEdit: { ...patch, at: new Date().toISOString() } as Prisma.InputJsonValue }
      : {
          ...adoptionPatchToRow(patch),
          ...(row.status === 'rejected' ? { status: 'pending' } : {}),
        };

    const updated = await this.prisma.adoption.update({
      where: { id },
      data,
      include: ADOPTION_INCLUDE,
    });

    if (hashes.length > 0) await this.storeHashes(updated.id, hashes);
    return adoptionRowToProfile(updated, { sub: user.sub, role: user.role }, new Set([row.id]));
  }

  /**
   * `PATCH /admin/adoptions/:id/edit` — the moderator decides on a proposed change.
   *
   * `approve` merges the change into the public listing; `reject` drops it. The
   * owner is told either way.
   */
  async decideEdit(id: string, decision: 'approve' | 'reject'): Promise<AdoptionProfile> {
    const row = await this.prisma.adoption.findUnique({ where: { id }, include: ADOPTION_INCLUDE });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Cette annonce n’existe pas.');

    const edit = (row.pendingEdit ?? undefined) as AdoptionEdit | undefined;
    if (!edit) {
      throw new ApiError(404, 'NO_PENDING_EDIT', 'Cette annonce n’a pas de modification en attente.');
    }

    const patch = pendingEditFields(row.pendingEdit);

    const updated = await this.prisma.adoption.update({
      where: { id },
      data:
        decision === 'approve'
          ? { ...adoptionPatchToRow(patch), pendingEdit: Prisma.DbNull }
          : { pendingEdit: Prisma.DbNull },
      include: ADOPTION_INCLUDE,
    });

    await this.notifications.notify(
      row.ownerId,
      decision === 'approve' ? 'editApproved' : 'editRejected',
      row.name,
      `/adopt/${id}`,
    );

    return adoptionRowToProfile(updated, { sub: '', role: 'admin' }, new Set());
  }

  /**
   * The listings waiting for a moderator — the second review queue
   * (`GET /admin/pending-edits`).
   */
  async pendingEdits(): Promise<PendingEdit[]> {
    const rows = await this.prisma.adoption.findMany({
      where: { pendingEdit: { not: Prisma.DbNull } },
      include: ADOPTION_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => ({
      kind: 'adoption' as const,
      id: row.id,
      title: row.name,
      ownerId: row.ownerId,
      ownerName: row.owner.name,
      at: pendingEditAt(row.pendingEdit, row.updatedAt),
      edit: row.pendingEdit as unknown as AdoptionEdit,
    }));
  }

  // ─────────────────────────── favourites ───────────────────────────

  /**
   * `GET /me/favorites` — the adoption profiles the caller saved.
   *
   * The phone-reveal rule still applies: saving a listing does not buy the
   * owner's phone number.
   */
  async favoritesOf(
    userId: string,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<Paginated<AdoptionProfile>> {
    const p = Math.max(1, page);
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
    const where: Prisma.FavoriteWhereInput = { userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.favorite.findMany({
        where,
        include: { adoption: { include: ADOPTION_INCLUDE } },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.prisma.favorite.count({ where }),
    ]);

    const accepted = await this.acceptedAdoptionIds(
      { sub: userId, role: 'reporter' },
      rows.map((r) => r.adoption.id),
    );
    return {
      items: rows.map((row) =>
        adoptionRowToProfile(
          row.adoption as unknown as AdoptionRowWithRelations,
          { sub: userId, role: 'reporter' },
          accepted,
        ),
      ),
      total,
      page: p,
      pageSize: size,
    };
  }

  /**
   * `PUT /me/favorites/:adoptionId` — save a listing.
   *
   * Idempotent: saving the same listing twice is the same row, so the client
   * can retry a failed request without creating a duplicate.
   */
  async saveFavorite(userId: string, adoptionId: string): Promise<AdoptionProfile> {
    const adoption = await this.prisma.adoption.findUnique({
      where: { id: adoptionId },
      include: ADOPTION_INCLUDE,
    });
    if (!adoption) throw new ApiError(404, 'NOT_FOUND', 'Cette annonce n’existe pas.');

    try {
      await this.prisma.favorite.create({ data: { userId, adoptionId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Already saved — nothing to do.
      } else {
        throw error;
      }
    }

    const accepted = await this.acceptedAdoptionIds({ sub: userId, role: 'reporter' }, [adoptionId]);
    return adoptionRowToProfile(
      adoption as unknown as AdoptionRowWithRelations,
      { sub: userId, role: 'reporter' },
      accepted,
    );
  }

  /** `DELETE /me/favorites/:adoptionId` — unsave a listing. Not an error if it was not saved. */
  async removeFavorite(userId: string, adoptionId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, adoptionId } });
  }

  /**
   * `POST /adoptions/:id/requests` — one per user per listing, enforced by the
   * `adoption_requests_adoption_user_unique` index; the P2002 becomes the
   * contract's 409.
   */
  async createRequest(adoptionId: string, dto: CreateRequestDto, user: AuthenticatedUser): Promise<AdoptionRequest> {
    const adoption = await this.prisma.adoption.findUnique({
      where: { id: adoptionId },
      include: ADOPTION_INCLUDE,
    });
    if (!adoption) throw new ApiError(404, 'NOT_FOUND', 'Cette annonce n’existe pas.');
    if (adoption.status !== 'approved') {
      throw new ApiError(404, 'NOT_FOUND', 'Cette annonce n’existe pas.');
    }
    if (adoption.ownerId === user.sub) {
      throw new ApiError(403, 'ADOPTION_OWN_LISTING', 'Vous ne pouvez pas demander votre propre annonce.');
    }

    try {
      const request = await this.prisma.adoptionRequest.create({
        data: {
          adoptionId,
          fromId: user.sub,
          message: dto.message,
          housing: dto.housing,
          experience: dto.experience,
        },
        include: REQUEST_INCLUDE,
      });

      // Recipient, kind and href come from database rows and ids only.
      await this.notifications.notify(
        adoption.ownerId,
        'adoptRequest',
        user.name,
        '/account?tab=requests',
      );
      return requestRowToWire(request);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, 'ADOPTION_REQUEST_EXISTS', 'Vous avez déjà demandé cette annonce.');
      }
      throw error;
    }
  }

  /**
   * `PATCH /requests/:id` — the listing owner's single decision, terminal.
   * Notifies the requester with the animal's name and a link back to it.
   */
  async decideRequest(id: string, dto: DecideRequestDto, user: AuthenticatedUser): Promise<AdoptionRequest> {
    const request = await this.prisma.adoptionRequest.findUnique({
      where: { id },
      include: { ...REQUEST_INCLUDE, adoption: { include: ADOPTION_INCLUDE } },
    });
    if (!request) throw new ApiError(404, 'NOT_FOUND', 'Cette demande n’existe pas.');
    if (request.adoption.ownerId !== user.sub) {
      throw new ApiError(403, 'REQUEST_NOT_OWNER', 'Seul le propriétaire de l’annonce peut répondre.');
    }
    if (request.status !== 'sent') {
      throw new ApiError(409, 'REQUEST_ALREADY_ANSWERED', 'Cette demande a déjà reçu une réponse.');
    }

    const updated = await this.prisma.adoptionRequest.update({
      where: { id },
      data: { status: dto.status },
      include: REQUEST_INCLUDE,
    });

    await this.notifications.notify(
      request.fromId,
      dto.status === 'accepted' ? 'adoptAccepted' : 'adoptDeclined',
      request.adoption.name,
      `/adopt/${request.adoptionId}`,
    );
    return requestRowToWire(updated);
  }

  /**
   * `PATCH /adoptions/:id/status { status: "adopted" }` — the owner confirms
   * the animal found its family. The listing leaves the public marketplace and
   * the requests still waiting get a clear "no" instead of waiting forever.
   */
  async markAdopted(id: string, user: AuthenticatedUser): Promise<AdoptionProfile> {
    const row = await this.prisma.adoption.findUnique({ where: { id }, include: ADOPTION_INCLUDE });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Cette annonce n’existe pas.');
    if (row.ownerId !== user.sub) {
      throw new ApiError(403, 'ADOPTION_NOT_OWNER', 'Seul le propriétaire peut clôturer cette annonce.');
    }
    if (row.status !== 'approved' && row.status !== 'adopted') {
      throw new ApiError(
        409,
        'ADOPTION_NOT_LIVE',
        'Seule une annonce publiée peut être marquée comme adoptée.',
      );
    }

    const waiting = await this.prisma.adoptionRequest.findMany({
      where: { adoptionId: id, status: 'sent' },
      select: { fromId: true },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      if (waiting.length > 0) {
        await tx.adoptionRequest.updateMany({
          where: { adoptionId: id, status: 'sent' },
          data: { status: 'declined' },
        });
      }
      return tx.adoption.update({
        where: { id },
        data: { status: 'adopted', pendingEdit: Prisma.DbNull },
        include: ADOPTION_INCLUDE,
      });
    });

    for (const request of waiting) {
      await this.notifications.notify(request.fromId, 'adoptDeclined', row.name, `/adopt/${id}`);
    }

    return adoptionRowToProfile(updated, { sub: user.sub, role: user.role }, new Set([id]));
  }

  /**
   * `DELETE /adoptions/:id` — the owner removes their listing.
   *
   * The row goes with its requests and saved profiles (the foreign keys
   * cascade). Only the owner may do it.
   */
  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.adoption.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Cette annonce n’existe pas.');
    if (existing.ownerId !== user.sub) {
      throw new ApiError(403, 'ADOPTION_NOT_OWNER', 'Seul le propriétaire peut supprimer cette annonce.');
    }

    await this.prisma.adoption.delete({ where: { id } });
  }

  /**
   * `DELETE /requests/:id` — the adopter withdraws their request.
   *
   * Allowed while the request is `sent` or `accepted` (the web lets the adopter
   * change their mind even after a yes); a decided-and-closed one answers
   * `409 REQUEST_ALREADY_ANSWERED`. The row is kept with `status: cancelled`.
   */
  async cancelRequest(id: string, user: AuthenticatedUser): Promise<AdoptionRequest> {
    const request = await this.prisma.adoptionRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });
    if (!request) throw new ApiError(404, 'NOT_FOUND', 'Cette demande n’existe pas.');
    if (request.fromId !== user.sub) {
      throw new ApiError(403, 'REQUEST_NOT_REQUESTER', 'Seule la personne qui a demandé peut annuler.');
    }
    if (request.status !== 'sent' && request.status !== 'accepted') {
      throw new ApiError(409, 'REQUEST_ALREADY_ANSWERED', 'Cette demande est déjà close.');
    }

    const updated = await this.prisma.adoptionRequest.update({
      where: { id },
      data: { status: 'cancelled' },
      include: REQUEST_INCLUDE,
    });
    return requestRowToWire(updated);
  }

  /** `PATCH /admin/adoptions/:id` — approve/reject. Notifies the owner either way. */
  async moderate(id: string, dto: ModerateAdoptionDto): Promise<AdoptionProfile> {
    const row = await this.prisma.adoption.findUnique({ where: { id }, include: ADOPTION_INCLUDE });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Cette annonce n’existe pas.');

    const updated = await this.prisma.adoption.update({
      where: { id },
      data: { status: dto.status },
      include: ADOPTION_INCLUDE,
    });

    await this.notifications.notify(
      row.ownerId,
      dto.status === 'approved' ? 'listingApproved' : 'listingRejected',
      row.name,
      `/adopt/${id}`,
    );
    // No viewer needed: admins read the listing anyway, and the owner is the
    // one being notified — pass them so the phone rule still resolves sanely.
    return adoptionRowToProfile(updated);
  }

  // ───────────────────────────── helpers ─────────────────────────────

  private async pageRequests(
    where: Prisma.AdoptionRequestWhereInput,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AdoptionRequest>> {
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
    const p = Math.max(1, page);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.adoptionRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.prisma.adoptionRequest.count({ where }),
    ]);
    return { items: rows.map(requestRowToWire), total, page: p, pageSize: size };
  }

  /** The listings among `ids` on which the viewer holds an accepted request. */
  private async acceptedAdoptionIds(
    viewer: Viewer | undefined,
    ids: string[],
  ): Promise<Set<string>> {
    if (!viewer || ids.length === 0) return new Set();
    const rows = await this.prisma.adoptionRequest.findMany({
      where: { fromId: viewer.sub, status: 'accepted', adoptionId: { in: ids } },
      select: { adoptionId: true },
    });
    return new Set(rows.map((r) => r.adoptionId));
  }

  /** An unknown `shelterId` is a 400, not a foreign-key 500. */
  private async assertShelter(shelterId: string): Promise<void> {
    const shelter = await this.prisma.service.findUnique({ where: { id: shelterId } });
    if (!shelter) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Unknown shelterId: ${shelterId}.`);
    }
  }

  /**
   * The photo gate, shared by create and update: one probe per photo, every
   * photo from a real camera, no photo already used anywhere on PawLink.
   *
   * Reads how `CasesService` consumes the probe pipeline first — same
   * primitives, stricter rules: a case may have a photo without GPS, an
   * adoption may not have one without a camera.
   */
  private async checkPhotos(userId: string, probeIds: string[]): Promise<Array<string | null>> {
    if (probeIds.length === 0) return [];

    const probes = await this.uploads.consume(userId, probeIds);
    for (const probe of probes) {
      if (!this.exif.hasCameraIdentity(probe.exif)) {
        throw new ApiError(
          400,
          'ADOPTION_PHOTO_NO_EXIF',
          'Chaque photo d’adoption doit venir d’un appareil photo (EXIF Make/Model + date).',
        );
      }
    }

    const hashes = probes.map((p) => p.dHash);
    if (await this.findsDuplicateHash(hashes)) {
      throw new ApiError(
        409,
        'ADOPTION_PHOTO_DUPLICATE',
        'Cette photo a déjà été utilisée sur PawLink.',
      );
    }
    return hashes;
  }

  /**
   * Any stored hash — a case's photo or another listing's — within the
   * lookback window. Same SQL comparison as the cases pipeline: Postgres does
   * the Hamming distance, Node never sees the hashes.
   */
  private async findsDuplicateHash(hashes: Array<string | null>): Promise<boolean> {
    const usable = hashes.filter(
      (h): h is string => typeof h === 'string' && /^[0-9a-f]{16}$/i.test(h),
    );
    if (usable.length === 0) return false;

    const cutoff = new Date(Date.now() - HASH_LOOKBACK_DAYS * 24 * 3_600_000);
    const clauses = usable.map(
      (hash) =>
        Prisma.sql`bit_count(('x' || hash)::bit(64) # ('x' || ${hash})::bit(64)) <= ${DUPLICATE_THRESHOLD}`,
    );

    const rows = await this.prisma.$queryRaw<Array<{ found: number }>>(
      Prisma.sql`
        SELECT 1 AS found
        FROM photo_hashes
        WHERE "createdAt" > ${cutoff}
          AND (${Prisma.join(clauses, ' OR ')})
        LIMIT 1
      `,
    );
    return rows.length > 0;
  }

  /** Keeps the permanent record once the listing exists. */
  private async storeHashes(adoptionId: string, hashes: Array<string | null>): Promise<void> {
    const usable = hashes.filter(
      (h): h is string => typeof h === 'string' && /^[0-9a-f]{16}$/i.test(h),
    );
    if (usable.length === 0) return;
    await this.prisma.photoHash.createMany({
      data: usable.map((hash) => ({ subjectType: 'adoption', subjectId: adoptionId, hash })),
    });
  }
}

export type { AdoptionRowWithRelations };

/**
 * The proposed change → the columns of the `adoptions` row.
 *
 * The proposal travels as the **profile** shape (`apps/web/lib/types.ts`),
 * because that is what the web edits; the row stores columns. `location` is
 * the one field that splits into three.
 */
function adoptionPatchToRow(patch: Record<string, unknown>): Prisma.AdoptionUpdateInput {
  const data: Prisma.AdoptionUpdateInput = {};
  if (patch.name !== undefined) data.name = String(patch.name);
  if (patch.breed !== undefined) data.breed = patch.breed === null ? null : String(patch.breed);
  if (patch.photos !== undefined) data.photos = patch.photos as string[];
  if (patch.healthStatus !== undefined) data.healthStatus = String(patch.healthStatus);
  if (patch.vaccinations !== undefined) {
    data.vaccinations = patch.vaccinations as Prisma.InputJsonValue[];
  }
  if (patch.medicalHistory !== undefined) {
    data.medicalHistory = patch.medicalHistory as Prisma.InputJsonValue[];
  }
  if (patch.behavior !== undefined) data.behavior = patch.behavior as string[];
  if (patch.careNeeds !== undefined) data.careNeeds = patch.careNeeds as string[];
  if (patch.story !== undefined) data.story = String(patch.story);

  const location = patch.location as { lat?: number; lng?: number; address?: string } | undefined;
  if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
    data.lat = location.lat;
    data.lng = location.lng;
    data.address = location.address ?? null;
  }

  return data;
}
