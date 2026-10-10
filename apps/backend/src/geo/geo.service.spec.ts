import { describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '@prisma/client';
import { GeoService, distanceKm, inBbox } from './geo.service';
import { ALGERIA_BBOX, ALGERIA_POLYGON, ALGERIA_SOURCE } from './geo.service';

/**
 * Points whose inside/outside status is not in doubt, copied from the web's own
 * demo data and from outside the country. The polygon must agree with the web
 * mock's rectangle on every one of them (PHASE2_PLAN.md step 1).
 */
const INSIDE: Array<[string, { lat: number; lng: number }]> = [
  ['Alger centre', { lat: 36.7538, lng: 3.0588 }],
  ['Tizi Ouzou (the seeded wildfire)', { lat: 36.6352, lng: 4.1951 }],
  ['Oran', { lat: 35.6969, lng: -0.6308 }],
  ['Béchar', { lat: 31.6166, lng: -2.22 }],
  ['Tamanrasset', { lat: 22.788, lng: 5.5314 }],
  ['Djanet, south-east corner', { lat: 24.5531, lng: 9.4844 }],
];

const OUTSIDE: Array<[string, { lat: number; lng: number }]> = [
  ['Paris', { lat: 48.8566, lng: 2.3522 }],
  ['Niamey', { lat: 13.5137, lng: 2.1098 }],
  ['Rome', { lat: 41.9028, lng: 12.4964 }],
  ['the Mediterranean off Algiers', { lat: 37.4, lng: 4.0 }],
];

/**
 * Inside the fallback rectangle but outside the real country — the polygon is
 * strictly stricter than the bbox, which is the whole point of using it.
 */
const INSIDE_BBOX_ONLY: Array<[string, { lat: number; lng: number }]> = [
  ['Mali, west of Tamanrasset', { lat: 22, lng: -4 }],
  ['Niger, south-east corner of the box', { lat: 20, lng: 12 }],
  ['Libya, east of the Algerian border', { lat: 25, lng: 10.5 }],
  // a whole capital city the rectangle would have let through: Tunis sits at
  // lng 10.18, well inside the fallback box, ~200 km past the border
  ['Tunis', { lat: 36.8065, lng: 10.1815 }],
];

/** Ray casting, so the test validates the polygon itself rather than trusting it. */
function rayCast(point: { lat: number; lng: number }, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

describe('the checked-in Algeria boundary', () => {
  it('is a closed polygon with a sane vertex count', () => {
    const ring = ALGERIA_POLYGON.coordinates[0];
    expect(ALGERIA_POLYGON.type).toBe('Polygon');
    expect(ring.length).toBeGreaterThan(50);
    expect(ring.length).toBeLessThan(150); // "simplified" has to mean something
    expect(ring[0]).toEqual(ring[ring.length - 1]); // GeoJSON rings must close
  });

  it('records where it came from', () => {
    expect(ALGERIA_SOURCE).toMatch(/Natural Earth/i);
  });

  it('agrees with the web mock bbox on every city and neighbour', () => {
    // only where both are meant to agree — the polygon is deliberately stricter
    // than the rectangle (see the next test)
    for (const [, point] of [...INSIDE, ...OUTSIDE]) {
      expect(rayCast(point, ALGERIA_POLYGON.coordinates[0])).toBe(inBbox(point));
    }
  });

  it('is stricter than the bbox: neighbouring countries are not Algeria', () => {
    for (const [, point] of INSIDE_BBOX_ONLY) {
      expect(inBbox(point)).toBe(true); // the rectangle would have accepted it
      expect(rayCast(point, ALGERIA_POLYGON.coordinates[0])).toBe(false);
    }
  });

  it('contains the whole country and none of its neighbours', () => {
    for (const [, point] of INSIDE) {
      expect(rayCast(point, ALGERIA_POLYGON.coordinates[0])).toBe(true);
    }
    for (const [, point] of OUTSIDE) {
      expect(rayCast(point, ALGERIA_POLYGON.coordinates[0])).toBe(false);
    }
  });

  it('has a bounding box close to the fallback box', () => {
    // a polygon whose bbox were wildly different would be the wrong country
    expect(ALGERIA_BBOX.minLat).toBeGreaterThan(18);
    expect(ALGERIA_BBOX.maxLat).toBeLessThan(38);
  });
});

describe('distanceKm', () => {
  it('matches known distances', () => {
    // Alger → Oran, ~351 km by air (the road is ~420 km)
    expect(distanceKm({ lat: 36.7538, lng: 3.0588 }, { lat: 35.6969, lng: -0.6308 })).toBeCloseTo(351.2, 0);
    // Alger → Paris, ~1347 km — a second pair so a systematic error cannot pass
    expect(distanceKm({ lat: 36.7538, lng: 3.0588 }, { lat: 48.8566, lng: 2.3522 })).toBeCloseTo(1347, -1);
  });

  it('is zero for the same point and symmetric otherwise', () => {
    const a = { lat: 36.75, lng: 3.05 };
    const b = { lat: 36.6, lng: 4.2 };
    expect(distanceKm(a, a)).toBe(0);
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 10);
  });
});

describe('GeoService.inAlgeria', () => {
  function makeService(rows: Array<{ inside: boolean }>) {
    const prisma = {
      $queryRaw: jest.fn(async () => rows),
    };
    return { service: new GeoService(prisma as never), prisma };
  }

  it('returns ok:true with a detail string when ST_Within says inside', async () => {
    const { service } = makeService([{ inside: true }]);
    const result = await service.inAlgeria({ lat: 36.75, lng: 3.06 });

    expect(result.ok).toBe(true);
    expect(result.detail).toMatch(/Algérie/);
  });

  it('returns ok:false and names the coordinates when outside', async () => {
    const { service } = makeService([{ inside: false }]);
    const result = await service.inAlgeria({ lat: 48.85, lng: 2.35 });

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('48.8500');
    expect(result.detail).toContain('hors d\'Algérie');
  });

  it('passes the polygon as a bound parameter, never interpolated', async () => {
    const { service, prisma } = makeService([{ inside: true }]);
    await service.inAlgeria({ lat: 36.75, lng: 3.06 });

    const sql = (prisma.$queryRaw.mock.calls[0] as unknown as [Prisma.Sql])[0];
    const text = sql.sql ?? sql.text;
    expect(String(text)).toContain('ST_GeomFromGeoJSON');
    // the coordinates arrive through Prisma's parameter mechanism, not the string
    expect(sql.values).toContain(JSON.stringify(ALGERIA_POLYGON));
    expect(String(text)).not.toContain('coordinates');
  });

  it('degrades to the bbox when the query throws, and says so', async () => {
    const prisma = {
      $queryRaw: jest.fn(async () => Promise.reject(new Error('postgis missing'))),
    };
    const service = new GeoService(prisma as never);

    const inside = await service.inAlgeria({ lat: 36.75, lng: 3.06 });
    expect(inside.ok).toBe(true);
    expect(inside.detail).toContain('rectangle de secours');
    expect(inside.detail).toContain('postgis missing');

    const outside = await service.inAlgeria({ lat: 48.85, lng: 2.35 });
    expect(outside.ok).toBe(false);
  });

  it('never reports ok:true when the row is missing', async () => {
    const { service } = makeService([]);
    expect((await service.inAlgeria({ lat: 36.75, lng: 3.06 })).ok).toBe(false);
  });
});
