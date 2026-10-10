import type { HelpType, Species, Triage } from '../shared/types';
import type { LatLng } from '../geo/geo.service';
import type { Lang } from './templates';

/** What the AI is asked. Mirrors the `POST /ai/analyze` body (§3.4). */
export interface AnalyzeInput {
  /** Photo URLs — only their presence matters to `animalDetected`. */
  photoUrls?: string[];
  description: string;
  species?: Species;
  conditionTags?: string[];
  location: LatLng;
  count?: number;
  /** The triage already stored on the case. Rules can only raise it. */
  baseline?: Triage;
  /** Which language the answer should be written in. Defaults to French. */
  lang?: Lang;
}

/**
 * The model's raw answer, before the safety-rule layer and before the local
 * geography is added.
 *
 * It is `AIAnalysis` minus `suggestedServices`/`suggestedHelpers`: those depend on
 * what is actually open near the animal, which no model — local or remote —
 * knows, so the service fills them in from PostGIS afterwards. Keeping them out
 * of the provider interface is what stops a provider from inventing distances.
 */
export interface AiModelResult {
  triage: Triage;
  confidence: number;
  summary: string;
  observedSigns: string[];
  safetyAdvice: string[];
  possiblyContagious: boolean;
  contagionAdvice?: string[];
  recommendedHelp: HelpType[];
  /** Always `false` from a provider — the rule layer is the only writer. */
  forcedUrgentByRule: boolean;
  disclaimer: string;
  model: string;
}

/**
 * The provider's whole answer: the model result plus the two photo facts only a
 * vision model can supply.
 *
 * `animalDetected` is `null` when the model could not tell — which is also what
 * it is for a report with no photo at all — and never a guess.
 */
export interface AiModelAnswer extends AiModelResult {
  animalDetected: boolean | null;
  isRealPhoto?: boolean;
}

/**
 * A triage model. Chosen by `AI_PROVIDER`; swapping one for the other is an
 * environment change and nothing else (docs/BACKEND_PROMPT.md §3.4 rule 2).
 */
export interface AIProvider {
  readonly name: 'mock' | 'gemini';
  analyze(input: AnalyzeInput): Promise<AiModelAnswer>;
}
