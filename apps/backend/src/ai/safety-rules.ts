import type { HelpType, Species, Triage } from '../shared/types';

/**
 * The safety-rule layer (docs/BACKEND_PROMPT.md §3.4 rule 3, ported verbatim from
 * `apps/web/lib/ai/analyze.ts`).
 *
 * This runs **after** the model and **overrides** it. The keyword lists are the
 * web's own, copied as-is, because a hit must mean the same thing on both sides
 * of the wire: if the browser says "this is urgent", the server must agree — and
 * if the browser has no opinion, the server still has to.
 *
 * Rules can only ever *raise* a triage. A model that under-calls an emergency is
 * a bug; a model that over-calls one is a mistake we can live with, and the fix
 * for that is a human reading the case, not a softer rule.
 */

/** Condition tags that are an emergency on their own. */
export const URGENT_TAGS = ['trapped', 'bleeding', 'breathing', 'fire', 'burned'] as const;

/** Condition tags that suggest something transmissible. */
export const CONTAGIOUS_TAGS = ['eyes', 'sneezing', 'skin', 'itching', 'coughing'] as const;

/** Tags that make a case worth watching. Includes the contagious set, as in the web. */
export const MONITOR_TAGS = [
  'injured',
  'lost',
  'stressed',
  'thin',
  'dehydrated',
  'limping',
  'not-eating',
  'heat',
  'young',
  'abandoned',
  ...CONTAGIOUS_TAGS,
] as const;

/** Free-text keywords, in French, English, Arabic and Darija. */
export const URGENT_KEYWORDS = [
  // fr
  'saign',
  'sang',
  'feu',
  'brûl',
  'brul',
  'piég',
  'coinc',
  'respir',
  'inconscient',
  'percut',
  'fractur',
  'empoison',
  'convuls',
  // en
  'bleed',
  'blood',
  'fire',
  'burn',
  'trapped',
  'stuck',
  'breath',
  'unconscious',
  'hit by',
  'poison',
  'seizure',
  // ar / darija
  'نزيف',
  'دم',
  'حريق',
  'نار',
  'محاصر',
  'تنفس',
  'حروق',
  'مسموم',
  'ضربتو طوموبيل',
] as const;

export const CONTAGIOUS_KEYWORDS = [
  'gale',
  'mange',
  'toux',
  'cough',
  'diarr',
  'vomi',
  'teigne',
  'سعال',
  'إسهال',
  'جرب',
] as const;

/**
 * Condition tags that each kind of help, exactly as the web maps them. Kept here
 * so the mock provider and the model both speak about the same need.
 */
const MEDICAL_TAGS = [
  'injured',
  'bleeding',
  'burned',
  'breathing',
  'limping',
  'coughing',
  'eyes',
  'skin',
  'not-eating',
] as const;
const TRANSPORT_TAGS = ['trapped', 'injured', 'burned', 'bleeding'] as const;
const SEARCH_TAGS = ['trapped', 'lost'] as const;
const FOOD_TAGS = ['needs-food', 'dehydrated', 'thin', 'evacuated'] as const;
const BOARDING_TAGS = ['needs-shelter', 'evacuated'] as const;
const FOSTER_TAGS = ['abandoned', 'young'] as const;

/** Livestock sized in animals rather than individuals. */
const HERD_SPECIES: readonly Species[] = ['sheep', 'goat', 'cow', 'camel', 'chicken'];

/** Triage ordering: a rule may raise a level, never lower it. */
const TRIAGE_ORDER: readonly Triage[] = ['stable', 'monitoring', 'urgent'];

export function triageRank(triage: Triage): number {
  return TRIAGE_ORDER.indexOf(triage);
}

/** `raiseTriage('stable', 'urgent') === 'urgent'`; `raiseTriage('urgent', 'stable') === 'urgent'`. */
export function raiseTriage(current: Triage, requested: Triage): Triage {
  return triageRank(requested) > triageRank(current) ? requested : current;
}

/** True when the description or the tags say "this cannot wait". */
export function matchesUrgentRule(description: string, conditionTags: readonly string[]): boolean {
  const text = description.toLowerCase();
  return (
    conditionTags.some((tag) => (URGENT_TAGS as readonly string[]).includes(tag)) ||
    URGENT_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))
  );
}

/** True when the description or the tags suggest something transmissible. */
export function matchesContagiousRule(
  description: string,
  conditionTags: readonly string[],
): boolean {
  const text = description.toLowerCase();
  return (
    conditionTags.some((tag) => (CONTAGIOUS_TAGS as readonly string[]).includes(tag)) ||
    CONTAGIOUS_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))
  );
}

/** True when the tags alone put the case in the "watch it" bucket. */
export function matchesMonitorRule(conditionTags: readonly string[]): boolean {
  return conditionTags.some((tag) => (MONITOR_TAGS as readonly string[]).includes(tag));
}

export interface RuleOutcome {
  /** Urgent, whatever the model said. */
  hit: boolean;
  contagious: boolean;
  monitor: boolean;
}

/** The three rule families, evaluated once. */
export function evaluateRules(description: string, conditionTags: readonly string[]): RuleOutcome {
  return {
    hit: matchesUrgentRule(description, conditionTags),
    contagious: matchesContagiousRule(description, conditionTags),
    monitor: matchesMonitorRule(conditionTags),
  };
}

/** The help this case needs, derived from the tags — the web's own mapping. */
export function helpForTags(
  conditionTags: readonly string[],
  triage: Triage,
): Set<HelpType> {
  const help = new Set<HelpType>();
  const has = (list: readonly string[]) => conditionTags.some((tag) => list.includes(tag));

  if (has(MEDICAL_TAGS) || triage === 'urgent') help.add('medical');
  if (has(TRANSPORT_TAGS)) help.add('transport');
  if (has(SEARCH_TAGS)) help.add('search');
  if (has(FOOD_TAGS)) help.add('food');
  if (has(BOARDING_TAGS)) help.add('boarding');
  if (has(FOSTER_TAGS)) help.add('foster');
  // An empty set would tell the map "nothing is needed", which is never true.
  if (help.size === 0) help.add('foster');

  return help;
}

/** True when a group of animals is involved, so the herd advice applies. */
export function isHerd(species: Species, count: number): boolean {
  return count > 2 && HERD_SPECIES.includes(species);
}
