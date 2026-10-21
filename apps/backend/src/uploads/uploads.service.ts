import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ApiError } from '../common/filters/http-exception.filter';
import { PrismaService } from '../common/prisma/prisma.service';
import { DHashService } from './dhash.service';
import { ExifService, type PhotoExif } from './exif.service';
import { CloudinaryService, type CloudinarySignature } from './cloudinary';

/**
 * Uploads — the server's side of a photo (docs/BACKEND_PROMPT.md §3.3, §3.5).
 *
 * The flow is deliberately two-step, because Cloudinary strips metadata on
 * upload and the trust pipeline needs that metadata:
 *
 *   1. `POST /uploads/probe` — the original bytes come here, we read EXIF and a
 *      perceptual hash, and hand back an opaque `probeId`. Nothing but those two
 *      facts is stored; the bytes themselves never reach the database.
 *   2. the client uploads to Cloudinary with a signature from
 *      `POST /uploads/signature`, then sends the URLs **and the probeIds** to
 *      `POST /cases`.
 *
 * A client therefore cannot invent EXIF: the only way to influence `photoGps` or
 * `photoFresh` is to hand us a real JPEG first.
 */

/** The file shape multer gives us, narrowed to what is actually used. */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** What `POST /uploads/probe` answers. */
export interface ProbeResult {
  probeId: string;
  /** `{}` when the file carries no EXIF — a normal photo, not an error. */
  exif: PhotoExif;
  /** 16 hex characters (64-bit dHash), or `null` for a file `sharp` cannot decode. */
  dHash: string | null;
}

/** A probe row as `POST /cases` consumes it. */
export interface ConsumedProbe {
  probeId: string;
  exif: PhotoExif;
  dHash: string | null;
}

/** How long a probe stays usable. Long enough for the upload round-trip. */
export const PROBE_TTL_MS = 60 * 60 * 1000;

/** Files larger than this are not phone photos; refuse before decoding. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** What we accept: the formats a phone camera and a browser canvas produce. */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exif: ExifService,
    private readonly dhash: DHashService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /** Signed upload params for the browser's direct-to-Cloudinary PUT/POST. */
  signatureFor(userId: string): CloudinarySignature {
    return this.cloudinary.signature(`pawlink/cases/${userId}`);
  }

  isConfigured(): boolean {
    return this.cloudinary.isConfigured();
  }

  /**
   * Reads EXIF + dHash from the original and stores the result as an opaque probe.
   *
   * Both reads are independent, so they run together — `sharp` is the slow one
   * and a photo without EXIF must not wait on anything.
   */
  async probe(userId: string, file: UploadedFile): Promise<ProbeResult> {
    this.assertImage(file);

    const [exif, hashed] = await Promise.all([
      this.exif.read(file.buffer),
      this.dhash.hashOrNull(file.buffer),
    ]);

    // Expired probes are dead weight: drop them on the way through, so the table
    // needs no cron and cannot grow without bound.
    await this.prune();

    const row = await this.prisma.photoProbe.create({
      data: { userId, exif: toJson(exif), hash: hashed?.hex ?? '' },
    });

    this.logger.log(
      `Probe ${row.id}: ${file.mimetype} ${file.size}B ` +
        `exif=${exif.gps ? 'gps' : 'no-gps'}${exif.takenAt ? '+date' : ''} ` +
        `hash=${hashed ? hashed.hex : 'none'}`,
    );

    return { probeId: row.id, exif, dHash: hashed?.hex ?? null };
  }

  /**
   * Loads the live probes a case is claiming.
   *
   * Ownership and the TTL are both enforced here: a probe is only usable by the
   * account that created it, and only within the hour. Anything else is a 404 —
   * the same answer a made-up id gets, so the response cannot be used to probe
   * which ids exist.
   */
  async consume(userId: string, probeIds: string[]): Promise<ConsumedProbe[]> {
    if (probeIds.length === 0) return [];

    const cutoff = new Date(Date.now() - PROBE_TTL_MS);
    const rows = await this.prisma.photoProbe.findMany({
      where: { id: { in: probeIds }, userId, createdAt: { gt: cutoff } },
    });

    if (rows.length !== probeIds.length) {
      const found = new Set(rows.map((r) => r.id));
      const missing = probeIds.filter((id) => !found.has(id));
      throw new NotFoundException(
        `Unknown or expired probeId: ${missing.join(', ')}. ` +
          'Upload the photo again with POST /uploads/probe.',
      );
    }

    // Keep the caller's order, so `photos[i]` is described by `probes[i]`.
    const byId = new Map(rows.map((r) => [r.id, r]));
    return probeIds.map((id) => {
      const row = byId.get(id)!;
      return { probeId: row.id, exif: fromJson(row.exif), dHash: row.hash || null };
    });
  }

  /** Deletes probes past their TTL. Called on every probe, so no cron is needed. */
  private async prune(): Promise<void> {
    await this.prisma.photoProbe.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - PROBE_TTL_MS) } },
    });
  }

  private assertImage(file: UploadedFile): void {
    if (!file || !file.buffer || file.size === 0) {
      throw new ApiError(400, 'UPLOADS_EMPTY_FILE', 'No file was uploaded.');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(413, 'UPLOADS_FILE_TOO_LARGE', 'Each photo must stay under 10 MB.');
    }
    // A phone never sends anything else; a script faking an image might.
    if (file.mimetype && !ALLOWED_MIME.has(file.mimetype.toLowerCase())) {
      throw new ApiError(415, 'UPLOADS_UNSUPPORTED_TYPE', `Unsupported image type: ${file.mimetype}.`);
    }
  }
}

/** `PhotoExif` → the Json column shape (dates as ISO strings). */
function toJson(exif: PhotoExif): Prisma.InputJsonValue {
  const value: Record<string, unknown> = {
    ...(exif.gps ? { gps: { lat: exif.gps.lat, lng: exif.gps.lng } } : {}),
    ...(exif.takenAt ? { takenAt: exif.takenAt.toISOString() } : {}),
    ...(exif.camera ? { camera: exif.camera } : {}),
  };
  return value as Prisma.InputJsonValue;
}

/** Json column → `PhotoExif`, validated: a malformed blob must not crash the pipeline. */
export function fromJson(value: Prisma.JsonValue | null): PhotoExif {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;

  const exif: PhotoExif = {};

  const gps = raw.gps as Record<string, unknown> | undefined;
  if (gps && typeof gps.lat === 'number' && typeof gps.lng === 'number') {
    exif.gps = { lat: gps.lat, lng: gps.lng };
  }

  if (typeof raw.takenAt === 'string') {
    const takenAt = new Date(raw.takenAt);
    if (!Number.isNaN(takenAt.getTime())) exif.takenAt = takenAt;
  }

  if (typeof raw.camera === 'string' && raw.camera.length > 0) exif.camera = raw.camera;

  return exif;
}
