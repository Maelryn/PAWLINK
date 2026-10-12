import { Injectable, Logger } from '@nestjs/common';
import exifr from 'exifr';
import type { LatLng } from '../geo/geo.service';

/**
 * Camera EXIF, read server-side from the uploaded original (docs/BACKEND_PROMPT.md §3.5).
 *
 * This is what makes the `photoGps` and `photoFresh` trust checks real instead of
 * a client claim: Cloudinary strips metadata on upload, so the bytes have to be
 * read here, before they leave our control.
 */

export interface PhotoExif {
  /** Where the camera was, if it recorded it. */
  gps?: LatLng;
  /** When the photo was taken, from `DateTimeOriginal`. */
  takenAt?: Date;
  /** Camera Make/Model — a photo without them is not from a camera. */
  camera?: string;
}

/** How stale a photo may be before `photoFresh` fails (48 h, per the web scorer). */
export const MAX_PHOTO_AGE_HOURS = 48;

@Injectable()
export class ExifService {
  private readonly logger = new Logger(ExifService.name);

  /**
   * Reads GPS, `DateTimeOriginal` and the camera identity.
   *
   * Returns the fields that exist and omits the rest — a missing EXIF block is a
   * perfectly normal photo (screenshot, downloaded image, WhatsApp re-share) and
   * must become `ok: null` in the trust check, not an error.
   */
  async read(buffer: Buffer): Promise<PhotoExif> {
    const tags = await exifr
      .parse(buffer, {
        gps: true,
        // only what the pipeline reads; a full parse costs more and yields junk
        pick: ['latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'DateTimeOriginal', 'Make', 'Model'],
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `EXIF read failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return undefined;
      });

    if (!tags) return {};

    const exif: PhotoExif = {};

    // exifr already resolves the N/S and E/W references for us; only sanity-check.
    if (typeof tags.latitude === 'number' && typeof tags.longitude === 'number') {
      const lat = tags.latitude;
      const lng = tags.longitude;
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) exif.gps = { lat, lng };
    }

    const takenAt = tags.DateTimeOriginal instanceof Date ? tags.DateTimeOriginal : undefined;
    if (takenAt && !Number.isNaN(takenAt.getTime())) exif.takenAt = takenAt;

    const make = typeof tags.Make === 'string' ? tags.Make.trim() : '';
    const model = typeof tags.Model === 'string' ? tags.Model.trim() : '';
    const camera = [make, model].filter(Boolean).join(' ');
    if (camera) exif.camera = camera;

    return exif;
  }

  /** Does this photo come from a real camera? Used by the adoption rules (§3.6). */
  hasCameraIdentity(exif: PhotoExif): boolean {
    return Boolean(exif.camera) && Boolean(exif.takenAt);
  }

  /** Age of the photo in hours, or `null` when it cannot be known. */
  ageHours(exif: PhotoExif, now = new Date()): number | null {
    if (!exif.takenAt) return null;
    return (now.getTime() - exif.takenAt.getTime()) / 3_600_000;
  }

  isFresh(exif: PhotoExif, now = new Date()): boolean | null {
    const age = this.ageHours(exif, now);
    if (age === null) return null;
    return age >= -1 && age <= MAX_PHOTO_AGE_HOURS;
  }
}
