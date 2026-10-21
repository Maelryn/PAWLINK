import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CaseStatus, HelpType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/filters/http-exception.filter';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../common/decorators/auth.decorators';
import { GeoService, distanceKm } from '../geo/geo.service';
import { UsersService } from '../users/users.service';
import { TrustService } from './trust.service';
import { DHashService, DUPLICATE_THRESHOLD } from '../uploads/dhash.service';
import { UploadsService } from '../uploads/uploads.service';
import { caseRowToCase, type CaseRowWithRelations } from './serialize';
import { NotificationsService } from '../notifications/notifications.service';
import { pendingEditAt } from '../shared/pending-edit';
import type { CreateCaseDto } from './dto/create-case.dto';
import type { Paginated, Viewer } from '../shared/pagination';
import type { CaseListQuery } from './dto/query-cases.dto';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './dto/query-cases.dto';
import type { FlagCaseDto, OfferHelpDto, PatchCaseStatusDto } from './dto/case.dto';
import type { ConfirmCaseDto } from './dto/confirm-case.dto';
import type { UpdateCaseDto } from './dto/update-case.dto';
import type { Case, CaseEdit, PendingEdit } from '../shared/types';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/**
 * Cases — the whole Phase 2 surface.
 *
 * The one rule that shapes the file: **nothing the client sends is trusted**.
 * Every field of the trust object is recomputed here, the moderation state
 * comes from that and never from the body, and `POST /cases` is the only
 * writer of a case.
 *
 * Reads are split by who may see them:
 *   - the public list is one raw PostGIS statement on the GIST index, gated on
 *     `moderation`, and shows a reporter their own held case;
 *   - `/admin/cases` is ungated, because that is the whole point of it.
 */

/** One photo probe per photo: the EXIF and the hash are read from the original. */
const MAX_PHOTOS = 6;

/** Who may change a case's status — §3.6: the server is the enforcement point. */
const STATUS_ROLES = ['volunteer', 'vet', 'admin'];

/** How far back a stored hash is still worth comparing against. */
const HASH_LOOKBACK_DAYS = 90;

/**
 * How close somebody has to stand to answer "do you see this animal?".
 *
 * The web checks the same radius on the device, and the API checks it again:
 * a vote from somebody in the other side of Algiers is worth nothing, and the
 * client is never the one that decides.
 */
export const CONFIRM_RADIUS_KM = 1;

/** How far the people around a new report are asked whether they see the animal. */
export const CONFIRM_ASK_RADIUS_KM = 3;

/** The trust arithmetic of one answer — the web's own numbers, so both agree. */
const CONFIRM_SCORE_YES = 0.12;
const CONFIRM_SCORE_NO = -0.12;

/** The rows a serializer needs, in one shape, reused by every read. */
const CASE_INCLUDE = {
  reporter: { select: { id: true, name: true, avatar: true } },
  helpers: {
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
  },
  confirms: true,
  flags: true,
  trustChecks: true,
} satisfies Prisma.CaseInclude;

