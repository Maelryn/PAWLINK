import { Injectable, Logger } from '@nestjs/common';
import { isLang } from './templates';
import type { AIProvider, AiModelAnswer, AnalyzeInput } from './ai.provider';

/**
 * Gemini Flash (docs/BACKEND_PROMPT.md §3.4 rules 1, 2, 5 and PHASE2_PLAN §7.4).
 *
 * Chosen with `AI_PROVIDER=gemini`. The key stays here, server-side: the
 * frontend never sees it and never calls the model itself.
 *
 * The whole contract is "or the fallback". A timeout, a network error, an HTTP
 * error, an unparseable body or a body that fails validation all end the same
 * way — the caller gets a cached example answer clearly marked as one, so a
 * model outage degrades the triage instead of breaking the report.
 */

/** Hard ceiling. The budget in the spec is 5 s, so the call gets less than that. */
export const GEMINI_TIMEOUT_MS = 4000;

/** Which Gemini model to call. An alias, so it keeps working across releases. */
const DEFAULT_MODEL = 'gemini-flash-latest';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** The one shape we accept back from the model. */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    triage: { type: 'string', enum: ['urgent', 'monitoring', 'stable'] },
    confidence: { type: 'number' },
    summary: { type: 'string' },
    observedSigns: { type: 'array', items: { type: 'string' } },
    safetyAdvice: { type: 'array', items: { type: 'string' } },
    possiblyContagious: { type: 'boolean' },
    contagionAdvice: { type: 'array', items: { type: 'string' } },
    recommendedHelp: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['transport', 'foster', 'food', 'medical', 'search', 'boarding', 'funds'],
      },
    },
    animalDetected: { type: 'boolean' },
    isRealPhoto: { type: 'boolean' },
  },
  required: [
    'triage',
    'confidence',
    'summary',
    'observedSigns',
    'safetyAdvice',
    'possiblyContagious',
    'recommendedHelp',
  ],
} as const;

/** The instruction. Deliberately explicit about what it must *not* do. */
function promptFor(input: AnalyzeInput, lang: string): string {
  const tags = (input.conditionTags ?? []).join(', ') || 'none reported';
  const species = input.species ?? 'unknown';
  const count = input.count ?? 1;

  return [
    'You triage animal-rescue reports for an Algerian platform. You are not a veterinarian and you',
    'never diagnose: no condition names, no medication, no prognosis. You describe what was',
    'reported and what a bystander can safely do while help is on the way.',
    '',
    `Answer in ${lang}. Return JSON only, matching the provided schema.`,
    '',
    'Report',
    `- species: ${species}`,
    `- count: ${count}`,
    `- reporter's location: ${input.location.lat.toFixed(4)}, ${input.location.lng.toFixed(4)}`,
    `- observed tags: ${tags}`,
    `- description: ${input.description || '(none)'}`,
    '',
    'Set `triage` to "urgent" only for something that cannot wait: bleeding, burns, fire,',
    'trapped, breathing trouble, a road accident, poisoning. "monitoring" for something that',
    'needs attention today. "stable" otherwise.',
    'Set `possiblyContagious` when the signs suggest something transmissible.',
    '`safetyAdvice` is at most five short imperative sentences a bystander can act on.',
    '`recommendedHelp` lists only the help types the report actually needs.',
  ].join('\n');
}

@Injectable()
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;
  private readonly logger = new Logger(GeminiProvider.name);

  async analyze(input: AnalyzeInput): Promise<AiModelAnswer> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      // A misconfigured deployment is not a bad report: fall back like anything
      // else and say so in the log.
      this.logger.error('AI_PROVIDER=gemini but GEMINI_API_KEY is not set — using the fallback.');
      throw new Error('GEMINI_API_KEY is not set');
    }

    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
    const lang = isLang(input.lang) ? input.lang : 'French';

    const parts: Array<Record<string, unknown>> = [{ text: promptFor(input, lang) }];
    // Photos are public Cloudinary URLs, so they can be handed to Gemini by
    // reference — the API does not need the bytes proxied through us.
    for (const url of input.photoUrls ?? []) {
      parts.push({ fileData: { fileUri: url } });
    }

    const response = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      // The detail is logged, never returned: it can quote the request.
      this.logger.warn(`Gemini ${response.status}: ${detail || response.statusText}`);
      throw new Error(`Gemini answered ${response.status}`);
    }

    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error('Gemini returned no content');

    return this.parse(text, model);
  }

  /**
   * Turns the model's JSON into an `AiModelAnswer`.
   *
   * Every field is re-checked here rather than trusted: a JSON schema in the
   * request is a request, not a guarantee, and a malformed answer has to become
   * a fallback rather than a broken `AIAnalysis` in the database.
   */
  private parse(text: string, model: string): AiModelAnswer {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('Gemini did not return JSON');
    }

    const value = raw as Record<string, unknown>;
    const triage = value.triage;
    if (triage !== 'urgent' && triage !== 'monitoring' && triage !== 'stable') {
      throw new Error(`Gemini returned an unknown triage: ${String(triage)}`);
    }

    const strings = (key: string): string[] =>
      Array.isArray(value[key]) ? (value[key] as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const number = (key: string, fallback: number): number => {
      const n = value[key];
      return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
    };
    const bool = (key: string, fallback: boolean): boolean => {
      const b = value[key];
      return typeof b === 'boolean' ? b : fallback;
    };

    const recommendedHelp = strings('recommendedHelp').filter((h) =>
      ['transport', 'foster', 'food', 'medical', 'search', 'boarding', 'funds'].includes(h),
    ) as AiModelAnswer['recommendedHelp'];

    return {
      triage,
      confidence: Math.min(1, Math.max(0, number('confidence', 0.7))),
      summary: typeof value.summary === 'string' ? value.summary : '',
      observedSigns: strings('observedSigns'),
      safetyAdvice: strings('safetyAdvice'),
      possiblyContagious: bool('possiblyContagious', false),
      contagionAdvice: Array.isArray(value.contagionAdvice) ? strings('contagionAdvice') : undefined,
      recommendedHelp,
      // Replaced by the rule layer, which runs after the model no matter what.
      forcedUrgentByRule: false,
      // Replaced by the template: the disclaimer is ours, never the model's.
      disclaimer: '',
      model,
      animalDetected: typeof value.animalDetected === 'boolean' ? value.animalDetected : null,
      isRealPhoto: typeof value.isRealPhoto === 'boolean' ? value.isRealPhoto : undefined,
    };
  }
}
