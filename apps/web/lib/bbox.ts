"use client";

/** The box the map is showing, in the order the API wants it: `minLng,minLat,maxLng,maxLat`.
    Same order as `?bbox=` on `GET /cases` (apps/backend/src/cases/bbox.ts). */
export type Bbox = [minLng: number, minLat: number, maxLng: number, maxLat: number];

/** What the map can see right now — the same numbers, named. */
export interface Viewport {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** The backend refuses a box wider than this (apps/backend/src/cases/bbox.ts). */
export const MAX_SPAN_DEGREES = 144;

/** The box we ask for is bigger than the visible one: a short pan must not empty the map. */
const PAD = 0.25;

/** The box is snapped to a ~1 km grid (a hundredth of a degree), so a short pan asks for the
    same box (and the same request). The arithmetic stays in hundredths, so the numbers that
    go in the URL are clean ones. */
const UNITS = 100;

/** Snaps to the grid, outward: the box must always cover what is on screen. */
const floorTo = (n: number) => Math.floor(n * UNITS + 1e-6) / UNITS;
const ceilTo = (n: number) => Math.ceil(n * UNITS - 1e-6) / UNITS;

/** Shrinks a span that is over the limit around its middle. */
function capSpan(min: number, max: number, limit: number): [number, number] {
  if (max - min <= limit) return [min, max];
  const mid = (min + max) / 2;
  return [mid - limit / 2, mid + limit / 2];
}

/**
 * The `?bbox=` box for what the map is showing.
 *
 * Wider than the visible area (a pan must not empty the map), snapped to a grid (the same
 * pan asks for the same box, so it does not ask again) and never wider than the backend
 * accepts — a bigger one is answered with a 400.
 */
export function bboxFromViewport(v: Viewport): Bbox {
  // the visible area first, snapped to the grid: a pan of a few metres then asks for the
  // same box as before, and does not wake the API up for nothing
  const west = floorTo(v.west);
  const east = ceilTo(v.east);
  const south = floorTo(v.south);
  const north = ceilTo(v.north);
  const dLng = (east - west) * PAD;
  const dLat = (north - south) * PAD;
  const [minLng, maxLng] = capSpan(west - dLng, east + dLng, MAX_SPAN_DEGREES);
  const [minLat, maxLat] = capSpan(south - dLat, north + dLat, MAX_SPAN_DEGREES);
  return [
    Math.max(-180, floorTo(minLng)),
    Math.max(-90, floorTo(minLat)),
    Math.min(180, ceilTo(maxLng)),
    Math.min(90, ceilTo(maxLat)),
  ];
}

/** The identity of a box: two boxes with the same key ask the API for the same thing. */
export function bboxKey(bbox: Bbox | null): string {
  return bbox ? bbox.join(",") : "";
}
