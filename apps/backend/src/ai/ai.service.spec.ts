import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaService } from '../common/prisma/prisma.service';
import { isAIAnalysis } from '../shared/ai-analysis';
import { AiService, FALLBACK_MODEL } from './ai.service';
import urgentFallback from './fallbacks/urgent.json';
import monitoringFallback from './fallbacks/monitoring.json';
import stableFallback from './fallbacks/stable.json';

/**
 * The AI pipeline: the mock provider's shape, the safety-rule override, and the
 * fallback path.
 *
 * The database is stubbed. The two suggestion queries are the only PostGIS work
 * here and they are covered by the e2e suite against a real container; what this
 * suite has to prove is the *ordering* — model first, rules over it, geography
 * last, validation at the end.
 */

const ALGER = { lat: 36.7538, lng: 3.0588 };

/** A Prisma stub: no rows, so the suggestion lists stay empty and predictable. */
function stubPrisma(): PrismaService {
  return {
    $queryRaw: async () => [],
    user: { findMany: async () => [] },
  } as unknown as PrismaService;
}

function service(): AiService {
  return new AiService(stubPrisma());
}

/** A description that trips an urgent keyword in the language named. */
const URGENT_BY_LANGUAGE: Array<[string, string]> = [
  ['fr', 'Le chien saigne beaucoup'],
  ['en', 'The dog is bleeding badly'],
  ['ar', 'الحيوان ينزيف'],
  ['darija', 'ضربتو طوموبيل'],
];

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.AI_PROVIDER = 'mock';
  delete process.env.GEMINI_API_KEY;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('the mock provider', () => {
  it('answers with the AIAnalysis shape and its own model string', async () => {
    const result = await service().analyze({
      description: 'Un chat amaigri dort dans la rue.',
      species: 'cat',
      conditionTags: ['thin'],
      location: ALGER,
      count: 1,
    });

    expect(isAIAnalysis(result)).toBe(true);
    expect(result.model).toBe('gemini-flash (mock)');
    expect(result.triage).toBe('monitoring');
    expect(result.forcedUrgentByRule).toBe(false);
    expect(result.disclaimer).toMatch(/vétérinaire/i);
    expect(result.suggestedServices).toEqual([]);
    expect(result.suggestedHelpers).toEqual([]);
  });

  it('never diagnoses: the disclaimer names a veterinarian on every path', async () => {
    const cases = await Promise.all([
      service().analyze({ description: 'il saigne', species: 'dog', conditionTags: ['bleeding'], location: ALGER }),
      service().analyze({ description: 'un chat dort', species: 'cat', conditionTags: [], location: ALGER }),
      service().analyze({ description: '', species: 'other', conditionTags: [], location: ALGER }),
    ]);

    for (const result of cases) {
      expect(result.disclaimer.length).toBeGreaterThan(0);
      expect(result.disclaimer).toMatch(/vétérinaire|veterinarian|بيطري/i);
    }
  });

  it('suggests the help the tags call for', async () => {
    const result = await service().analyze({
      description: 'un chien coincé sous une voiture',
      species: 'dog',
      conditionTags: ['trapped', 'bleeding'],
      location: ALGER,
    });

    expect(result.triage).toBe('urgent');
    expect(result.forcedUrgentByRule).toBe(true);
    expect(result.recommendedHelp).toContain('medical');
    expect(result.recommendedHelp).toContain('transport');
    expect(result.recommendedHelp).toContain('search');
  });

  it('writes the answer in the requested language', async () => {
    const fr = await service().analyze({
      description: 'un chat amaigri',
      species: 'cat',
      conditionTags: ['thin'],
      location: ALGER,
      lang: 'fr',
    });
    const en = await service().analyze({
      description: 'un chat amaigri',
      species: 'cat',
      conditionTags: ['thin'],
      location: ALGER,
      lang: 'en',
    });
    const ar = await service().analyze({
      description: 'un chat amaigri',
      species: 'cat',
      conditionTags: ['thin'],
      location: ALGER,
      lang: 'ar',
    });

    expect(fr.summary).toContain("L'animal");
    expect(en.summary).toContain('This cat needs attention');
    expect(ar.summary).toContain('يحتاج اهتمامًا');
    // same text, same score — the confidence seed is the description + species
    expect(fr.confidence).toBe(en.confidence);
    expect(fr.confidence).toBe(ar.confidence);
  });

  it('counts a herd in the summary', async () => {
    const result = await service().analyze({
      description: 'cinq moutons dans un champ',
      species: 'sheep',
      conditionTags: [],
      location: ALGER,
      count: 5,
    });

    expect(result.summary).toContain('5 animaux');
  });
});

describe('animalDetected', () => {
  it('is true when a photo was sent', async () => {
    const result = await service().analyze({
      description: 'un chien',
      species: 'dog',
      conditionTags: [],
      location: ALGER,
      photoUrls: ['https://res.cloudinary.com/demo/image/upload/x.jpg'],
    });

    expect(result.animalDetected).toBe(true);
  });

  it('is null when no photo was sent', async () => {
    const result = await service().analyze({
      description: 'un chien',
      species: 'dog',
      conditionTags: [],
      location: ALGER,
    });

    expect(result.animalDetected).toBeNull();
  });

  it('is null when photos are an empty list', async () => {
    const result = await service().analyze({
      description: 'un chien',
      species: 'dog',
      conditionTags: [],
      location: ALGER,
      photoUrls: [],
    });

    expect(result.animalDetected).toBeNull();
  });
});

