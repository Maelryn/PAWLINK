import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import algeriaBoundary from './algeria-boundary.json';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Geospatial helpers for the anti-abuse pipeline (docs/BACKEND_PROMPT.md §3.5).
 *
 * The only generic query here is `inAlgeria`: everything else that needs space
 * (`nearest services`, `nearest helpers`) lives in the module that asks for it,
 * because the `location`/`polygon` columns are `geography` and each question has
 * its own shape — trying to compose one reusable SQL builder produced an unsafe,
 * unreadable abstraction instead.
 */

/** A point on the wire — `{ lat, lng }` everywhere, GeoJSON only inside polygons. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** The web mock's fallback box (apps/web/lib/trust.ts), kept as a last resort. */
export const ALGERIA_BBOX = { minLat: 18.9, maxLat: 37.2, minLng: -8.7, maxLng: 12 };

/** Natural Earth 50m, simplified to 95 vertices (Douglas-Peucker, 0.05° tolerance). */
export const ALGERIA_POLYGON = algeriaBoundary.geometry as unknown as GeoJSON.Polygon;

/** Where the checked-in polygon came from, so its provenance is not folklore. */
export const ALGERIA_SOURCE = algeriaBoundary.properties.source as string;

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Is this point inside Algeria? One `ST_Within` against the checked-in boundary.
   *
   * Geometry (not geography) on purpose: the geography predicate set is the
   * fragile path in PostGIS, and this is a point-in-polygon test on SRID 4326
   * where plain geometry is exact and needs no spheroidal maths.
   *
   * On failure it degrades to the web mock's rectangle rather than dropping the
   * check — a missing polygon must not silently make every report look clean —
   * and says so in `detail`.
   */
  async inAlgeria(point: LatLng): Promise<{ ok: boolean; detail: string }> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ inside: boolean }>>(
        Prisma.sql`
          SELECT ST_Within(
                   ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326),
                   ST_GeomFromGeoJSON(${JSON.stringify(ALGERIA_POLYGON)})
                 ) AS inside
        `,
      );

      const inside = rows[0]?.inside === true;
      return {
        ok: inside,
        detail: inside
          ? 'Le point est en Algérie'
          : `Le point (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}) est hors d'Algérie`,
      };
    } catch (error) {
      const inside = inBbox(point);
      return {
        ok: inside,
        detail:
          `Vérifié avec le rectangle de secours (${inside ? 'dedans' : 'dehors'}) : ` +
          `${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /** Bbox containment — the documented fallback, and what the unit tests pin. */
  inBbox(point: LatLng): boolean {
    return (
      point.lat >= ALGERIA_BBOX.minLat &&
      point.lat <= ALGERIA_BBOX.maxLat &&
      point.lng >= ALGERIA_BBOX.minLng &&
      point.lng <= ALGERIA_BBOX.maxLng
    );
  }

  /** The checked-in polygon's own bounding box, for sanity checks and docs. */
  polygonBbox(): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    for (const [lng, lat] of ALGERIA_POLYGON.coordinates[0]) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    return { minLat, maxLat, minLng, maxLng };
  }
}

/** Great-circle distance in km — the web's own formula, kept for parity in tests. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function inBbox(point: LatLng): boolean {
  return (
    point.lat >= ALGERIA_BBOX.minLat &&
    point.lat <= ALGERIA_BBOX.maxLat &&
    point.lng >= ALGERIA_BBOX.minLng &&
    point.lng <= ALGERIA_BBOX.maxLng
  );
}
