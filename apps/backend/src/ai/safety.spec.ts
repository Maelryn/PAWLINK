import { describe, it, expect } from '@jest/globals';
import {
  isUrgentByRule,
  isContagiousByRule,
  isMonitoringByRule,
  applySafetyRules,
} from './safety';
import type { AIInput, AIRaw } from './ai.provider';

describe('Safety Rules', () => {
  describe('isUrgentByRule', () => {
    it('should detect urgent keywords in English', () => {
      expect(isUrgentByRule('The dog is bleeding heavily', [])).toBe(true);
      expect(isUrgentByRule('Animal trapped in fire', [])).toBe(true);
      expect(isUrgentByRule('Not breathing', [])).toBe(true);
    });

    it('should detect urgent keywords in French', () => {
      expect(isUrgentByRule('Le chien saigne beaucoup', [])).toBe(true);
      expect(isUrgentByRule('Animal coincé dans le feu', [])).toBe(true);
      expect(isUrgentByRule('Ne respire pas', [])).toBe(true);
    });

    it('should detect urgent keywords in Arabic', () => {
      expect(isUrgentByRule('الكلب نزيف', [])).toBe(true);
      expect(isUrgentByRule('حيوان محاصر في الحريق', [])).toBe(true);
      expect(isUrgentByRule('لا يتنفس', [])).toBe(true);
    });

    it('should detect urgent tags', () => {
      expect(isUrgentByRule('', ['trapped'])).toBe(true);
      expect(isUrgentByRule('', ['bleeding'])).toBe(true);
      expect(isUrgentByRule('', ['breathing'])).toBe(true);
      expect(isUrgentByRule('', ['fire'])).toBe(true);
      expect(isUrgentByRule('', ['burned'])).toBe(true);
    });

    it('should not detect urgent in normal text', () => {
      expect(isUrgentByRule('The dog is healthy and happy', [])).toBe(false);
      expect(isUrgentByRule('Chat en bonne santé', [])).toBe(false);
    });

    it('should not treat fireworks stress as fire', () => {
      expect(isUrgentByRule('Dog stressed from fireworks, hiding and shaking but physically fine', ['stressed'])).toBe(
        false,
      );
    });

    it('should treat unspecified injury as urgent but not clearly minor scratches', () => {
      expect(isUrgentByRule('My dog is injured.', ['injured'])).toBe(true);
      expect(
        isUrgentByRule('Cat lost, looking scared, minor scratches from running through bushes.', ['lost', 'injured']),
      ).toBe(false);
    });
  });

  describe('isContagiousByRule', () => {
    it('should detect contagious keywords', () => {
      expect(isContagiousByRule('Dog has mange', [])).toBe(true);
      expect(isContagiousByRule('Cat is coughing', [])).toBe(true);
      expect(isContagiousByRule('Animal with diarrhea', [])).toBe(true);
    });

    it('should detect contagious tags', () => {
      expect(isContagiousByRule('', ['sneezing'])).toBe(true);
      expect(isContagiousByRule('', ['skin'])).toBe(true);
      expect(isContagiousByRule('', ['itching'])).toBe(true);
    });
  });

  describe('isMonitoringByRule', () => {
    it('should detect monitoring symptoms', () => {
      expect(isMonitoringByRule('Dog is limping', [])).toBe(true);
      expect(isMonitoringByRule('Cat looks thin', [])).toBe(true);
      expect(isMonitoringByRule('Animal is dehydrated', [])).toBe(true);
    });

    it('should include contagious as monitoring', () => {
      expect(isMonitoringByRule('Dog has mange', [])).toBe(true);
    });
  });

  describe('applySafetyRules', () => {
    it('should escalate to urgent when keyword matches', () => {
      const input: AIInput = {
        photoUrls: [],
        description: 'The dog is bleeding heavily',
        location: { lat: 0, lng: 0 },
        lang: 'en',
      };
      const result: AIRaw = {
        schema_version: '0.2',
        is_animal_report: true,
        detected_language: 'en',
        animal: { type: 'dog', category: 'companion' },
        situation_category: 'unclear',
        summary: 'Dog report',
        red_flags: [],
        hazards: [],
        urgency: 'non_urgent',
        urgency_reason: 'Initial assessment',
        confidence: 'high',
        needs: [],
        follow_up_questions: [],
        guidance_keys: [],
      };

      const updated = applySafetyRules(input, result);

      expect(updated.urgency).toBe('urgent');
      expect(updated.forcedUrgentByRule).toBe(true);
      expect(updated.forced_urgent_by_rule).toBe(true);
    });

    it('should not downgrade urgency', () => {
      const input: AIInput = {
        photoUrls: [],
        description: 'Healthy dog',
        location: { lat: 0, lng: 0 },
        lang: 'en',
      };
      const result: AIRaw = {
        schema_version: '0.2',
        is_animal_report: true,
        detected_language: 'en',
        animal: { type: 'dog', category: 'companion' },
        situation_category: 'unclear',
        summary: 'Dog report',
        red_flags: [],
        hazards: [],
        urgency: 'urgent',
        urgency_reason: 'Initial assessment',
        confidence: 'high',
        needs: [],
        follow_up_questions: [],
        guidance_keys: [],
      };

      const updated = applySafetyRules(input, result);

      expect(updated.urgency).toBe('urgent');
    });

    it('should add contagion hazard when contagious detected', () => {
      const input: AIInput = {
        photoUrls: [],
        description: 'Dog has mange',
        location: { lat: 0, lng: 0 },
        lang: 'en',
      };
      const result: AIRaw = {
        schema_version: '0.2',
        is_animal_report: true,
        detected_language: 'en',
        animal: { type: 'dog', category: 'companion' },
        situation_category: 'unclear',
        summary: 'Dog report',
        red_flags: [],
        hazards: [],
        urgency: 'needs_attention',
        urgency_reason: 'Initial assessment',
        confidence: 'high',
        needs: [],
        follow_up_questions: [],
        guidance_keys: [],
      };

      const updated = applySafetyRules(input, result);

      expect(updated.hazards).toContain('contagion_risk');
    });
  });
});
