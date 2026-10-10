import { BadRequestException } from '@nestjs/common';

/**
 * One place that turns `?bbox=minLng,minLat,maxLng,maxLat` into a validated box
 * (docs/BACKEND_PROMPT.md §3.3). The map is the only consumer, but every wrong
 * shape has to become one `VALIDATION_ERROR` rather than a Postgres exception.
 */

export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/** Longitude/latitude limits — anything outside is not a coordinate. */
const LNG_RANGE = { min: -180, max: 180 };
const LAT_RANGE = { min: -90, max: 90 };

/**
 * A bbox wider than this is a client bug (or a request for the whole planet):
 * the GIST index stops helping long before that. ~16000 km.
 */
export const MAX_SPAN_DEGREES = 144;

export function parseBbox(raw: string | undefined): Bbox | null {
  if (!raw) return null;

  const parts = raw.split(',');
  if (parts.length !== 4) {
    throw new BadRequestException(
      `bbox must be minLng,minLat,maxLng,maxLat (4 values, got ${parts.length}).`,
    );
  }

  // An empty slot is a client bug, not "zero": Number('') is 0 and would
  // otherwise silently relocate the whole map to the Gulf of Guinea.
  if (parts.some((p) => p.trim() === '')) {
    throw new BadRequestException('bbox values must be numbers.');
  }

  const numbers = parts.map((p) => Number(p.trim()));
  if (numbers.some((n) => !Number.isFinite(n))) {
    throw new BadRequestException('bbox values must be numbers.');
  }

  const [minLng, minLat, maxLng, maxLat] = numbers;

  if (minLng < LNG_RANGE.min || minLng > LNG_RANGE.max || maxLng < LNG_RANGE.min || maxLng > LNG_RANGE.max) {
    throw new BadRequestException('bbox longitudes must be between -180 and 180.');
  }
  if (minLat < LAT_RANGE.min || minLat > LAT_RANGE.max || maxLat < LAT_RANGE.min || maxLat > LAT_RANGE.max) {
    throw new BadRequestException('bbox latitudes must be between -90 and 90.');
  }

  // Tolerate a lat/lng swap rather than rejecting it: `minLat,minLng` is the
  // mistake a map library makes, and the fix is unambiguous.
  if (minLng > maxLng && minLat <= maxLat && minLng >= LAT_RANGE.min && minLng <= LAT_RANGE.max) {
    return parseBbox([maxLng, minLat, minLng, maxLat].join(','));
  }
  if (minLat > maxLat) {
    throw new BadRequestException('bbox must have minLat below maxLat.');
  }

  if (maxLng - minLng > MAX_SPAN_DEGREES || maxLat - minLat > MAX_SPAN_DEGREES) {
    throw new BadRequestException(
      `bbox is too large: span must stay under ${MAX_SPAN_DEGREES} degrees.`,
    );
  }

  return { minLng, minLat, maxLng, maxLat };
}

/** Does this point fall inside the box? Used to keep the e2e readable. */
export function bboxContains(box: Bbox, point: { lat: number; lng: number }): boolean {
  return (
    point.lat >= box.minLat && point.lat <= box.maxLat && point.lng >= box.minLng && point.lng <= box.maxLng
  );
}
