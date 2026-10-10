import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/filters/http-exception.filter';
import { PrismaService } from '../common/prisma/prisma.service';
import { distanceKm, type LatLng } from '../geo/geo.service';
import { isAIAnalysis, aiOrUndefined } from '../shared/ai-analysis';
import type { AIAnalysis, HelpType, ServiceType, Triage } from '../shared/types';
import type { AIProvider, AiModelAnswer, AnalyzeInput } from './ai.provider';
import { GeminiProvider } from './gemini.provider';
import { MockProvider } from './mock.provider';
import { evaluateRules, raiseTriage } from './safety-rules';
import { isLang, templatesFor } from './templates';

import fallbackUrgent from './fallbacks/urgent.json';
import fallbackMonitoring from './fallbacks/monitoring.json';
import fallbackStable from './fallbacks/stable.json';

/**
 * `POST /ai/analyze` — the triage, assembled (docs/BACKEND_PROMPT.md §3.4).
 *
 * The order of the steps is the contract:
 *
 *   1. ask the provider (mock by default, Gemini when configured);
 *   2. run the **safety-rule layer over the answer** — it can only raise the
 *      triage, and a hit forces `urgent` with `forcedUrgentByRule: true`;
 *   3. add the geography no model knows: the nearest vets / shelters / transport
 *      and the volunteers whose declared skills match, from PostGIS;
 *   4. replace the disclaimer with ours — never the model's words;
 *   5. validate. Anything that fails at any point becomes one of the three
 *      cached examples, marked as such so it is never mistaken for a real answer.
 *
 * The result is what the caller gets from `POST /ai/analyze` and what
 * `POST /cases` stores as `Case.ai`.
 */

export interface AnalyzeResult extends AIAnalysis {
  /** `true` when a photo was sent and the provider saw an animal, `null` when it could not tell. */
  animalDetected: boolean | null;
  /** Set only by a provider that can tell a real photo from a generated one. */
  isRealPhoto?: boolean;
}

/** The three cached answers, keyed by the triage they stand in for. */
const FALLBACKS: Record<Triage, unknown> = {
  urgent: fallbackUrgent,
  monitoring: fallbackMonitoring,
  stable: fallbackStable,
};

/** The marker on a fallback answer, so a human reading the case can tell. */
export const FALLBACK_MODEL = 'gemini-flash (fallback)';

/** How far away a volunteer may be and still be suggested. */
export const MAX_HELPER_DISTANCE_KM = 60;

