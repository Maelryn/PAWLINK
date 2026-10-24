import type { AIAnalysis, GeoPoint, HelpType, Species, Triage } from '../shared/types';

/**
 * Input for AI analysis
 */
export interface AIInput {
  photoUrls: string[];
  description: string;
  species?: Species;
  conditionTags?: string[];
  location: { lat: number; lng: number };
  count?: number;
  baseline?: Triage;
  lang: 'fr' | 'en' | 'ar';
}

/**
 * Raw output from AI provider (before conversion to AIAnalysis)
 */
export interface AIRaw {
  schema_version: string;
  is_animal_report: boolean;
  detected_language: string;
  animal: {
    type: string;
    category: string;
  };
  situation_category: string;
  summary: string;
  red_flags: string[];
  hazards: string[];
  urgency: 'urgent' | 'needs_attention' | 'non_urgent' | 'stable';
  urgency_reason: string;
  confidence: 'high' | 'medium' | 'low';
  needs: string[];
  follow_up_questions: string[];
  guidance_keys: string[];
  animalDetected?: boolean;
  isRealPhoto?: boolean;
  speciesDetected?: string;
  forced_urgent_by_rule?: boolean;
  forcedUrgentByRule?: boolean;
  ai_status?: 'ok' | 'failed';
  needs_human_review?: boolean;
}

/**
 * Base interface for AI providers
 */
export interface AIProvider {
  analyze(input: AIInput): Promise<AIRaw>;
  health?(): Promise<{ status: string; provider: string; [key: string]: any }>;
}
