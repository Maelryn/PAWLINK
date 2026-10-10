import { Injectable } from '@nestjs/common';
import type { Species, Triage } from '../shared/types';
import { hashHue } from './hash-hue';
import type { AIProvider, AiModelAnswer, AnalyzeInput } from './ai.provider';
import { evaluateRules, helpForTags, isHerd } from './safety-rules';
import { templatesFor } from './templates';

/**
 * The offline provider (`AI_PROVIDER=mock`, the default).
 *
 * A port of `apps/web/lib/ai/analyze.ts` minus its I18n: same tags, same
 * keyword lists, same advice selection, same confidence seed, same ordering —
 * with the templates moved server-side and the suggestions left to the service.
 * It is deterministic and has no I/O, so it answers in microseconds and the
 * whole request stays far inside the 5-second budget.
 */

/** The model string the web used, kept so the UI's "mock" badge still reads right. */
export const MOCK_MODEL = 'gemini-flash (mock)';

/** Species the case did not name. The web's `signsMap` has no entry for it. */
const UNKNOWN_SPECIES: Species = 'other';

@Injectable()
export class MockProvider implements AIProvider {
  readonly name = 'mock' as const;

  async analyze(input: AnalyzeInput): Promise<AiModelAnswer> {
    const t = templatesFor(input.lang);
    const species = input.species ?? UNKNOWN_SPECIES;
    const speciesName = t.species[species];
    const count = input.count ?? 1;
    const tags = input.conditionTags ?? [];

    // The rule layer runs after this, so a provider may call anything it likes:
    // the rules are the last word, not a hint.
    const rules = evaluateRules(input.description, tags);

    let triage: Triage =
      input.baseline ?? (rules.monitor || rules.contagious ? 'monitoring' : 'stable');

    const forcedUrgentByRule = rules.hit && triage !== 'urgent';
    if (rules.hit) triage = 'urgent';

    const observedSigns = tags.map((tag) => t.signsMap[tag]).filter(Boolean);
    if (observedSigns.length === 0) observedSigns.push(t.signsMap.healthy);

    const a = t.advice;
    const advice = new Set<string>();
    if (tags.some((tag) => ['fire', 'smoke', 'trapped'].includes(tag))) advice.add(a.yourSafety);
    if (tags.includes('burned')) {
      advice.add(a.cool);
      advice.add(a.noOintment);
    }
    if (tags.some((tag) => ['smoke', 'breathing'].includes(tag))) advice.add(a.smoke);
    if (tags.includes('bleeding')) advice.add(a.pressure);
    if (tags.some((tag) => ['dehydrated', 'heat', 'burned'].includes(tag))) advice.add(a.water);
    if (tags.includes('young')) advice.add(a.warm);
    if (isHerd(species, count)) advice.add(a.herd);
    if (triage !== 'stable') advice.add(a.distance);
    advice.add(a.noFood);
    advice.add(a.vet);

    const help = helpForTags(tags, triage);

    // The web's confidence is a hash of the text: stable across reloads, so the
    // same report always shows the same number, and it never looks random.
    const seed = hashHue(input.description + species) / 360;

    return {
      triage,
      confidence: Math.round((0.8 + seed * 0.16) * 100) / 100,
      summary: t.summaries[triage](speciesName, count),
      observedSigns,
      safetyAdvice: [...advice].slice(0, 5),
      possiblyContagious: rules.contagious,
      contagionAdvice: rules.contagious ? [a.isolate, a.bowls, a.hands] : undefined,
      recommendedHelp: [...help],
      forcedUrgentByRule,
      disclaimer: t.disclaimer,
      model: MOCK_MODEL,
      // §7.3: `true` when a photo was sent, `null` when none. It becomes the
      // `animalDetected` trust check.
      animalDetected: (input.photoUrls?.length ?? 0) > 0 ? true : null,
    };
  }
}