/** Re-exported so the existing `import { Paginated, Viewer } from './cases.service'` keeps working. */
export type { Paginated, Viewer } from '../shared/pagination';

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly geo: GeoService,
    private readonly trust: TrustService,
    private readonly uploads: UploadsService,
    private readonly dhash: DHashService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────────────────────── reads ─────────────────────────────

  /**
   * The map: one raw statement for the box, Prisma for the relations.
   *
   * `location &&` uses the GIST index and needs no geography maths, so it is the
   * cheapest predicate PostGIS has. `COUNT(*) OVER ()` gives the matching total
   * in the same round trip, so `total` is the real count and not the length of
   * the page.
   */
  async list(query: CaseListQuery, viewer?: Viewer): Promise<Paginated<Case>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));

    const where: Prisma.Sql[] = [publicGate(viewer)];
    if (query.bbox) where.push(Prisma.sql`location && ${envelope(query.bbox)}`);
    where.push(...columnFilters(query));

    const rows = await this.pageOf(where, page, pageSize);
    return this.withRelations(rows, page, pageSize);
  }

  /** Everything, ungated — the moderation queue. Admin only; see the controller. */
  async listForAdmin(query: CaseListQuery): Promise<Paginated<Case>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));

    const where: Prisma.Sql[] = [];
    if (query.bbox) where.push(Prisma.sql`location && ${envelope(query.bbox)}`);
    where.push(...columnFilters(query));

    const rows = await this.pageOf(where, page, pageSize);
    return this.withRelations(rows, page, pageSize);
  }

  /**
   * The dashboards' radius query. `ST_DWithin` on the geography column, so the
   * GIST index still applies and the radius is in metres.
   */
  async nearby(
    lat: number,
    lng: number,
    radiusKm: number,
    query: { page?: number; pageSize?: number },
    viewer?: Viewer,
  ): Promise<Paginated<Case & { distanceKm: number }>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, query.pageSize ?? 50);

    const where: Prisma.Sql[] = [
      Prisma.sql`ST_DWithin(location, ${point(lat, lng)}, ${Math.round(radiusKm * 1000)})`,
      publicGate(viewer),
      ...columnFilters({}),
    ];

    const rows = await this.prisma.$queryRaw<Array<{ id: string; total: bigint }>>(
      Prisma.sql`
        SELECT id, COUNT(*) OVER () AS total
        FROM cases
        WHERE ${Prisma.join(where, ' AND ')}
        ORDER BY location <-> ${point(lat, lng)}, "createdAt" DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
    );

    if (rows.length === 0) return { items: [], total: 0, page, pageSize };

    const cases = await this.loadRows(rows.map((r) => r.id));
    return {
      items: await this.withDistances(cases, lat, lng),
      total: Number(rows[0].total),
      page,
      pageSize,
    };
  }

  /**
   * One case. Public when public; the reporter may read their own held case,
   * otherwise it is a 404 — exactly as invisible as it is on the map.
   */
  async findOne(id: string, viewer?: Viewer): Promise<Case> {
    const row = await this.prisma.case.findUnique({ where: { id }, include: CASE_INCLUDE });
    if (!row) throw new NotFoundException('Signalement introuvable.');

    const visible =
      row.moderation === null ||
      row.moderation === 'approved' ||
      row.reporterId === viewer?.sub;

    if (!visible) throw new NotFoundException('Signalement introuvable.');
    return caseRowToCase(row as unknown as CaseRowWithRelations);
  }

  // ──────────────────────────── writes ────────────────────────────

  /**
   * `POST /cases` — the headline of the phase.
   *
   * The order is the contract: read the reporter from the row, count their
   * reports, consume the probes (which is what proves the EXIF is real), check
   * the duplicate, ask the polygon, and only then score the trust.
   * Everything the body said about trust or moderation is ignored.
   *
   * A `suspicious` result is stored with `moderation: "pending"` and never
   * broadcast — it waits for an admin in `PATCH /admin/cases/:id/moderation`.
   */
  async create(dto: CreateCaseDto, user: AuthenticatedUser): Promise<Case> {
    const reporter = await this.liveReporter(user.sub);
    const photos = dto.photos ?? [];
    const probeIds = dto.probeIds ?? [];

    if (photos.length > MAX_PHOTOS) {
      throw new ApiError(400, 'VALIDATION_ERROR', `At most ${MAX_PHOTOS} photos per report.`);
    }
    // One probe per photo: the probe is what proves the bytes were ours.
    if (photos.length !== probeIds.length) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        `Every photo needs its own probeId (${photos.length} photos, ${probeIds.length} probes). ` +
          'Call POST /uploads/probe for each file first.',
      );
    }

    await this.assertEmergencyZone(dto.emergencyZoneId);

    const since = new Date(Date.now() - 3_600_000);
    const recentReports = await this.prisma.case.count({
      where: { reporterId: user.sub, createdAt: { gt: since } },
    });
    if (this.trust.isRateLimited(recentReports)) {
      // The per-IP half of this limit is the throttler's, on the route.
      throw new ApiError(
        429,
        'TRUST_RATE_LIMITED',
        `Trop de signalements : ${recentReports} dans la dernière heure (maximum 5).`,
      );
    }

    const probes = await this.uploads.consume(user.sub, probeIds);
    const duplicate = await this.findsDuplicateHash(probes.map((p) => p.dHash));
    const inAlgeria = await this.geo.inAlgeria({ lat: dto.location.lat, lng: dto.location.lng });

    const trust = await this.trust.check({
      user: { phoneVerified: reporter.phoneVerified === true },
      location: { lat: dto.location.lat, lng: dto.location.lng },
      hasPhoto: photos.length > 0,
      exif: mergeExif(probes),
      device: dto.device ? { lat: dto.device.lat, lng: dto.device.lng } : null,
      duplicatePhoto: duplicate,
      recentReports,
      inAlgeria: inAlgeria.ok,
    });

    // Until the AI service (apps/Ai/) is delivered, the triage is the caller's
    // own baseline. The AI's animalDetected/triage/safety rules are wired back
    // in when that service lands — there is intentionally no backend↔AI link yet.
    const triage = dto.triage ?? 'stable';

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.case.create({
        data: {
          title: dto.title,
          species: dto.species,
          category: dto.category,
          count: dto.count ?? null,
          status: 'open',
          triage,
          lat: dto.location.lat,
          lng: dto.location.lng,
          address: dto.location.address ?? null,
          photos,
          description: dto.description,
          conditionTags: dto.conditionTags ?? [],
          reporterId: reporter.id,
          emergencyZoneId: dto.emergencyZoneId ?? null,
          reporterOnSite: dto.reporterOnSite ?? null,
          moderation: trust.moderation,
          trustLevel: trust.level,
          trustScore: trust.score,
          trustConfirmations: trust.confirmations,
          trustFlags: trust.flags,
        },
        include: CASE_INCLUDE,
      });

      await tx.trustCheck.createMany({
        data: trust.checks.map((c) => ({
          caseId: row.id,
          check: c.id,
          ok: c.ok,
          detail: c.detail ?? null,
        })),
      });

      // The permanent record the duplicate check reads on the next report.
      const hashes = probes.flatMap((p) => (p.dHash ? [p.dHash] : []));
      if (hashes.length > 0) {
        await tx.photoHash.createMany({
          data: hashes.map((hash) => ({ subjectType: 'case', subjectId: row.id, hash })),
        });
      }

      return row;
    });

    // The row came back from inside the transaction, *before* the checks were
    // written, so its `trustChecks` is empty. Read it again: the response must
    // carry the same trust the checks describe, not an empty placeholder.
    const stored = await this.prisma.case.findUniqueOrThrow({
      where: { id: created.id },
      include: CASE_INCLUDE,
    });

    const serialized = caseRowToCase(stored as unknown as CaseRowWithRelations);

    if (serialized.moderation === undefined) {
      this.realtime.caseCreated({ case: serialized });
      // The people around the animal are asked whether they see it — their
      // answers are what makes a report `verified` (POST /cases/:id/confirm).
      await this.askAround(serialized);
    } else {
      this.logger.warn(
        `Case ${created.id} held for moderation (level=${trust.level}, score=${trust.score}).`,
      );
    }

    return serialized;
  }

  /** `PATCH /cases/:id/status` — volunteer / vet / admin only. */
  async updateStatus(id: string, dto: PatchCaseStatusDto, user: AuthenticatedUser): Promise<Case> {
    if (!STATUS_ROLES.includes(user.role)) {
      throw new ForbiddenException(
        'Seuls les bénévoles, vétérinaires et admins peuvent changer le statut.',
      );
    }

    const row = await this.prisma.case.update({
      where: { id },
      data: { status: dto.status as CaseStatus },
      include: CASE_INCLUDE,
    });

    const serialized = caseRowToCase(row as unknown as CaseRowWithRelations);
    this.realtime.caseUpdated({ case: serialized });
    return serialized;
  }

  /**
   * `POST /cases/:id/help` — a volunteer offers help.
   *
   * Mirrors the web store: the case moves to `in_progress`, this user's previous
   * offer is replaced (a helper helps in one way at a time), and the reporter
   * gets a `help` notification — which is also the `notification` event's first
   * real use, a Phase 3 hook exercised in Phase 2.
   */
  async offerHelp(id: string, dto: OfferHelpDto, user: AuthenticatedUser): Promise<Case> {
    const existing = await this.prisma.case.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Signalement introuvable.');

    const row = await this.prisma.$transaction(async (tx) => {
      // One helper row per person: a new offer supersedes the previous one.
      await tx.caseHelper.deleteMany({ where: { caseId: id, userId: user.sub } });
      await tx.caseHelper.create({
        data: {
          caseId: id,
          userId: user.sub,
          helpType: dto.helpType as HelpType,
          message: dto.message ?? null,
        },
      });

      return tx.case.update({
        where: { id },
        data: { status: existing.status === 'open' ? 'in_progress' : existing.status },
        include: CASE_INCLUDE,
      });
    });

    const serialized = caseRowToCase(row as unknown as CaseRowWithRelations);
    this.realtime.caseUpdated({ case: serialized });
    this.realtime.helpOffered({
      caseId: id,
      helper: { id: user.sub, name: user.name, avatar: '' },
      helpType: dto.helpType as HelpType,
    });

    // Notifying yourself is noise, not information.
    if (existing.reporterId !== user.sub) {
      await this.notifications.notify(existing.reporterId, 'help', user.name, `/cases/${id}`);
    }

    return serialized;
  }

  /**
   * `POST /cases/:id/confirm` — "do you see this animal?".
   *
   * The answer is a **vote**, and it is only worth something from somebody
   * standing next to the animal: the distance is measured here, on the
   * server, and the answer is refused when it is too far. The web checks the
   * same radius on the device first — but the device is the client's, so this
   * is the check that counts.
   *
   * What one answer does (the web's own arithmetic, so the two never disagree):
   *
   *   - "yes"  → `trust.confirmations` +1, score +0.12; two "yes" raise the
   *              case to `verified` and the reporter is notified.
   *   - "no"   → score −0.12; two "no" (and more "no" than "yes") make the
   *              case `suspicious` and send it back to the moderators.
   *
   * One answer per account, and never the reporter's own report.
   */
  async confirm(id: string, dto: ConfirmCaseDto, user: AuthenticatedUser): Promise<Case> {
    const existing = await this.prisma.case.findUnique({ where: { id }, include: CASE_INCLUDE });
    if (!existing) throw new NotFoundException('Signalement introuvable.');

    if (existing.reporterId === user.sub) {
      throw new ApiError(
        403,
        'CONFIRM_OWN_REPORT',
        'Vous ne pouvez pas confirmer votre propre signalement.',
      );
    }

    // One answer per account — the unique index would say the same thing.
    if (existing.confirms.some((c) => c.userId === user.sub)) {
      throw new ApiError(
        409,
        'CONFIRM_ALREADY_ANSWERED',
        'Vous avez déjà répondu pour ce signalement.',
      );
    }

    // The distance, measured here. The client sent a position; the server
    // decides whether it is close enough.
    const km = distanceKm({ lat: dto.lat, lng: dto.lng }, { lat: existing.lat, lng: existing.lng });
    if (km > CONFIRM_RADIUS_KM) {
      throw new ApiError(
        403,
        'CONFIRM_TOO_FAR',
        `Trop loin de l’animal (${km.toFixed(1)} km) : la réponse ne compte que sur place.`,
      );
    }

    try {
      await this.prisma.caseConfirm.create({
        data: { caseId: id, userId: user.sub, seen: dto.seen },
      });
    } catch (error) {
      // Two answers at the same time from the same account: the index decides.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(
          409,
          'CONFIRM_ALREADY_ANSWERED',
          'Vous avez déjà répondu pour ce signalement.',
        );
      }
      throw error;
    }

    const confirmedBy = existing.confirms
      .filter((c) => c.seen)
      .map((c) => c.userId)
      .concat(dto.seen ? [user.sub] : []);
    const deniedBy = existing.confirms
      .filter((c) => !c.seen)
      .map((c) => c.userId)
      .concat(dto.seen ? [] : [user.sub]);

    const confirmations = existing.trustConfirmations + (dto.seen ? 1 : 0);
    const score = clampScore(existing.trustScore + (dto.seen ? CONFIRM_SCORE_YES : CONFIRM_SCORE_NO));
    // Two "no" and more "no" than "yes": the report goes back to the moderators.
    const doubtful = deniedBy.length >= 2 && deniedBy.length > confirmedBy.length;
    const level = doubtful
      ? 'suspicious'
      : confirmedBy.length >= 2
        ? 'verified'
        : existing.trustLevel;

    const row = await this.prisma.case.update({
      where: { id },
      data: {
        trustConfirmations: confirmations,
        trustScore: score,
        trustLevel: level,
        moderation: doubtful ? 'pending' : existing.moderation,
        // A "no" changes nothing about the report itself; only a "yes" means
        // somebody is looking at the animal right now.
        ...(dto.seen ? { updatedAt: new Date() } : {}),
      },
      include: CASE_INCLUDE,
    });

    if (dto.seen) {
      await this.notifications.notify(existing.reporterId, 'caseConfirmed', existing.title, `/cases/${id}`);
    }

    const serialized = caseRowToCase(row as unknown as CaseRowWithRelations);
    this.realtime.caseUpdated({ case: serialized });
    return serialized;
  }

  /**
   * `GET /me/cases` — the reports the caller made.
   *
   * Every status, moderation included: a report still held for moderation is
   * invisible to everybody else, so this is the only place its reporter can
   * follow it.
   */
  async mine(userId: string, page = 1, pageSize = 20): Promise<Paginated<Case>> {
    const p = Math.max(1, page);
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
    const where: Prisma.CaseWhereInput = { reporterId: userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        include: CASE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.prisma.case.count({ where }),
    ]);
    return {
      items: rows.map((row) => caseRowToCase(row as unknown as CaseRowWithRelations)),
      total,
      page: p,
      pageSize: size,
    };
  }

  /**
   * `PATCH /cases/:id` — the reporter corrects their own report.
   *
   * A report still held for moderation changes straight away (nobody has seen
   * it yet); a public one waits for a moderator, because the people already
   * helping on it are acting on the text as it is. The proposed change is
   * stored as `pendingEdit` and merged by `PATCH /admin/cases/:id/edit`.
   */
  async update(id: string, dto: UpdateCaseDto, user: AuthenticatedUser): Promise<Case> {
    const existing = await this.prisma.case.findUnique({ where: { id }, include: CASE_INCLUDE });
    if (!existing) throw new NotFoundException('Signalement introuvable.');
    if (existing.reporterId !== user.sub) {
      throw new ApiError(
        403,
        'CASE_NOT_OWNER',
        'Seul l’auteur du signalement peut le modifier.',
      );
    }

    const patch: { description?: string; conditionTags?: string[] } = {};
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.conditionTags !== undefined) patch.conditionTags = dto.conditionTags;

    const held = existing.moderation === 'pending';
    const data: Prisma.CaseUpdateInput = held
      ? { ...patch, pendingEdit: Prisma.DbNull }
      : { pendingEdit: { ...patch, at: new Date().toISOString() } as Prisma.InputJsonValue };

    const row = await this.prisma.case.update({
      where: { id },
      data,
      include: CASE_INCLUDE,
    });

    const serialized = caseRowToCase(row as unknown as CaseRowWithRelations);
    this.realtime.caseUpdated({ case: serialized });
    return serialized;
  }

  /**
   * `DELETE /cases/:id` — the reporter removes their own report.
   *
   * The row goes with its helpers, confirmations and flags (the foreign keys
   * cascade), and the notifications that pointed at it go too: a notification
   * about a report that no longer exists is a dead link.
   */
  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.case.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Signalement introuvable.');
    if (existing.reporterId !== user.sub) {
      throw new ApiError(
        403,
        'CASE_NOT_OWNER',
        'Seul l’auteur du signalement peut le supprimer.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.case.delete({ where: { id } }),
      this.prisma.notification.deleteMany({
        where: { href: { startsWith: `/cases/${id}` } },
      }),
    ]);
  }

  /**
   * `PATCH /admin/cases/:id/edit` — the moderator decides on a proposed change.
   *
   * `approve` merges the change into the public version; `reject` drops it and
   * leaves the report as it was. Either way the reporter is told which it was.
   */
  async decideEdit(
    id: string,
    decision: 'approve' | 'reject',
    admin: AuthenticatedUser,
  ): Promise<Case> {
    const existing = await this.prisma.case.findUnique({ where: { id }, include: CASE_INCLUDE });
    if (!existing) throw new NotFoundException('Signalement introuvable.');

    const edit = (existing.pendingEdit ?? undefined) as CaseEdit | undefined;
    if (!edit) {
      throw new ApiError(404, 'NO_PENDING_EDIT', 'Ce signalement n’a pas de modification en attente.');
    }

    const data: Prisma.CaseUpdateInput =
      decision === 'approve'
        ? {
            ...(edit.description !== undefined ? { description: edit.description } : {}),
            ...(edit.conditionTags !== undefined ? { conditionTags: edit.conditionTags } : {}),
            pendingEdit: Prisma.DbNull,
          }
        : { pendingEdit: Prisma.DbNull };

    const row = await this.prisma.case.update({
      where: { id },
      data,
      include: CASE_INCLUDE,
    });

    await this.notifications.notify(
      existing.reporterId,
      decision === 'approve' ? 'editApproved' : 'editRejected',
      existing.title,
      `/cases/${id}`,
    );

    this.logger.log(`Case ${id} edit ${decision === 'approve' ? 'approved' : 'rejected'} by ${admin.sub}.`);
    const serialized = caseRowToCase(row as unknown as CaseRowWithRelations);
    this.realtime.caseUpdated({ case: serialized });
    return serialized;
  }

  /**
   * The reports waiting for a moderator — the second review queue
   * (`GET /admin/pending-edits`).
   */
  async pendingEdits(): Promise<PendingEdit[]> {
    const rows = await this.prisma.case.findMany({
      where: { pendingEdit: { not: Prisma.DbNull } },
      include: CASE_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => ({
      kind: 'case' as const,
      id: row.id,
      title: row.title,
      ownerId: row.reporterId,
      ownerName: row.reporter.name,
      at: pendingEditAt(row.pendingEdit, row.updatedAt),
      edit: row.pendingEdit as unknown as CaseEdit,
    }));
  }

  /** `POST /cases/:id/flag` — three flags and the case waits for a moderator. */
  async flag(id: string, dto: FlagCaseDto, user: AuthenticatedUser): Promise<Case> {
    const existing = await this.prisma.case.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Signalement introuvable.');

    await this.prisma.caseFlag.create({
      data: { caseId: id, userId: user.sub, reason: dto.reason ?? null },
    });

    const flags = existing.trustFlags + 1;
    const row = await this.prisma.case.update({
      where: { id },
      data: { trustFlags: flags, moderation: flags >= 3 ? 'pending' : existing.moderation },
      include: CASE_INCLUDE,
    });

    const serialized = caseRowToCase(row as unknown as CaseRowWithRelations);
    this.realtime.caseUpdated({ case: serialized });
    return serialized;
  }

  // ─────────────────────────── moderation ───────────────────────────

  /** `PATCH /admin/cases/:id/moderation`. Admin only — checked by the controller. */
  async moderate(id: string, decision: 'approved' | 'hidden', admin: AuthenticatedUser): Promise<Case> {
    const existing = await this.prisma.case.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Signalement introuvable.');

    const row = await this.prisma.case.update({
      where: { id },
      data: { moderation: decision },
      include: CASE_INCLUDE,
    });

    this.logger.log(`Case ${id} moderated as "${decision}" by ${admin.sub}.`);
    const serialized = caseRowToCase(row as unknown as CaseRowWithRelations);
    this.realtime.caseUpdated({ case: serialized });
    return serialized;
  }

  // ─────────────────────────── internals ───────────────────────────

  /** The shared bbox/nearby statement: ids plus the matching total, one round trip. */
  private async pageOf(
    where: Prisma.Sql[],
    page: number,
    pageSize: number,
  ): Promise<Array<{ id: string; total: bigint }>> {
    // `Prisma.join([])` throws, and an unfiltered list is a legitimate request
    // (the admin queue with no bbox and no filters). `TRUE` is a real predicate
    // that keeps the statement shape identical.
    const condition = where.length > 0 ? Prisma.join(where, ' AND ') : Prisma.sql`TRUE`;

    return this.prisma.$queryRaw<Array<{ id: string; total: bigint }>>(
      Prisma.sql`
        SELECT id, COUNT(*) OVER () AS total
        FROM cases
        WHERE ${condition}
        ORDER BY CASE triage WHEN 'urgent' THEN 0 WHEN 'monitoring' THEN 1 ELSE 2 END,
                 "createdAt" DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
    );
  }

  /** Loads the rows Prisma-style, in the order the raw statement produced. */
  private async withRelations(
    rows: Array<{ id: string; total: bigint }>,
    page: number,
    pageSize: number,
  ): Promise<Paginated<Case>> {
    if (rows.length === 0) return { items: [], total: 0, page, pageSize };
    return {
      items: await this.loadRows(rows.map((r) => r.id)),
      total: Number(rows[0].total),
      page,
      pageSize,
    };
  }

  private async loadRows(ids: string[]): Promise<Case[]> {
    const rows = await this.prisma.case.findMany({
      where: { id: { in: ids } },
      include: CASE_INCLUDE,
    });

    const byId = new Map(rows.map((r) => [r.id, r]));
    // The SQL already sorted urgent-first; keep that order rather than whatever
    // Prisma returns, because the map depends on it.
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .map((row) => caseRowToCase(row as unknown as CaseRowWithRelations));
  }

  /** Re-measures the distance the KNN ordering used, for the response body. */
  private async withDistances(
    cases: Case[],
    lat: number,
    lng: number,
  ): Promise<Array<Case & { distanceKm: number }>> {
    if (cases.length === 0) return [];
    const rows = await this.prisma.$queryRaw<Array<{ id: string; km: number }>>(
      Prisma.sql`
        SELECT id, round((ST_Distance(location, ${point(lat, lng)}) / 1000)::numeric, 1) AS km
        FROM cases WHERE id IN (${Prisma.join(cases.map((c) => c.id))})
      `,
    );
    const byId = new Map(rows.map((r) => [r.id, Number(r.km)]));
    return cases.map((c) => ({ ...c, distanceKm: byId.get(c.id) ?? 0 }));
  }

  /** Reads back the reporter, refusing an account that has been deleted. */
  private async liveReporter(userId: string) {
    const row = await this.users.findById(userId);
    // `passwordHash == null` is the marker `anonymize()` writes.
    if (!row || !row.passwordHash) {
      throw new ApiError(401, 'AUTH_ACCOUNT_DELETED', 'Ce compte n\'existe plus.');
    }
    return row;
  }

  /**
   * Asks the people around the animal whether they see it.
   *
   * Only a public report asks: a report held for moderation is not on the map
   * yet, and asking people to confirm it would leak it. The distance is the
   * same 3 km the web uses, and the reporter is never asked.
   */
  private async askAround(row: Case): Promise<void> {
    const people = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT id FROM users
        WHERE lat IS NOT NULL AND lng IS NOT NULL
          AND "passwordHash" IS NOT NULL
          AND id <> ${row.reporter.id}
          AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
                ${point(row.location.lat, row.location.lng)},
                ${Math.round(CONFIRM_ASK_RADIUS_KM * 1000)}
              )
      `,
    );

    for (const person of people) {
      await this.notifications.notify(person.id, 'confirmAsk', row.title, `/cases/${row.id}#verify`);
    }
  }

  /** An `emergencyZoneId` that does not exist is a 400, not a foreign-key 409. */
  private async assertEmergencyZone(zoneId?: string): Promise<void> {
    if (!zoneId) return;
    const zone = await this.prisma.emergencyZone.findUnique({ where: { id: zoneId } });
    if (!zone) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Unknown emergencyZoneId: ${zoneId}.`);
    }
  }

  /**
   * Is any of these hashes already in `photo_hashes`?
   *
   * The comparison happens in SQL: Postgres turns each stored hash into a 64-bit
   * word and counts the differing bits, which is the Hamming distance without
   * moving every hash through Node. `photo_hashes` keeps the permanent record;
   * the probes themselves are short-lived.
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
        WHERE "subjectType" = 'case'
          AND "createdAt" > ${cutoff}
          AND (${Prisma.join(clauses, ' OR ')})
        LIMIT 1
      `,
    );

    return rows.length > 0;
  }
}

