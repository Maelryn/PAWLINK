import { readFileSync } from 'fs';
import { join } from 'path';
import type { AIInput, AIRaw, AIProvider } from './ai.provider';
import { isUrgentByRule, isContagiousByRule, isMonitoringByRule, applySafetyRules } from './safety';

// Load cached examples for mock responses
const cachedExamplesPath = join(__dirname, 'fallbacks');
const loadFallback = (name: string): AIRaw => {
  try {
    const path = join(cachedExamplesPath, `${name}.json`);
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    console.error(`[mock-provider] Failed to load fallback ${name}.json:`, err);
    // Return a safe default
    return {
      schema_version: '0.2',
      is_animal_report: true,
      detected_language: 'en',
      animal: { type: 'unknown', category: 'unknown' },
      situation_category: 'unclear',
      summary: 'AI analysis unavailable.',
      red_flags: [],
      hazards: [],
      urgency: 'needs_attention',
      urgency_reason: 'Mock fallback loaded.',
      confidence: 'low',
      needs: ['rescue_volunteer'],
      follow_up_questions: [],
      guidance_keys: [],
      ai_status: 'failed',
      needs_human_review: true,
    };
  }
};

/**
 * Mock AI Provider for PawLink.
 * Provides instant, deterministic triage for testing, CI/CD, and demo fallback.
 * Ported from apps/Ai/src/providers/mock.mjs
 */
export class MockProvider implements AIProvider {
  constructor() {
    // This provider doesn't need API keys
  }

  async analyze(input: AIInput): Promise<AIRaw> {
    const started = Date.now();
    const text = input.description ?? '';
    const tags = input.conditionTags ?? [];
    const species = input.species ?? 'dog';
    const hasPhoto = Boolean(input.photoUrls?.length);

    const isUrgent = isUrgentByRule(text, tags);
    const isContagious = isContagiousByRule(text, tags);
    const isMonitoring = isMonitoringByRule(text, tags);

    let templateKey = 'stable';
    if (isUrgent) {
      templateKey = 'urgent';
    } else if (isMonitoring) {
      templateKey = 'monitoring';
    }

    const template = loadFallback(templateKey);

    // Build internal result representation
    const result: AIRaw = {
      schema_version: '0.2',
      is_animal_report: true,
      detected_language: input.lang,
      animal: {
        type: species,
        category: ['sheep', 'goat', 'cow', 'horse'].includes(species) ? 'livestock' : 'companion',
      },
      situation_category: isUrgent ? 'trauma_accident' : isContagious ? 'illness' : 'abandoned_weak',
      summary: template.summary,
      red_flags: isUrgent ? ['major_trauma'] : [],
      hazards: isContagious ? ['contagion_risk'] : [],
      urgency: (template.urgency === 'stable' ? 'non_urgent' : template.urgency) as 'urgent' | 'needs_attention' | 'non_urgent',
      urgency_reason: `Mock rule evaluation: classified as ${templateKey}`,
      confidence: 'high',
      needs: template.needs,
      follow_up_questions: ['Is the animal in a safe location right now?'],
      guidance_keys: template.guidance_keys.length > 0 ? ['contact_vet_immediately', 'keep_calm_still'] : [],
      animalDetected: hasPhoto ? true : undefined,
      isRealPhoto: hasPhoto ? true : undefined,
      speciesDetected: hasPhoto ? species : undefined,
      ai_status: 'ok',
      needs_human_review: false,
    };

    const safeResult = applySafetyRules(input, result);

    console.log(`[mock-provider] Analysis completed in ${Date.now() - started}ms`);
    return safeResult;
  }

  async health() {
    return { status: 'ok', provider: 'mock', model: 'pawlink-mock', ready: true };
  }
}
