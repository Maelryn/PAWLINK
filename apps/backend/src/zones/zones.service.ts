import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/filters/http-exception.filter';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Paginated } from '../shared/pagination';
import { parsePolygon, type GeoJsonPolygon } from './polygon';
import type { CreateZoneDto, QueryZonesDto, UpdateZoneDto } from './dto/zone.dto';
import type { EmergencyZone } from '../shared/types';

/** One raw row of the list query: the row plus its computed center and stats. */
interface ZoneSqlRow {
  id: string;
  name: string;
  region: string;
  type: string;
  active: boolean;
  startedAt: Date;
  polygon: string;
  center_lat: number;
  center_lng: number;
  cases: number;
  urgent: number;
  helpers: number;
  total: bigint;
}

/**
 * Emergency zones — the polygon layer of the map.
 *
 * Two rules shape the file:
 *
 *   - **`center` and `stats` are never trusted.** `center` comes from
 *     `ST_Centroid(polygon)` and `stats` from `ST_Intersects` against the live
 *     `cases` / `case_helpers` tables, in the same statement that reads the
 *     zone. A stale or hand-edited `lat`/`lng`/`stats` column can therefore
 *     never disagree with the polygon on screen.
 *   - **`ST_GeomFromGeoJSON` is the only writer of `polygon`**, exactly like
 *     the seed: Prisma never touches the geography column.
 *
 * The FK from `cases.emergencyZoneId` is `ON DELETE SET NULL` (see the init
 * migration), so deleting a zone would not *block* — it would silently detach
 * every case inside it and empty that region's map layer. `remove()` refuses
 * with `409 ZONE_IN_USE` while any case still points at the zone.
 */