/** `moderation` gate for everything the public may read. */
function publicGate(viewer?: Viewer): Prisma.Sql {
  // A reporter also sees the report that is being held back — otherwise they
  // would have no way to find out what happened to it. An admin's full view is
  // `GET /admin/cases`, which is ungated by design.
  if (viewer) {
    return Prisma.sql`(moderation IS NULL OR moderation = 'approved' OR "reporterId" = ${viewer.sub})`;
  }
  return Prisma.sql`(moderation IS NULL OR moderation = 'approved')`;
}

/** The plain-column filters, shared by the public list and the admin queue. */
function columnFilters(query: Partial<CaseListQuery>): Prisma.Sql[] {
  const out: Prisma.Sql[] = [];
  if (query.triage) out.push(Prisma.sql`triage = ${query.triage}::"Triage"`);
  if (query.species) out.push(Prisma.sql`species = ${query.species}::"Species"`);
  if (query.category) out.push(Prisma.sql`category = ${query.category}::"CaseCategory"`);
  if (query.status) out.push(Prisma.sql`status = ${query.status}::"CaseStatus"`);
  if (query.zoneId) out.push(Prisma.sql`"emergencyZoneId" = ${query.zoneId}`);
  return out;
}

/** `location && ST_MakeEnvelope(minLng, minLat, maxLng, maxLat, 4326)`. */
function envelope(box: { minLng: number; minLat: number; maxLng: number; maxLat: number }): Prisma.Sql {
  return Prisma.sql`ST_MakeEnvelope(${box.minLng}, ${box.minLat}, ${box.maxLng}, ${box.maxLat}, 4326)::geography`;
}

/** The trust score never leaves [0, 1] — an answer moves it, it never breaks it. */
function clampScore(score: number): number {
  return Math.min(1, Math.max(0, Math.round(score * 100) / 100));
}

function point(lat: number, lng: number): Prisma.Sql {
  return Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}

/** The first GPS and the first date across the case's photos, or nothing. */
function mergeExif(
  probes: Array<{ exif: { gps?: { lat: number; lng: number }; takenAt?: Date } }>,
): { gps?: { lat: number; lng: number }; takenAt?: Date } {
  const out: { gps?: { lat: number; lng: number }; takenAt?: Date } = {};
  const withGps = probes.find((p) => p.exif.gps);
  if (withGps?.exif.gps) out.gps = withGps.exif.gps;
  const withDate = probes.find((p) => p.exif.takenAt);
  if (withDate?.exif.takenAt) out.takenAt = withDate.exif.takenAt;
  return out;
}



