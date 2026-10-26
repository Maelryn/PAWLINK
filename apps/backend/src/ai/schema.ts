/**
 * Zod schema for Gemini structured output.
 * Used both as JSON Schema sent to the model and as a runtime validator.
 */

import { z } from 'zod';
import type { AIRaw } from './ai.provider';

export const ANIMAL_TYPES = [
  'dog',
  'cat',
  'sheep',
  'goat',
  'cow',
  'horse',
  'bird',
  'rabbit',
  'camel',
  'donkey',
  'chicken',
  'other',
  'unknown',
] as const;

export const ANIMAL_CATEGORIES = ['companion', 'livestock', 'wildlife', 'unknown'] as const;

export const SITUATIONS = [
  'bleeding_wound',
  'trauma_accident',
  'breathing_problem',
  'unresponsive_collapse',
  'seizure',
  'poisoning',
  'fire_smoke_burns',
  'trapped',
  'illness',
  'abandoned_weak',
  'abnormal_behavior',
  'other',
  'unclear',
] as const;

export const RED_FLAGS = [
  'heavy_bleeding',
  'breathing_problem',
  'unresponsive',
  'seizure',
  'suspected_poisoning',
  'smoke_exposure',
  'burns',
  'trapped',
  'major_trauma',
  'suspected_contagious_serious',
] as const;

export const HAZARDS = [
  'abnormal_or_aggressive_behavior',
  'contagion_risk',
  'unstable_structure',
  'active_fire_or_smoke',
  'traffic',
] as const;

export const URGENCIES = ['urgent', 'needs_attention', 'non_urgent'] as const;
export const CONFIDENCES = ['high', 'medium', 'low'] as const;
export const NEEDS = [
  'veterinarian',
  'rescue_volunteer',
  'transport',
  'shelter',
  'foster',
  'specialized_rescue',
] as const;

export const GUIDANCE_KEYS = [
  'bleeding_pressure',
  'keep_calm_still',
  'quiet_ventilated_place',
  'approach_carefully_bite_risk',
  'support_body_when_moving',
  'check_responsive_breathing',
  'keep_away_from_fire_smoke',
  'seizure_safe_environment',
  'poisoning_secure_and_inform',
  'trapped_unstable_area_safety',
  'burns_cool_water',
  'udder_clean_dry_milking',
  'separate_from_other_animals',
  'keep_clean_quiet_place',
  'keep_safe_place',
  'provide_clean_water',
  'contact_vet_immediately',
  'contact_vet_asap',
  'contact_vet_exam',
  'contact_vet_or_rescue',
  'dont_give_medication',
  'dont_force_food_water',
  'dont_make_walk',
  'dont_straighten_leg',
  'dont_remove_cloth_or_pull_objects',
  'dont_shake_animal',
  'seizure_dont',
  'poisoning_dont',
  'debris_dont',
  'burns_dont',
  'dont_assume_ok_smoke',
  'udder_dont',
  'dont_mix_with_other_animals',
  'dont_assume_stomach_trouble',
] as const;

export const geminiTriageSchema = z.object({
  is_animal_report: z.boolean(),
  detected_language: z.string(),
  animal: z.object({
    type: z.enum(ANIMAL_TYPES),
    category: z.enum(ANIMAL_CATEGORIES),
  }),
  situation_category: z.enum(SITUATIONS),
  summary: z.string().min(1),
  red_flags: z.array(z.enum(RED_FLAGS)),
  hazards: z.array(z.enum(HAZARDS)),
  urgency: z.enum(URGENCIES),
  urgency_reason: z.string(),
  confidence: z.enum(CONFIDENCES),
  needs: z.array(z.enum(NEEDS)),
  follow_up_questions: z.array(z.string()).max(5),
  guidance_keys: z.array(z.enum(GUIDANCE_KEYS)),
  animalDetected: z.boolean().optional(),
  isRealPhoto: z.boolean().optional(),
  speciesDetected: z.enum(ANIMAL_TYPES).optional(),
});