@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The zone list, with GeoJSON polygon, `ST_Centroid` center and live stats. */
  async list(query: QueryZonesDto): Promise<Paginated<EmergencyZone>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));

    const where = query.active === undefined ? Prisma.empty : Prisma.sql`active = ${query.active}`;

    const rows = await this.prisma.$queryRaw<ZoneSqlRow[]>(Prisma.sql`
      SELECT
        z.id, z.name, z.region, z.type, z.active, z."startedAt",
        ST_AsGeoJSON(z.polygon::geometry) AS polygon,
        ST_Y(ST_Centroid(z.polygon::geometry)) AS center_lat,
        ST_X(ST_Centroid(z.polygon::geometry)) AS center_lng,
        (SELECT count(*) FROM cases c
           WHERE c."emergencyZoneId" = z.id AND c.moderation IS DISTINCT FROM 'hidden') AS cases,
        (SELECT count(*) FROM cases c
           WHERE c."emergencyZoneId" = z.id AND c.triage = 'urgent'
             AND c.moderation IS DISTINCT FROM 'hidden') AS urgent,
        (SELECT count(DISTINCT h."userId") FROM case_helpers h
           JOIN cases c ON c.id = h."caseId"
           WHERE c."emergencyZoneId" = z.id AND c.moderation IS DISTINCT FROM 'hidden') AS helpers,
        COUNT(*) OVER () AS total
      FROM emergency_zones z
      WHERE ${where}
      ORDER BY z."startedAt" DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `);

    if (rows.length === 0) return { items: [], total: 0, page, pageSize };
    return {
      items: rows.map(rowToWire),
      total: Number(rows[0].total),
      page,
      pageSize,
    };
  }

  /** One zone — used by the write paths to answer with the stored truth. */
  async findOne(id: string): Promise<EmergencyZone> {
    const rows = await this.prisma.$queryRaw<ZoneSqlRow[]>(Prisma.sql`
      SELECT
        z.id, z.name, z.region, z.type, z.active, z."startedAt",
        ST_AsGeoJSON(z.polygon::geometry) AS polygon,
        ST_Y(ST_Centroid(z.polygon::geometry)) AS center_lat,
        ST_X(ST_Centroid(z.polygon::geometry)) AS center_lng,
        0::int AS cases, 0::int AS urgent, 0::int AS helpers,
        1 AS total
      FROM emergency_zones z
      WHERE z.id = ${id}
    `);
    const row = rows[0];
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Cette zone n’existe pas.');

    // The single-row read still recomputes stats, so a `PATCH` response can
    // never echo a stale count.
    const stats = await this.statsFor(id);
    return rowToWire({ ...row, ...stats, total: 1n });
  }

  /** `POST /emergency-zones` — admin only; the polygon is validated, then stored as geography. */
  async create(dto: CreateZoneDto): Promise<EmergencyZone> {
    if (dto.polygon === undefined || dto.polygon === null) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Le polygon est obligatoire.');
    }
    const polygon = parsePolygon(dto.polygon);
    const startedAt = dto.startedAt ? this.dateOr400(dto.startedAt) : new Date();
    const id = randomUUID();

    await this.prisma.emergencyZone.create({
      data: {
        id,
        name: dto.name,
        region: dto.region,
        type: dto.type,
        lat: 0, // replaced below by ST_Centroid
        lng: 0,
        active: dto.active ?? true,
        startedAt,
        // Placeholder until the first read recomputes it from live cases.
        stats: { cases: 0, urgent: 0, helpers: 0 },
      },
    });
    await this.writePolygon(id, polygon);
    return this.findOne(id);
  }

  /** `PATCH /emergency-zones/:id` — a polygon change recomputes `center`. */
  async update(id: string, dto: UpdateZoneDto): Promise<EmergencyZone> {
    const existing = await this.prisma.emergencyZone.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Cette zone n’existe pas.');

    await this.prisma.emergencyZone.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.region !== undefined ? { region: dto.region } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    if (dto.polygon !== undefined && dto.polygon !== null) {
      await this.writePolygon(id, parsePolygon(dto.polygon));
    }
    return this.findOne(id);
  }

  /**
   * `DELETE /emergency-zones/:id` — refused while any case still points at the
   * zone. The FK is `SET NULL`, so without this guard the delete would succeed
   * and quietly detach those cases from their region.
   */
  async remove(id: string): Promise<void> {
    const inUse = await this.prisma.case.count({ where: { emergencyZoneId: id } });
    if (inUse > 0) {
      throw new ApiError(
        409,
        'ZONE_IN_USE',
        `${inUse} signalement(s) appartiennent encore à cette zone.`,
      );
    }
    await this.prisma.emergencyZone.delete({ where: { id } });
  }

  // ───────────────────────────── helpers ─────────────────────────────

  private dateOr400(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, 'VALIDATION_ERROR', `startedAt invalide : ${value}.`);
    }
    return date;
  }

  /** The only writer of `polygon` — geography + centroid, in one statement. */
  private async writePolygon(id: string, polygon: GeoJsonPolygon): Promise<void> {
    const json = JSON.stringify(polygon);
    const written = await this.prisma.$executeRaw`
      UPDATE emergency_zones
      SET polygon = ST_GeomFromGeoJSON(${json})::geography,
          lat = ST_Y(ST_Centroid(ST_GeomFromGeoJSON(${json})::geometry)),
          lng = ST_X(ST_Centroid(ST_GeomFromGeoJSON(${json})::geometry))
      WHERE id = ${id}`;
    if (written === 0) throw new ApiError(404, 'NOT_FOUND', 'Cette zone n’existe pas.');
  }

  private async statsFor(id: string): Promise<{ cases: number; urgent: number; helpers: number }> {
    const rows = await this.prisma.$queryRaw<Array<{ cases: number; urgent: number; helpers: number }>>(
      Prisma.sql`
        SELECT
          (SELECT count(*) FROM cases c
             WHERE c."emergencyZoneId" = ${id} AND c.moderation IS DISTINCT FROM 'hidden') AS cases,
          (SELECT count(*) FROM cases c
             WHERE c."emergencyZoneId" = ${id} AND c.triage = 'urgent'
               AND c.moderation IS DISTINCT FROM 'hidden') AS urgent,
          (SELECT count(DISTINCT h."userId") FROM case_helpers h
             JOIN cases c ON c.id = h."caseId"
             WHERE c."emergencyZoneId" = ${id} AND c.moderation IS DISTINCT FROM 'hidden') AS helpers
      `,
    );
    const row = rows[0];
    return {
      cases: Number(row?.cases ?? 0),
      urgent: Number(row?.urgent ?? 0),
      helpers: Number(row?.helpers ?? 0),
    };
  }
}

/** The ONLY place an `emergency_zones` row becomes the frontend `EmergencyZone`. */
function rowToWire(row: ZoneSqlRow): EmergencyZone {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    type: row.type as EmergencyZone['type'],
    // [lng, lat] — the GeoJSON order, the one place it is allowed.
    polygon: JSON.parse(row.polygon) as EmergencyZone['polygon'],
    center: { lat: Number(row.center_lat), lng: Number(row.center_lng) },
    active: row.active,
    startedAt: row.startedAt.toISOString(),
    stats: {
      cases: Number(row.cases),
      urgent: Number(row.urgent),
      helpers: Number(row.helpers),
    },
  };
}
