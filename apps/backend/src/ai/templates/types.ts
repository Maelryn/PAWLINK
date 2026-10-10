import type { Species, Triage } from '../../shared/types';

/**
 * The AI templates, ported from `apps/web/lib/i18n/{en,fr,ar}.ts`.
 *
 * The mock provider has to answer in the language the caller asked for, exactly
 * like the web's own `analyze()` did — the strings the map shows must not change
 * when the logic moves from the browser to the server. They live here, and only
 * here, so there is one copy to keep in step with the frontend.
 *
 * Everything is a plain function or a record: no I18n provider, no React, no
 * dependency on the web app.
 */

export type Lang = 'fr' | 'en' | 'ar';

/** The safety-advice strings `analyze()` may pick from. */
export type AdviceKey =
  | 'distance'
  | 'noFood'
  | 'cool'
  | 'noOintment'
  | 'smoke'
  | 'pressure'
  | 'water'
  | 'warm'
  | 'yourSafety'
  | 'isolate'
  | 'bowls'
  | 'hands'
  | 'vet'
  | 'herd';

export interface AiTemplates {
  /** `species` → the word a speaker of this language uses. */
  species: Record<Species, string>;
  /** One sentence per triage level, parameterised by (species, count). */
  summaries: Record<Triage, (species: string, count: number) => string>;
  /** `conditionTag` → the plain-language sign. `healthy` is the empty-case fallback. */
  signsMap: Record<string, string>;
  advice: Record<AdviceKey, string>;
  /** Never diagnose. Present on every answer, in every language, on every path. */
  disclaimer: string;
}

const SPECIES = [
  'dog',
  'cat',
  'bird',
  'horse',
  'cow',
  'sheep',
  'goat',
  'camel',
  'donkey',
  'rabbit',
  'chicken',
  'other',
] as const satisfies readonly Species[];

/** Guards the `signsMap` lookups: an unknown tag is dropped, never passed through raw. */
export function isSpecies(value: string): value is Species {
  return (SPECIES as readonly string[]).includes(value);
}
