import type { Case, EmergencyZone, GeoPoint } from "./types";
import { distanceKm, pointInPolygon } from "./utils";

/* Emergency zones (wildfire, flood…): declared and ended by an admin. PawLink watches for
   clusters of animals in danger and suggests a zone, but a human always confirms (no false alarms). */

/** Approximate circle as a GeoJSON polygon (good enough for a few km). */
export function circlePolygon(center: GeoPoint, radiusKm: number, steps = 40): GeoJSON.Polygon {
  const ring: number[][] = [];
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([+(center.lng + dLng * Math.cos(a)).toFixed(5), +(center.lat + dLat * Math.sin(a)).toFixed(5)]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

export const inZone = (p: GeoPoint, z: EmergencyZone) => pointInPolygon(p, z.polygon.coordinates[0] as number[][]);

/** The active zone a point falls in (newest first), if any. */
export function activeZoneAt(p: GeoPoint, zones: EmergencyZone[]): EmergencyZone | undefined {
  return [...zones].filter((z) => z.active).sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)).find((z) => inZone(p, z));
}

/** Live numbers for a zone, from the real cases. */
export function zoneStats(z: EmergencyZone, cases: Case[]) {
  const mine = cases.filter((c) => c.emergencyZoneId === z.id);
  const helpers = new Set(mine.flatMap((c) => c.helpers.map((h) => h.user.id)));
  return { cases: mine.length, urgent: mine.filter((c) => c.triage === "urgent" && c.status !== "resolved").length, helpers: helpers.size };
}

export interface ZoneSuggestion {
  center: GeoPoint;
  radiusKm: number;
  count: number;
  urgent: number;
  place: string;
  type: EmergencyZone["type"];
  caseIds: string[];
}

const FIRE_TAGS = ["fire", "smoke", "burned"];

/** Groups of ≥ 4 open cases within 10 km in the last 48 h, at least 3 of them urgent, outside any active zone.
    (A few animals to watch in a city is everyday life, not a disaster.) */
export function suggestZones(cases: Case[], zones: EmergencyZone[], now = Date.now()): ZoneSuggestion[] {
  const pool = cases.filter(
    (c) =>
      c.status !== "resolved" &&
      c.triage !== "stable" &&
      c.moderation !== "hidden" &&
      c.moderation !== "pending" &&
      now - +new Date(c.createdAt) < 48 * 3_600_000 &&
      !activeZoneAt(c.location, zones),
  );
  const used = new Set<string>();
  const out: ZoneSuggestion[] = [];
  for (const seed of pool) {
    if (used.has(seed.id)) continue;
    const group = pool.filter((c) => !used.has(c.id) && distanceKm(seed.location, c.location) <= 10);
    if (group.length < 4 || group.filter((c) => c.triage === "urgent").length < 3) continue;
    group.forEach((c) => used.add(c.id));
    const center = {
      lat: group.reduce((s, c) => s + c.location.lat, 0) / group.length,
      lng: group.reduce((s, c) => s + c.location.lng, 0) / group.length,
    };
    const radiusKm = Math.max(3, Math.ceil(Math.max(...group.map((c) => distanceKm(center, c.location))) + 2));
    const place = (group[0].location.address ?? "").split(",").pop()?.trim() || "";
    const fire = group.some((c) => c.conditionTags.some((x) => FIRE_TAGS.includes(x)));
    out.push({ center, radiusKm, count: group.length, urgent: group.filter((c) => c.triage === "urgent").length, place, type: fire ? "wildfire" : "other", caseIds: group.map((c) => c.id) });
  }
  return out;
}

/** Cities an admin can pick when declaring a zone by hand. */
export const ZONE_PLACES: { name: string; lat: number; lng: number }[] = [
  { name: "Alger", lat: 36.7538, lng: 3.0588 },
  { name: "Tizi Ouzou", lat: 36.7118, lng: 4.0459 },
  { name: "Béjaïa", lat: 36.7509, lng: 5.0567 },
  { name: "Bouira", lat: 36.3749, lng: 3.902 },
  { name: "Boumerdès", lat: 36.7664, lng: 3.4772 },
  { name: "Blida", lat: 36.4701, lng: 2.8277 },
  { name: "Jijel", lat: 36.8206, lng: 5.7667 },
  { name: "Sétif", lat: 36.1911, lng: 5.4137 },
  { name: "Constantine", lat: 36.365, lng: 6.6147 },
  { name: "Annaba", lat: 36.9, lng: 7.7667 },
  { name: "El Tarf", lat: 36.7672, lng: 8.3137 },
  { name: "Skikda", lat: 36.8762, lng: 6.9092 },
  { name: "Oran", lat: 35.6971, lng: -0.6308 },
  { name: "Tlemcen", lat: 34.8783, lng: -1.315 },
  { name: "Chlef", lat: 36.1653, lng: 1.3345 },
  { name: "Médéa", lat: 36.2642, lng: 2.7539 },
  { name: "Batna", lat: 35.5559, lng: 6.1741 },
  { name: "Djelfa", lat: 34.6728, lng: 3.2631 },
  { name: "Ghardaïa", lat: 32.4909, lng: 3.6735 },
  { name: "Biskra", lat: 34.8504, lng: 5.7281 },
];
