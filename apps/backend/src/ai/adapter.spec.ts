import { describe, it, expect } from '@jest/globals';
import { toAIAnalysis } from './adapter';
import type { AIRaw } from './ai.provider';

describe('Adapter', () => {
  describe('toAIAnalysis', () => {
    it('should convert urgent to urgent triage', () => {
      const raw: AIRaw = {
        schema_version: '0.2',
        is_animal_report: true,
        detected_language: 'en',
        animal: { type: 'dog', category: 'companion' },
        situation_category: 'bleeding_wound',
        summary: 'Dog with bleeding wound',
        red_flags: ['heavy_bleeding'],
        hazards: [],
        urgency: 'urgent',
        urgency_reason: 'Heavy bleeding detected',
        confidence: 'high',
        needs: ['veterinarian'],
        follow_up_questions: [],
        guidance_keys: ['contact_vet_immediately'],
      };

      const analysis = toAIAnalysis(raw, 'gemini-2.5-flash', 'en');

      expect(analysis.triage).toBe('urgent');
      expect(analysis.confidence).toBe(0.9);
      expect(analysis.summary).toBe('Dog with bleeding wound');
      expect(analysis.observedSigns).toContain('bleeding wound');
      expect(analysis.observedSigns).toContain('heavy bleeding');
    });

    it('should convert needs_attention to monitoring triage', () => {
      const raw: AIRaw = {
        schema_version: '0.2',
        is_animal_report: true,
        detected_language: 'en',
        animal: { type: 'cat', category: 'companion' },
        situation_category: 'abandoned_weak',
        summary: 'Cat seems weak',
        red_flags: [],
        hazards: [],
        urgency: 'needs_attention',
        urgency_reason: 'Animal appears weak',
        confidence: 'medium',
        needs: ['rescue_volunteer'],
        follow_up_questions: [],
        guidance_keys: [],
      };

      const analysis = toAIAnalysis(raw, 'gemini-2.5-flash', 'en');

      expect(analysis.triage).toBe('monitoring');
      expect(analysis.confidence).toBe(0.6);
    });

    it('should convert non_urgent to stable triage', () => {
      const raw: AIRaw = {
        schema_version: '0.2',
        is_animal_report: true,
        detected_language: 'en',
        animal: { type: 'dog', category: 'companion' },
        situation_category: 'other',
        summary: 'Healthy stray dog',
        red_flags: [],
        hazards: [],
        urgency: 'non_urgent',
        urgency_reason: 'Animal appears healthy',
        confidence: 'high',
        needs: ['foster'],
        follow_up_questions: [],
        guidance_keys: [],
      };

      const analysis = toAIAnalysis(raw, 'gemini-2.5-flash', 'en');

      expect(analysis.triage).toBe('stable');
      expect(analysis.confidence).toBe(0.9);
    });

    it('should set language-specific disclaimer', () => {
      const raw: AIRaw = {
        schema_version: '0.2',
        is_animal_report: true,
        detected_language: 'fr',
        animal: { type: 'dog', category: 'companion' },
        situation_category: 'other',
        summary: 'Chien errant',
        red_flags: [],
        hazards: [],
        urgency: 'non_urgent',
        urgency_reason: 'Animal appears healthy',
        confidence: 'high',
        needs: [],
        follow_up_questions: [],
        guidance_keys: [],
      };

      const analysis = toAIAnalysis(raw, 'gemini-2.5-flash', 'fr');

      expect(analysis.disclaimer).toContain('IA');
      expect(analysis.disclaimer).toContain('vétérinaire');
    });

    it('should detect contagious from hazards', () => {
      const raw: AIRaw = {
        schema_version: '0.2',
        is_animal_report: true,
        detected_language: 'en',
        animal: { type: 'dog', category: 'companion' },
        situation_category: 'illness',
        summary: 'Dog with contagious condition',
        red_flags: [],
        hazards: ['contagion_risk'],
        urgency: 'needs_attention',
        urgency_reason: 'Possible contagion',
        confidence: 'medium',
        needs: ['veterinarian'],
        follow_up_questions: [],
        guidance_keys: [],
      };

      const analysis = toAIAnalysis(raw, 'gemini-2.5-flash', 'en');

      expect(analysis.possiblyContagious).toBe(true);
      expect(analysis.contagionAdvice).toBeDefined();
      expect(analysis.contagionAdvice?.length).toBeGreaterThan(0);
    });

    it('should include photo verification fields when present', () => {
      const raw: AIRaw = {
        schema_version: '0.2',
        is_animal_report: true,
        detected_language: 'en',
        animal: { type: 'dog', category: 'companion' },
        situation_category: 'other',
        summary: 'Dog photo',
        red_flags: [],
        hazards: [],
        urgency: 'non_urgent',
        urgency_reason: 'Photo analysis',
        confidence: 'high',
        needs: [],
        follow_up_questions: [],
        guidance_keys: [],
        animalDetected: true,
        isRealPhoto: true,
        speciesDetected: 'dog',
      };

      const analysis = toAIAnalysis(raw, 'gemini-2.5-flash', 'en');

      expect(analysis.animalDetected).toBe(true);
      expect(analysis.isRealPhoto).toBe(true);
      expect(analysis.speciesDetected).toBe('dog');
    });

    it('should map needs to help types correctly', () => {
      const raw: AIRaw = {
        schema_version: '0.2',
        is_animal_report: true,
        detected_language: 'en',
        animal: { type: 'dog', category: 'companion' },
        situation_category: 'bleeding_wound',
        summary: 'Injured dog',
        red_flags: ['heavy_bleeding'],
        hazards: [],
        urgency: 'urgent',
        urgency_reason: 'Injury',
        confidence: 'high',
        needs: ['veterinarian', 'transport', 'rescue_volunteer'],
        follow_up_questions: [],
        guidance_keys: [],
      };

      const analysis = toAIAnalysis(raw, 'gemini-2.5-flash', 'en');

      expect(analysis.recommendedHelp).toContain('medical');
      expect(analysis.recommendedHelp).toContain('transport');
      expect(analysis.recommendedHelp).toContain('search');
    });
  });
});
