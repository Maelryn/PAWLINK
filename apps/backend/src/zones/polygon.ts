import { ApiError } from '../common/filters/http-exception.filter';

/**
 * GeoJSON polygon validation for the emergency zones (docs/BACKEND_PROMPT.md
 * §3.3). Pure and exported so the unit tests can assert every rejection
 * directly, without an HTTP layer.
 *
 * The client sends GeoJSON; PostGIS stores it through `ST_GeomFromGeoJSON`.
 * Anything between those two points that is not a sane, closed Algerian
 * polygon is a 400 here — never a Postgres error and never a stray geometry
 * on the map.
 */

/** Algeria with a little breathing room at the borders. */
export const ALGERIA_BBOX = { minLng: -9.5, minLat: 18.5, maxLng: 12.5, maxLat: 38 } as const;

export interface GeoJsonPolygon {
  type: 'Polygon';
  /** Rings of `[lng, lat]` positions — the only coordinate order allowed here. */
  coordinates: number[][][];
}

function reject(reason: string): never {
  throw new ApiError(400, 'ZONE_INVALID_POLYGON', `Polygone invalide : ${reason}.`);
}

function isPosition(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

/**
 * Validates and normalizes a client polygon.
 *
 * - `type` must be exactly `Polygon` (no MultiPolygon, no Feature wrapper);
 * - the first ring is the exterior ring: ≥ 4 positions and **closed**
 *   (first === last), which is what GeoJSON requires and what `ST_GeomFromGeoJSON`
 *   silently accepts either way;
 * - every position is `[lng, lat]` inside the Algeria bbox.
 */
export function parsePolygon(input: unknown): GeoJsonPolygon {
  if (typeof input !== 'object' || input === null) reject('attendu un objet GeoJSON');
  const candidate = input as { type?: unknown; coordinates?: unknown };
  if (candidate.type !== 'Polygon') reject('seul le type "Polygon" est accepté');
  if (!Array.isArray(candidate.coordinates) || candidate.coordinates.length === 0) {
    reject('coordinates doit contenir au moins un anneau');
  }

  const rings: number[][][] = [];
  for (const [index, ring] of candidate.coordinates.entries()) {
    if (!Array.isArray(ring)) reject(`l’anneau ${index} n’est pas une liste de positions`);
    if (ring.length < 4) reject(`l’anneau ${index} doit contenir au moins 4 positions`);
    for (const position of ring) {
      if (!isPosition(position)) reject('chaque position doit être [lng, lat]');
      const [lng, lat] = position;
      if (lng < ALGERIA_BBOX.minLng || lng > ALGERIA_BBOX.maxLng) {
        reject(`longitude ${lng} hors d’Algérie`);
      }
      if (lat < ALGERIA_BBOX.minLat || lat > ALGERIA_BBOX.maxLat) {
        reject(`latitude ${lat} hors d’Algérie`);
      }
    }
    const first = (ring[0] as number[])[0] === (ring[ring.length - 1] as number[])[0] &&
      (ring[0] as number[])[1] === (ring[ring.length - 1] as number[])[1];
    if (!first) reject(`l’anneau ${index} n’est pas fermé (la première position doit être la dernière)`);
    rings.push(ring.map((p) => [p[0], p[1]]));
  }

  return { type: 'Polygon', coordinates: rings };
}
