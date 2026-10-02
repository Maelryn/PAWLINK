import type { GeoPoint, Trust, TrustCheck, User } from "./types";
import { distanceKm } from "./utils";

/* Client-side preview of the anti-abuse checks. The backend MUST redo them
   (EXIF read server-side, perceptual-hash duplicates, rate limits, Gemini "is there an animal?"). */

export const inAlgeria = (p: GeoPoint) => p.lat > 18.9 && p.lat < 37.2 && p.lng > -8.7 && p.lng < 12;

export interface TrustInput {
  user: User;
  location: GeoPoint;
  hasPhoto: boolean;
  exifGps?: GeoPoint | null;
  exifDate?: Date | null;
  device?: GeoPoint | null;
  duplicatePhoto: boolean;
  recentReports: number;
}

export function computeTrust(i: TrustInput): Trust {
  const checks: TrustCheck[] = [
    { id: "account", ok: !!i.user.phoneVerified },
    { id: "inAlgeria", ok: inAlgeria(i.location) },
    { id: "photoGps", ok: i.exifGps ? distanceKm(i.exifGps, i.location) < 2 : null },
    { id: "photoFresh", ok: i.exifDate ? Date.now() - i.exifDate.getTime() < 48 * 3_600_000 : null },
    { id: "onSite", ok: i.device ? distanceKm(i.device, i.location) < 5 : null },
    { id: "animalDetected", ok: i.hasPhoto ? true : null },
    { id: "duplicate", ok: !i.duplicatePhoto },
    { id: "rateLimit", ok: i.recentReports < 5 },
  ];
  const known = checks.filter((c) => c.ok !== null);
  const score = known.length ? known.filter((c) => c.ok).length / known.length : 0.5;
  const hardFail = checks.some((c) => c.ok === false && ["inAlgeria", "photoGps", "duplicate", "rateLimit"].includes(c.id));
  const level = hardFail || score < 0.5 ? "suspicious" : score >= 0.85 && checks[0].ok ? "verified" : "unverified";
  return { level, score: Math.round(score * 100) / 100, checks, confirmations: 0, flags: 0 };
}

export const gmaps = (p: GeoPoint) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
export const gmapsDirections = (p: GeoPoint) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
