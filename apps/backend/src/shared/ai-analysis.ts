import type { AIAnalysis, Triage } from './types';

/**
 * The `AIAnalysis` contract (apps/web/lib/types.ts) as a runtime guard.
 *
 * `cases.ai` is a Json column, so anything can end up in it — including a blob
 * written by an older version of the app. Reading it back has to be checked
 * rather than trusted: the frontend generates a typed client from Swagger and
 * will happily render a `triage` that is not a triage. A malformed blob becomes
 * `undefined`, which the UI already knows how to render, instead of a silently
 * wrong card.
 *
 * Shared by the row mapper (`cases/serialize.ts`). The AI service that would
 * validate its own answer with the same rule lives in `apps/Ai/`; until the
 * backend↔AI link is wired in, this guard only reads whatever is already
 * stored.
 */

const TRIAGE_VALUES: readonly string[] = ['urgent', 'monitoring', 'stable'];

const HELP_TYPES: readonly string[] = [
  'transport',
  'foster',
  'food',
  'medical',
  'search',
  'boarding',
  'funds',
];

const SERVICE_TYPES: readonly string[] = ['vet', 'shelter', 'transport', 'boarding', 'training', 'store'];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === 'string');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Is this value an `AIAnalysis`? Cheap, total, and never throws. */
export function isAIAnalysis(value: unknown): value is AIAnalysis {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const a = value as Record<string, unknown>;

  if (typeof a.triage !== 'string' || !TRIAGE_VALUES.includes(a.triage)) return false;
  if (!isFiniteNumber(a.confidence)) return false;
  if (typeof a.summary !== 'string') return false;
  if (!isStringArray(a.observedSigns)) return false;
  if (!isStringArray(a.safetyAdvice)) return false;
  if (typeof a.possiblyContagious !== 'boolean') return false;
  if (a.contagionAdvice !== undefined && !isStringArray(a.contagionAdvice)) return false;
  if (!isStringArray(a.recommendedHelp)) return false;
  if (
    !Array.isArray(a.suggestedServices) ||
    !a.suggestedServices.every((s) => {
      if (s === null || typeof s !== 'object') return false;
      const row = s as Record<string, unknown>;
      return (
        typeof row.serviceId === 'string' &&
        typeof row.name === 'string' &&
        typeof row.type === 'string' &&
        SERVICE_TYPES.includes(row.type) &&
        isFiniteNumber(row.distanceKm)
      );
    })
  ) {
    return false;
  }
  if (a.suggestedHelpers !== undefined) {
    if (
      !Array.isArray(a.suggestedHelpers) ||
      !a.suggestedHelpers.every((h) => {
        if (h === null || typeof h !== 'object') return false;
        const row = h as Record<string, unknown>;
        return (
          typeof row.userId === 'string' &&
          typeof row.name === 'string' &&
          typeof row.helpType === 'string' &&
          HELP_TYPES.includes(row.helpType) &&
          isFiniteNumber(row.distanceKm)
        );
      })
    ) {
      return false;
    }
  }
  if (typeof a.forcedUrgentByRule !== 'boolean') return false;
  if (typeof a.disclaimer !== 'string' || a.disclaimer.length === 0) return false;
  if (typeof a.model !== 'string') return false;

  return true;
}

/** `null`/`undefined` → `undefined`; a valid blob → itself; anything else → `undefined`. */
export function aiOrUndefined(value: unknown): AIAnalysis | undefined {
  return isAIAnalysis(value) ? value : undefined;
}

/** Narrows an unknown triage string to the union, or `undefined`. */
export function toTriage(value: unknown): Triage | undefined {
  return typeof value === 'string' && TRIAGE_VALUES.includes(value) ? (value as Triage) : undefined;
}