describe('the safety-rule layer overrides the model', () => {
  it.each(URGENT_BY_LANGUAGE)('forces urgent on a %s keyword', async (_language, description) => {
    const result = await service().analyze({
      description,
      species: 'dog',
      // No urgent tag: the keyword alone has to do it.
      conditionTags: ['thin'],
      location: ALGER,
    });

    expect(result.triage).toBe('urgent');
    expect(result.forcedUrgentByRule).toBe(true);
    expect(result.recommendedHelp).toContain('medical');
  });

  it('only raises, never lowers', async () => {
    // A stable description with an urgent baseline stays urgent.
    const result = await service().analyze({
      description: 'un chat dort tranquillement',
      species: 'cat',
      conditionTags: [],
      location: ALGER,
      baseline: 'urgent',
    });

    expect(result.triage).toBe('urgent');
    expect(result.forcedUrgentByRule).toBe(false);
  });

  it('raises a monitoring baseline to urgent on a keyword', async () => {
    const result = await service().analyze({
      description: 'le chat saigne un peu',
      species: 'cat',
      conditionTags: [],
      location: ALGER,
      baseline: 'monitoring',
    });

    expect(result.triage).toBe('urgent');
    expect(result.forcedUrgentByRule).toBe(true);
  });

  it('detects a contagious case from the description alone', async () => {
    const result = await service().analyze({
      description: 'il a la gale et se gratte sans arrêt',
      species: 'dog',
      conditionTags: [],
      location: ALGER,
    });

    expect(result.possiblyContagious).toBe(true);
    expect(result.contagionAdvice?.length).toBeGreaterThan(0);
  });
});

describe('the three cached fallbacks', () => {
  it('all validate against the AIAnalysis shape', () => {
    expect(isAIAnalysis(urgentFallback)).toBe(true);
    expect(isAIAnalysis(monitoringFallback)).toBe(true);
    expect(isAIAnalysis(stableFallback)).toBe(true);
  });

  it('cover one triage level each', () => {
    expect(urgentFallback.triage).toBe('urgent');
    expect(monitoringFallback.triage).toBe('monitoring');
    expect(stableFallback.triage).toBe('stable');
  });

  it('carry a distinct model string, so they are never mistaken for a real answer', () => {
    expect(urgentFallback.model).toBe(FALLBACK_MODEL);
    expect(monitoringFallback.model).toBe(FALLBACK_MODEL);
    expect(stableFallback.model).toBe(FALLBACK_MODEL);
    expect(FALLBACK_MODEL).not.toBe('gemini-flash (mock)');
  });

  it('all carry the disclaimer', () => {
    for (const fallback of [urgentFallback, monitoringFallback, stableFallback]) {
      expect(fallback.disclaimer).toMatch(/veterinarian/i);
    }
  });
});

describe('a model failure falls back instead of throwing', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('uses a cached example when the provider cannot be reached', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'not-a-real-key';

    globalThis.fetch = (async () => {
      throw new Error('network unreachable');
    }) as unknown as typeof globalThis.fetch;

    const result = await service().analyze({
      description: 'un chien très maigre',
      species: 'dog',
      conditionTags: ['thin'],
      location: ALGER,
      baseline: 'monitoring',
    });

    expect(result.model).toBe(FALLBACK_MODEL);
    expect(result.triage).toBe('monitoring');
    // a fallback has seen nothing, so it must not claim to have
    expect(result.animalDetected).toBeNull();
    expect(isAIAnalysis(result)).toBe(true);
  });

  it('still applies the safety rules to a fallback', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'not-a-real-key';

    globalThis.fetch = (async () => {
      throw new Error('network unreachable');
    }) as unknown as typeof globalThis.fetch;

    const result = await service().analyze({
      description: 'un chien qui saigne',
      species: 'dog',
      conditionTags: [],
      location: ALGER,
    });

    expect(result.model).toBe(FALLBACK_MODEL);
    expect(result.triage).toBe('urgent');
    expect(result.forcedUrgentByRule).toBe(true);
  });

  it('falls back when the provider answers something unusable', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'not-a-real-key';

    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json at all' }] } }] }),
      text: async () => 'not json at all',
    })) as unknown as typeof globalThis.fetch;

    const result = await service().analyze({
      description: 'un chat dort',
      species: 'cat',
      conditionTags: [],
      location: ALGER,
      baseline: 'stable',
    });

    expect(result.model).toBe(FALLBACK_MODEL);
    expect(result.triage).toBe('stable');
  });

  it('falls back when the provider answers an unknown triage', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'not-a-real-key';

    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    triage: 'catastrophic',
                    confidence: 0.9,
                    summary: 'x',
                    observedSigns: [],
                    safetyAdvice: [],
                    possiblyContagious: false,
                    recommendedHelp: ['medical'],
                  }),
                },
              ],
            },
          },
        ],
      }),
      text: async () => '',
    })) as unknown as typeof globalThis.fetch;

    const result = await service().analyze({
      description: 'un chat dort',
      species: 'cat',
      conditionTags: [],
      location: ALGER,
      baseline: 'stable',
    });

    expect(result.model).toBe(FALLBACK_MODEL);
  });

  it('uses the mock provider when gemini is asked for but no key is set', async () => {
    process.env.AI_PROVIDER = 'gemini';
    delete process.env.GEMINI_API_KEY;

    expect(service().providerName()).toBe('mock');
  });
});
