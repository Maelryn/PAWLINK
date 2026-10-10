import type { Case as CaseRow, CaseHelper, CaseConfirm, CaseFlag, TrustCheck, User as UserRow } from '@prisma/client';
import type { AIAnalysis, Case, Trust, UserLite } from '../shared/types';

/**
 * The ONLY place a `cases` row becomes the frontend `Case`
 * (`apps/web/lib/types.ts`). Mirrors `users/serialize.ts`: one mapper, used by
 * every response, so the typed client the frontend generates from Swagger can
 * never drift from the contract.
 *
 * `Case.ai` is `Json` in the database and is stored **exactly as
 * `POST /ai/analyze` returned it**, so it is passed through untouched rather than
 * reshaped — reshaping here would silently rewrite the AI contract.
 */

/** What the row must carry for the mapper to work: the row plus its relations. */
export interface CaseRowWithRelations extends CaseRow {
  reporter: Pick<UserRow, 'id' | 'name' | 'avatar'>;
  helpers: Array<CaseHelper & { user: Pick<UserRow, 'id' | 'name' | 'avatar'> }>;
  confirms: CaseConfirm[];
  flags: CaseFlag[];
  trustChecks: TrustCheck[];
}

function toLite(user: Pick<UserRow, 'id' | 'name' | 'avatar'>): UserLite {
  return { id: user.id, name: user.name, avatar: user.avatar };
}

const TRIAGE_VALUES = ['urgent', 'monitoring', 'stable'];

/**
 * `ai` is a Json column: it is stored verbatim as `POST /ai/analyze` returned it,
 * so it is passed through untouched — but it must still be *validated* on the way
 * out, because a Json column accepts anything and the frontend's generated client
 * trusts the Swagger type. A malformed blob becomes `undefined`, never a silently
 * wrong shape.
 */
export function isAIAnalysis(value: unknown): value is AIAnalysis {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.triage === 'string' &&
    TRIAGE_VALUES.includes(a.triage) &&
    typeof a.confidence === 'number' &&
    typeof a.summary === 'string' &&
    Array.isArray(a.observedSigns) &&
    Array.isArray(a.safetyAdvice) &&
    typeof a.possiblyContagious === 'boolean' &&
    Array.isArray(a.recommendedHelp) &&
    Array.isArray(a.suggestedServices) &&
    typeof a.forcedUrgentByRule === 'boolean' &&
    typeof a.disclaimer === 'string' &&
    typeof a.model === 'string'
  );
}

/** `null`/`undefined` → `undefined`; a valid blob → itself; anything else → `undefined`. */
export function aiOrUndefined(value: unknown): AIAnalysis | undefined {
  return isAIAnalysis(value) ? value : undefined;
}

/**
 * `trust_checks` rows → the `Trust` object the web shows. The order of the
 * checks is fixed by the web's UI, not by the database, so they are re-ordered
 * here: `checks[0]` must be `account` because the scoring reads it directly.
 */
export function trustRowsToTrust(
  level: CaseRow['trustLevel'],
  score: CaseRow['trustScore'],
  confirmations: number,
  flags: number,
  checks: TrustCheck[],
): Trust {
  const ORDER: TrustCheck['check'][] = [
    'account',
    'inAlgeria',
    'photoGps',
    'photoFresh',
    'onSite',
    'animalDetected',
    'duplicate',
    'rateLimit',
  ];

  const byId = new Map(checks.map((c) => [c.check, c]));
  return {
    level,
    score: Math.round(score * 100) / 100,
    checks: ORDER.map((id) => {
      const row = byId.get(id);
      return { id, ok: row ? row.ok : null, ...(row?.detail ? { detail: row.detail } : {}) };
    }),
    confirmations,
    flags,
  };
}

export function caseRowToCase(row: CaseRowWithRelations): Case {
  return {
    id: row.id,
    title: row.title,
    species: row.species,
    category: row.category,
    ...(row.count != null ? { count: row.count } : {}),
    status: row.status,
    triage: row.triage,
    location: {
      lat: row.lat,
      lng: row.lng,
      ...(row.address != null ? { address: row.address } : {}),
    },
    photos: row.photos,
    description: row.description,
    conditionTags: row.conditionTags,
    reporter: toLite(row.reporter),
    ai: aiOrUndefined(row.ai),
    ...(row.emergencyZoneId ? { emergencyZoneId: row.emergencyZoneId } : {}),
    ...(row.reporterOnSite != null ? { reporterOnSite: row.reporterOnSite } : {}),
    moderation: row.moderation ?? undefined,
    trust: trustRowsToTrust(row.trustLevel, row.trustScore, row.trustConfirmations, row.trustFlags, row.trustChecks),
    helpers: row.helpers.map((h) => ({ user: toLite(h.user), helpType: h.helpType })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
