import type { Case as CaseRow, CaseHelper, CaseConfirm, CaseFlag, TrustCheck, User as UserRow } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { aiOrUndefined } from '../shared/ai-analysis';
import { FOLLOW_UP_IDS, HELP_TYPES } from '../shared/enums';
import type { Case, CaseEdit, FollowUpId, HelpType, Trust, UserLite } from '../shared/types';

/**
 * The ONLY place a `cases` row becomes the frontend `Case`
 * (`apps/web/lib/types.ts`). Mirrors `users/serialize.ts`: one mapper, used by
 * every response, so the typed client the frontend generates from Swagger can
 * never drift from the contract.
 *
 * `Case.ai` is `Json` in the database. Until the AI service (`apps/Ai/`) is
 * delivered, the backend never writes it — the field stays `null` and comes
 * back `undefined`. When the backend↔AI link is wired in, this is where the
 * `AIAnalysis` the AI service returns gets stored, and it is validated on the
 * way out with `isAIAnalysis()` (`src/shared/ai-analysis.ts`), because a Json
 * column accepts anything and the frontend's generated client trusts Swagger.
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

function isHelpType(value: unknown): value is HelpType {
  return typeof value === 'string' && (HELP_TYPES as readonly string[]).includes(value);
}

/**
 * `cases.answers` is a Json column: keep only known questions with boolean
 * answers, so a hand-edited row can never reach the frontend as a surprise.
 */
function readAnswers(value: Prisma.JsonValue | null): Case['answers'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const answers: Partial<Record<FollowUpId, boolean>> = {};
  for (const id of FOLLOW_UP_IDS) {
    if (typeof source[id] === 'boolean') answers[id] = source[id] as boolean;
  }
  return Object.keys(answers).length > 0 ? answers : undefined;
}

/** `cases.nextHelp` is a Json column: `{ types, by, at }`, validated the same way. */
export function readNextHelp(value: Prisma.JsonValue | null): Case['nextHelp'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const types = Array.isArray(source.types) ? source.types.filter(isHelpType) : [];
  if (types.length === 0 || typeof source.by !== 'string' || typeof source.at !== 'string') {
    return undefined;
  }
  return { types, by: source.by, at: source.at };
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
  confirms: Array<{ userId: string; seen: boolean }> = [],
  flagRows: Array<{ userId: string }> = [],
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
  // Who answered "do you see this animal?" — the yes and the no are kept apart,
  // because the web shows both counts and refuses a second answer.
  const confirmedBy = confirms.filter((c) => c.seen).map((c) => c.userId);
  const deniedBy = confirms.filter((c) => !c.seen).map((c) => c.userId);
  const flaggedBy = flagRows.map((f) => f.userId);

  return {
    level,
    score: Math.round(score * 100) / 100,
    checks: ORDER.map((id) => {
      const row = byId.get(id);
      return { id, ok: row ? row.ok : null, ...(row?.detail ? { detail: row.detail } : {}) };
    }),
    confirmations,
    flags,
    ...(confirmedBy.length > 0 ? { confirmedBy } : {}),
    ...(deniedBy.length > 0 ? { deniedBy } : {}),
    ...(flaggedBy.length > 0 ? { flaggedBy } : {}),
  };
}

export function caseRowToCase(row: CaseRowWithRelations): Case {
  const nextHelp = readNextHelp(row.nextHelp);
  const answers = readAnswers(row.answers);

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
    trust: trustRowsToTrust(
      row.trustLevel,
      row.trustScore,
      row.trustConfirmations,
      row.trustFlags,
      row.trustChecks,
      row.confirms,
      row.flags,
    ),
    helpers: row.helpers.map((h) => ({
      user: toLite(h.user),
      helpType: h.helpType,
      ...(h.stage ? { stage: h.stage } : {}),
      ...(h.stageAt ? { stageAt: h.stageAt.toISOString() } : {}),
    })),
    ...(nextHelp ? { nextHelp } : {}),
    ...(answers ? { answers } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    // The reporter's proposed change: public only once a moderator approves it.
    ...(row.pendingEdit ? { pendingEdit: row.pendingEdit as unknown as CaseEdit } : {}),
  };
}