function jsonSchemaForGemini(): Record<string, unknown> {
  const generated = z.toJSONSchema(geminiTriageSchema) as Record<string, unknown>;
  const { $schema: _schema, ...rest } = generated;
  return rest;
}

export const GEMINI_JSON_SCHEMA = jsonSchemaForGemini();

const ALLOWED = {
  animalTypes: new Set<string>(ANIMAL_TYPES),
  categories: new Set<string>(ANIMAL_CATEGORIES),
  situations: new Set<string>(SITUATIONS),
  redFlags: new Set<string>(RED_FLAGS),
  hazards: new Set<string>(HAZARDS),
  urgencies: new Set<string>(URGENCIES),
  confidences: new Set<string>(CONFIDENCES),
  needs: new Set<string>(NEEDS),
  guidance: new Set<string>(GUIDANCE_KEYS),
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

function pickAllowed(values: string[], allowed: Set<string>): string[] {
  return [...new Set(values.filter((v) => allowed.has(v)))];
}

/**
 * Validate / coerce a Gemini JSON object into AIRaw.
 * Throws if the payload is not a usable triage object.
 */
export function parseGeminiOutput(raw: unknown): Omit<AIRaw, 'ai_status' | 'needs_human_review'> {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Gemini output is not a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  const animalObj =
    obj.animal && typeof obj.animal === 'object' ? (obj.animal as Record<string, unknown>) : {};

  const animalType = ALLOWED.animalTypes.has(String(animalObj.type))
    ? String(animalObj.type)
    : 'unknown';
  const animalCategory = ALLOWED.categories.has(String(animalObj.category))
    ? String(animalObj.category)
    : 'unknown';
  const situation = ALLOWED.situations.has(String(obj.situation_category))
    ? String(obj.situation_category)
    : 'unclear';
  const urgency = ALLOWED.urgencies.has(String(obj.urgency))
    ? (obj.urgency as AIRaw['urgency'])
    : 'needs_attention';
  const confidence = ALLOWED.confidences.has(String(obj.confidence))
    ? (obj.confidence as AIRaw['confidence'])
    : 'low';
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  if (!summary) {
    throw new Error('Gemini output missing summary');
  }

  const parsed = {
    schema_version: '0.2',
    is_animal_report: Boolean(obj.is_animal_report),
    detected_language: typeof obj.detected_language === 'string' ? obj.detected_language : 'unknown',
    animal: { type: animalType, category: animalCategory },
    situation_category: situation,
    summary,
    red_flags: pickAllowed(asStringArray(obj.red_flags), ALLOWED.redFlags),
    hazards: pickAllowed(asStringArray(obj.hazards), ALLOWED.hazards),
    urgency,
    urgency_reason: typeof obj.urgency_reason === 'string' ? obj.urgency_reason : '',
    confidence,
    needs: pickAllowed(asStringArray(obj.needs), ALLOWED.needs),
    follow_up_questions: asStringArray(obj.follow_up_questions).slice(0, 5),
    guidance_keys: pickAllowed(asStringArray(obj.guidance_keys), ALLOWED.guidance),
    ...(typeof obj.animalDetected === 'boolean' ? { animalDetected: obj.animalDetected } : {}),
    ...(typeof obj.isRealPhoto === 'boolean' ? { isRealPhoto: obj.isRealPhoto } : {}),
    ...(typeof obj.speciesDetected === 'string' && ALLOWED.animalTypes.has(obj.speciesDetected)
      ? { speciesDetected: obj.speciesDetected }
      : {}),
  };

  geminiTriageSchema.parse(parsed);
  return parsed;
}

export function isValidAIRaw(raw: unknown): raw is AIRaw {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as AIRaw;
  if (!obj.summary || typeof obj.summary !== 'string') return false;
  const urgency = String(obj.urgency);
  return urgency === 'urgent' || urgency === 'needs_attention' || urgency === 'non_urgent' || urgency === 'stable';
}
