import { Injectable, Logger } from '@nestjs/common';
import type { Triage } from '@prisma/client';
import type { Trust, TrustCheck, User } from '../shared/types';
import { distanceKm, type LatLng } from '../geo/geo.service';
import { ExifService, type PhotoExif } from '../uploads/exif.service';

/**
 * The anti-abuse pipeline (docs/BACKEND_PROMPT.md §3.5, ported from
 * `apps/web/lib/trust.ts`).
 *
 * The split is deliberate:
 *
 *   - `scoreTrust()` is the **pure** arithmetic port of the web scorer — same
 *     checks, same order, same thresholds, same rounding. Nothing in it touches
 *     the network or the clock, so the web's own scenarios are testable as-is.
 *   - `TrustService.check()` gathers the eight check values, some of which need
 *     I/O (the Algeria polygon, the database, an uploaded file), and then hands
 *     them to `scoreTrust()`.
 *
 * Nothing the client sends is trusted: every value is recomputed here.
 */

/** Ids that make a case `suspicious` on their own — the web's `hardFail` set. */
export const HARD_FAIL_IDS: readonly TrustCheck['id'][] = ['inAlgeria', 'photoGps', 'duplicate', 'rateLimit'];

/** The GPS drift allowed between the photo and the reported pin (< 2 km). */
export const MAX_PHOTO_GPS_DRIFT_KM = 2;
/** How far the reporter may be from the animal and still count as on site (< 5 km). */
export const MAX_ON_SITE_KM = 5;
/** A photo older than this is not fresh (< 48 h). */
export const MAX_PHOTO_AGE_HOURS = 48;
/** Reports allowed per hour, per account and per IP. */
export const MAX_REPORTS_PER_HOUR = 5;

/** The fixed order the web UI reads the checks in; `checks[0]` must be `account`. */
export const CHECK_ORDER: readonly TrustCheck['id'][] = [
  'account',
  'inAlgeria',
  'photoGps',
  'photoFresh',
  'onSite',
  'animalDetected',
  'duplicate',
  'rateLimit',
];

export interface TrustCheckInput {
  /** The reporter, read from the database — never from the request body. */
  user: Pick<User, 'phoneVerified'>;
  /** Where the report says the animal is. */
  location: LatLng;
  /** Did the report include at least one photo? */
  hasPhoto: boolean;
  /** EXIF read server-side from the original, before any upload. */
  exif?: PhotoExif | null;
  /** Device GPS, optional — remote reporting is allowed. */
  device?: LatLng | null;
  /** True when a stored dHash already matches one of this report's photos. */
  duplicatePhoto?: boolean;
  /** Reports this account has already made in the last hour. */
  recentReports: number;
  /** Whether `ST_Within` placed the pin inside Algeria. */
  inAlgeria: boolean;
  /** Overrides "now", so the freshness check stays testable. */
  now?: Date;
}

export interface TrustResult extends Trust {
  moderation: 'pending' | null;
}

/**
 * The web scorer, ported line for line. Kept pure and exported so the web's own
 * scenarios can be asserted against it directly.
 */
export function scoreTrust(checks: TrustCheck[]): Trust {
  const known = checks.filter((c) => c.ok !== null);
  const score = known.length ? known.filter((c) => c.ok).length / known.length : 0.5;
  const hardFail = checks.some((c) => c.ok === false && HARD_FAIL_IDS.includes(c.id));
  const level = hardFail || score < 0.5 ? 'suspicious' : score >= 0.85 && checks[0].ok ? 'verified' : 'unverified';
  return { level, score: Math.round(score * 100) / 100, checks, confirmations: 0, flags: 0 };
}

@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);

  constructor(private readonly exif: ExifService) {}

  /** Runs the eight checks and scores them. `suspicious` also means "moderate me". */
  async check(input: TrustCheckInput): Promise<TrustResult> {
    const now = input.now ?? new Date();

    const ageHours = input.exif?.takenAt ? (now.getTime() - input.exif.takenAt.getTime()) / 3_600_000 : null;
    const photoGpsDrift = input.exif?.gps ? distanceKm(input.exif.gps, input.location) : null;
    const onSiteDistance = input.device ? distanceKm(input.device, input.location) : null;

    const checks: TrustCheck[] = [
      // phoneVerified is optional on User, so coerce: an unknown status is a
      // failed check, not "not enough data"
      { id: 'account', ok: input.user.phoneVerified === true },
      { id: 'inAlgeria', ok: input.inAlgeria },
      {
        id: 'photoGps',
        ok: photoGpsDrift === null ? null : photoGpsDrift < MAX_PHOTO_GPS_DRIFT_KM,
        ...(photoGpsDrift !== null
          ? { detail: `Photo à ${photoGpsDrift.toFixed(2)} km du point signalé` }
          : {}),
      },
      {
        id: 'photoFresh',
        ok: ageHours === null ? null : ageHours >= -1 && ageHours <= MAX_PHOTO_AGE_HOURS,
        ...(ageHours !== null ? { detail: `Photo prise il y a ${ageHours.toFixed(1)} h` } : {}),
      },
      {
        id: 'onSite',
        ok: onSiteDistance === null ? null : onSiteDistance < MAX_ON_SITE_KM,
        ...(onSiteDistance !== null
          ? { detail: `Reporter à ${onSiteDistance.toFixed(2)} km` }
          : {}),
      },
      {
        // Until the AI service (apps/Ai/) is delivered there is no
        // `animalDetected` signal, so this check is always "not enough data".
        // It stays in the order because the web UI renders it; it flips back to
        // a real pass/fail when the backend↔AI link is wired in.
        id: 'animalDetected',
        ok: null,
        detail: 'Analyse IA indisponible',
      },
      {
        id: 'duplicate',
        ok: !(input.duplicatePhoto ?? false),
        ...(input.duplicatePhoto ? { detail: 'Photo déjà utilisée dans un autre signalement' } : {}),
      },
      {
        id: 'rateLimit',
        ok: input.recentReports < MAX_REPORTS_PER_HOUR,
        ...(input.recentReports >= MAX_REPORTS_PER_HOUR
          ? { detail: `${input.recentReports} signalements dans la dernière heure` }
          : {}),
      },
    ];

    const trust = scoreTrust(checks);
    // A `suspicious` report is hidden from the public map until an admin approves it.
    const moderation = trust.level === 'suspicious' ? ('pending' as const) : null;

    if (moderation) {
      this.logger.warn(
        `Report held for moderation: level=${trust.level} score=${trust.score} ` +
          `failed=[${checks.filter((c) => c.ok === false).map((c) => c.id).join(', ')}]`,
      );
    }

    return { ...trust, moderation };
  }

  /** True when the account has already spent its hourly report allowance. */
  isRateLimited(recentReports: number): boolean {
    return recentReports >= MAX_REPORTS_PER_HOUR;
  }
}

/**
 * Raises the triage, never lowering it (docs/BACKEND_PROMPT.md §3.4 rule 3).
 * Kept here so the case service and any future AI integration share the same
 * ordering. Exported for the safety-rule contract; the AI service in
 * `apps/Ai/` is the intended consumer once the backend↔AI link is wired in.
 */
export function raiseTriage(current: Triage, requested: Triage): Triage {
  const ORDER: Triage[] = ['stable', 'monitoring', 'urgent'];
  return ORDER.indexOf(requested) > ORDER.indexOf(current) ? requested : current;
}
