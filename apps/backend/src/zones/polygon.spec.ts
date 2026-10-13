import { describe, expect, it } from '@jest/globals';
import { parsePolygon } from './polygon';

/**
 * Emergency-zone polygon validation (docs/PHASE3_PROMPT.md §3.4). Pure input
 * validation, so it is pinned without an HTTP layer: a bad polygon must be a
 * `ZONE_INVALID_POLYGON` 400, never a Postgres error and never a stray ring
 * on the map.
 */

const VALID = {
  type: 'Polygon',
  coordinates: [[[3.9, 36.5], [4.4, 36.5], [4.4, 36.9], [3.9, 36.9], [3.9, 36.5]]],
};

const err = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error as { status: number; response: { code: string } };
  }
};

describe('parsePolygon', () => {
  it('accepts a closed ring and normalizes it', () => {
    expect(parsePolygon(VALID)).toEqual(VALID);
  });

  it('accepts a polygon with holes', () => {
    const withHole = {
      type: 'Polygon',
      coordinates: [
        [[3.0, 36.0], [5.0, 36.0], [5.0, 37.0], [3.0, 37.0], [3.0, 36.0]],
        [[3.5, 36.2], [3.7, 36.2], [3.7, 36.4], [3.5, 36.4], [3.5, 36.2]],
      ],
    };
    expect(parsePolygon(withHole).coordinates).toHaveLength(2);
  });

  it('rejects an unclosed ring', () => {
    // first ≠ last: the ring never closes
    const error = err(() =>
      parsePolygon({ type: 'Polygon', coordinates: [[[3.9, 36.5], [4.4, 36.5], [4.4, 36.9], [3.9, 36.4]]] }),
    );
    expect(error?.status).toBe(400);
    expect(error?.response.code).toBe('ZONE_INVALID_POLYGON');
  });

  it('rejects a ring with fewer than 4 positions', () => {
    expect(err(() => parsePolygon({ type: 'Polygon', coordinates: [[[3.9, 36.5], [4.4, 36.5], [3.9, 36.5]]] }))?.status).toBe(400);
  });

  it('rejects a MultiPolygon', () => {
    expect(err(() => parsePolygon({ type: 'MultiPolygon', coordinates: [] }))?.response.code).toBe(
      'ZONE_INVALID_POLYGON',
    );
  });

  it('rejects coordinates outside Algeria', () => {
    // Paris
    expect(
      err(() => parsePolygon({ type: 'Polygon', coordinates: [[[2.0, 48.0], [2.5, 48.0], [2.5, 48.5], [2.0, 48.0]]] }))?.response.code,
    ).toBe('ZONE_INVALID_POLYGON');
  });

  it('rejects a non-object, an empty ring list and a bad position', () => {
    expect(err(() => parsePolygon(null))?.status).toBe(400);
    expect(err(() => parsePolygon({ type: 'Polygon', coordinates: [] }))?.status).toBe(400);
    expect(
      err(() => parsePolygon({ type: 'Polygon', coordinates: [[[3.9, 36.5], ['x', 36.5], [4.4, 36.9], [3.9, 36.5]]] }))?.status,
    ).toBe(400);
  });

  it('keeps [lng, lat] order — a swapped pair lands outside the bbox', () => {
    // 36.9°N as a longitude is outside Algeria's ±12.5° range
    expect(
      err(() => parsePolygon({ type: 'Polygon', coordinates: [[[36.5, 3.9], [36.5, 4.4], [36.9, 4.4], [36.5, 3.9]]] }))?.response.code,
    ).toBe('ZONE_INVALID_POLYGON');
  });
});