/** How many suggestions of each kind at most. */
const SUGGESTION_LIMIT = 3;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly mock = new MockProvider();
  private readonly gemini: GeminiProvider | null;

  constructor(private readonly prisma: PrismaService) {
    this.gemini = process.env.GEMINI_API_KEY?.trim() ? new GeminiProvider() : null;
  }

  /** Which provider is live, for logs and for the e2e's assertions. */
  providerName(): 'mock' | 'gemini' {
    return (process.env.AI_PROVIDER ?? 'mock') === 'gemini' && this.gemini ? 'gemini' : 'mock';
  }

  /**
   * Runs the whole pipeline. Never throws for a model failure: a bad answer
   * degrades to a cached example, because a report that cannot be triaged is
   * still a report that has to be filed.
   */
  async analyze(input: AnalyzeInput): Promise<AnalyzeResult> {
    const provider = this.resolveProvider();
    const lang = isLang(input.lang) ? input.lang : undefined;
    const t = templatesFor(lang);

    let answer: AiModelAnswer | null = null;
    let failure: string | null = null;

    try {
      answer = await provider.analyze({ ...input, lang });
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI provider "${provider.name}" failed — using a cached fallback: ${failure}`);
    }

    const species = input.species ?? 'other';
    const count = input.count ?? 1;
    const tags = input.conditionTags ?? [];

    const worked = answer !== null && this.isUsable(answer);
    if (answer && !worked) {
      failure = 'the answer failed validation';
      this.logger.warn('AI provider returned an unusable answer — using a cached fallback.');
    }

    const rules = evaluateRules(input.description, tags);

    // ── the safety-rule layer, after the model, overriding it ──
    let triage: Triage;
    let forcedUrgentByRule: boolean;
    let model: string;
    let confidence: number;
    let summary: string;
    let observedSigns: string[];
    let safetyAdvice: string[];
    let possiblyContagious: boolean;
    let contagionAdvice: string[] | undefined;
    let recommendedHelp: HelpType[];
    let animalDetected: boolean | null;
    let isRealPhoto: boolean | undefined;

    if (worked && answer) {
      // The provider's triage is only a starting point: the stored baseline may
      // already have raised it, and a rule hit raises it further.
      const modelTriage = raiseTriage(input.baseline ?? 'stable', answer.triage);
      triage = rules.hit ? 'urgent' : modelTriage;
      // §3.4 rule 3: a hit forces urgent and says so. This is the flag the map
      // shows to explain *why* a case is urgent.
      forcedUrgentByRule = rules.hit;

      confidence = answer.confidence;
      // The provider's own words are kept when the rules left them standing.
      // When a rule overrode an under-call, its summary would contradict the
      // triage next to it — so the template is used instead.
      summary =
        triage === modelTriage && answer.summary
          ? answer.summary
          : t.summaries[triage](t.species[species], count);
      observedSigns = answer.observedSigns;
      safetyAdvice = answer.safetyAdvice;
      possiblyContagious = answer.possiblyContagious || rules.contagious;
      contagionAdvice = answer.contagionAdvice ??
        (possiblyContagious ? [t.advice.isolate, t.advice.bowls, t.advice.hands] : undefined);
      recommendedHelp =
        answer.recommendedHelp.length > 0 ? [...answer.recommendedHelp] : ['foster'];
      // An urgent case needs a medic, whatever the model volunteered.
      if (triage === 'urgent' && !recommendedHelp.includes('medical')) {
        recommendedHelp.unshift('medical');
      }
      animalDetected = answer.animalDetected ?? null;
      isRealPhoto = answer.isRealPhoto;
      model = answer.model;
    } else {
      // ── the cached fallback ──
      const cached = aiOrUndefined(FALLBACKS[rules.hit ? 'urgent' : (input.baseline ?? 'stable')]);
      if (!cached) throw new ApiError(500, 'AI_FALLBACK_INVALID', 'The cached AI fallbacks are broken.');

      triage = rules.hit ? 'urgent' : cached.triage;
      forcedUrgentByRule = rules.hit;
      confidence = cached.confidence;
      summary = t.summaries[triage](t.species[species], count);
      observedSigns = cached.observedSigns;
      safetyAdvice = cached.safetyAdvice;
      possiblyContagious = cached.possiblyContagious;
      contagionAdvice = cached.contagionAdvice;
      recommendedHelp = cached.recommendedHelp;
      // A fallback has seen nothing, so it must not claim to have.
      animalDetected = null;
      isRealPhoto = undefined;
      model = FALLBACK_MODEL;
    }

    const result: AnalyzeResult = {
      triage,
      confidence,
      summary,
      observedSigns,
      safetyAdvice,
      possiblyContagious,
      ...(contagionAdvice ? { contagionAdvice } : {}),
      recommendedHelp,
      suggestedServices: [],
      suggestedHelpers: [],
      forcedUrgentByRule,
      // Ours, always: rule 4 of §3.4 is not negotiable.
      disclaimer: t.disclaimer,
      model,
      animalDetected,
      ...(isRealPhoto !== undefined ? { isRealPhoto } : {}),
    };

    // ── real geography: the nearest help, from PostGIS ──
    const [suggestedServices, suggestedHelpers] = await Promise.all([
      this.nearestServices(input.location, recommendedHelp),
      this.nearestHelpers(input.location, recommendedHelp),
    ]);
    result.suggestedServices = suggestedServices;
    result.suggestedHelpers = suggestedHelpers;

    if (!isAIAnalysis(result)) {
      // Unreachable by construction; kept because a silent shape change in the
      // contract must fail loudly here rather than in the browser.
      this.logger.error(`Assembled an AIAnalysis that does not validate (failure was: ${failure}).`);
      throw new ApiError(500, 'AI_RESULT_INVALID', 'The AI answer could not be assembled.');
    }

    return result;
  }

  private resolveProvider(): AIProvider {
    const wanted = (process.env.AI_PROVIDER ?? 'mock').trim();
    if (wanted === 'gemini') {
      if (!this.gemini) {
        // Misconfiguration, not a bad report: say so once and answer with the
        // mock rather than failing every request.
        this.logger.error('AI_PROVIDER=gemini but GEMINI_API_KEY is empty — falling back to the mock provider.');
        return this.mock;
      }
      return this.gemini;
    }
    return this.mock;
  }

  /** A model answer missing its mandatory parts is as unusable as a thrown error. */
  private isUsable(answer: AiModelAnswer): boolean {
    return (
      typeof answer.summary === 'string' &&
      Array.isArray(answer.observedSigns) &&
      Array.isArray(answer.safetyAdvice) &&
      Array.isArray(answer.recommendedHelp) &&
      typeof answer.confidence === 'number'
    );
  }

  /**
   * Nearest services, by the type the case actually needs.
   *
   * One `ORDER BY location <-> $1::geography` per type, so the GIST index does
   * the sorting instead of us scanning every service and doing the maths in
   * JavaScript. Distances are already kilometres, rounded to 0.1 — the same
   * rounding the web mock applied, so the numbers look unchanged.
   */
  private async nearestServices(
    location: LatLng,
    help: HelpType[],
  ): Promise<AIAnalysis['suggestedServices']> {
    const wanted: ServiceType[] = ['vet'];
    if (help.includes('transport')) wanted.push('transport');
    wanted.push('shelter');

    const found: AIAnalysis['suggestedServices'] = [];
    for (const type of wanted) {
      const rows = await this.prisma.$queryRaw<
        Array<{ id: string; name: string; type: string; km: number }>
      >(
        Prisma.sql`
          SELECT id, name, type::text AS type,
                 round((ST_Distance(location, ${point(location)}) / 1000)::numeric, 1) AS km
          FROM services
          WHERE type = ${type}::"ServiceType"
          ORDER BY location <-> ${point(location)}
          LIMIT 1
        `,
      );
      const row = rows[0];
      if (row) {
        found.push({
          serviceId: row.id,
          type: row.type as ServiceType,
          name: row.name,
          distanceKm: Number(row.km),
        });
      }
    }

    return found.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, SUGGESTION_LIMIT);
  }

  /**
   * Nearest volunteers and vets whose declared skills match what the case needs.
   *
   * `users` carries plain `lat`/`lng` columns and no geography column, so this
   * reads them through Prisma and measures with the same great-circle formula the
   * trust pipeline uses. It is still real data from the database rather than a
   * hand-written array — adding `users.location` is a schema change outside this
   * phase's scope (see README §Deviations).
   */
  private async nearestHelpers(
    location: LatLng,
    help: HelpType[],
  ): Promise<NonNullable<AIAnalysis['suggestedHelpers']>> {
    if (help.length === 0) return [];

    const candidates = await this.prisma.user.findMany({
      where: {
        role: { in: ['volunteer', 'vet'] },
        lat: { not: null },
        lng: { not: null },
        helpTypes: { hasSome: help },
      },
      select: { id: true, name: true, helpTypes: true, lat: true, lng: true },
    });

    return candidates
      .flatMap((u) => {
        const matching = u.helpTypes.find((h) => help.includes(h));
        if (!matching || u.lat == null || u.lng == null) return [];
        const km = Math.round(distanceKm(location, { lat: u.lat, lng: u.lng }) * 10) / 10;
        return km < MAX_HELPER_DISTANCE_KM
          ? [{ userId: u.id, name: u.name, helpType: matching, distanceKm: km }]
          : [];
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, SUGGESTION_LIMIT);
  }
}

/** `{ lat, lng }` → the geography literal the PostGIS statements expect. */
function point(location: LatLng): Prisma.Sql {
  return Prisma.sql`ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)::geography`;
}
