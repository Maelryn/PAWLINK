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
import type { AdoptionProfile, AdoptionRequest } from '../shared/types';

/** How far back a stored hash is still worth comparing against (same as cases). */
const HASH_LOOKBACK_DAYS = 90;

/** The rows every read needs, in one shape. */
const ADOPTION_INCLUDE = {
  owner: { select: { id: true, name: true, phone: true } },
  shelter: { select: { id: true, name: true } },
} satisfies Prisma.AdoptionInclude;

const REQUEST_INCLUDE = {
  from: { select: { id: true, name: true, avatar: true } },
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

  /** `PATCH /adoptions/:id` — owner only, content fields only. */
  async update(id: string, dto: UpdateAdoptionDto, user: AuthenticatedUser): Promise<AdoptionProfile> {
    const row = await this.prisma.adoption.findUnique({ where: { id }, include: ADOPTION_INCLUDE });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Cette annonce n’existe pas.');
    if (row.ownerId !== user.sub) {
      throw new ApiError(403, 'ADOPTION_NOT_OWNER', 'Seul le propriétaire peut modifier cette annonce.');
    }

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

    const updated = await this.prisma.adoption.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.breed !== undefined ? { breed: dto.breed } : {}),
        ...(dto.photos !== undefined ? { photos: dto.photos } : {}),
        ...(dto.healthStatus !== undefined ? { healthStatus: dto.healthStatus } : {}),
        ...(dto.vaccinations !== undefined ? { vaccinations: dto.vaccinations as Prisma.InputJsonValue[] } : {}),
        ...(dto.medicalHistory !== undefined ? { medicalHistory: dto.medicalHistory as Prisma.InputJsonValue[] } : {}),
        ...(dto.behavior !== undefined ? { behavior: dto.behavior } : {}),
        ...(dto.careNeeds !== undefined ? { careNeeds: dto.careNeeds } : {}),
        ...(dto.story !== undefined ? { story: dto.story } : {}),
        ...(dto.location !== undefined
          ? { lat: dto.location.lat, lng: dto.location.lng, address: dto.location.address ?? null }
          : {}),
      },
      include: ADOPTION_INCLUDE,
    });

    if (hashes.length > 0) await this.storeHashes(updated.id, hashes);
    return adoptionRowToProfile(updated, { sub: user.sub, role: user.role }, new Set([row.id]));
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
