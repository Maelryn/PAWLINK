import { describe, it, expect } from '@jest/globals';
import { MockProvider } from './mock.provider';
import type { AIInput } from './ai.provider';

describe('MockProvider', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
  });

  describe('analyze', () => {
    it('should return urgent result for urgent keywords', async () => {
      const input: AIInput = {
        photoUrls: [],
        description: 'The dog is bleeding heavily',
        location: { lat: 0, lng: 0 },
        lang: 'en',
        species: 'dog',
        conditionTags: ['bleeding'],
      };

      const result = await provider.analyze(input);

      expect(result.urgency).toBe('urgent');
      expect(result.forcedUrgentByRule).toBe(true);
      expect(result.is_animal_report).toBe(true);
    });

    it('should return monitoring result for monitoring symptoms', async () => {
      const input: AIInput = {
        photoUrls: [],
        description: 'The dog looks thin and dehydrated',
        location: { lat: 0, lng: 0 },
        lang: 'en',
        species: 'dog',
        conditionTags: ['thin', 'dehydrated'],
      };

      const result = await provider.analyze(input);

      expect(result.urgency).toBe('needs_attention');
      expect(result.forcedUrgentByRule).toBe(false);
    });

    it('should return stable result for healthy animal', async () => {
      const input: AIInput = {
        photoUrls: [],
        description: 'Healthy looking stray dog',
        location: { lat: 0, lng: 0 },
        lang: 'en',
        species: 'dog',
        conditionTags: [],
      };

      const result = await provider.analyze(input);

      expect(result.urgency).toBe('non_urgent');
    });

    it('should handle French language', async () => {
      const input: AIInput = {
        photoUrls: [],
        description: 'Le chien saigne beaucoup',
        location: { lat: 0, lng: 0 },
        lang: 'fr',
        species: 'dog',
        conditionTags: ['bleeding'],
      };

      const result = await provider.analyze(input);

      expect(result.urgency).toBe('urgent');
      expect(result.detected_language).toBe('fr');
    });

    it('should handle Arabic language', async () => {
      const input: AIInput = {
        photoUrls: [],
        description: 'الكلب نزيف',
        location: { lat: 0, lng: 0 },
        lang: 'ar',
        species: 'dog',
        conditionTags: ['bleeding'],
      };

      const result = await provider.analyze(input);

      expect(result.urgency).toBe('urgent');
      expect(result.detected_language).toBe('ar');
    });

    it('should set animalDetected and isRealPhoto when photo provided', async () => {
      const input: AIInput = {
        photoUrls: ['https://example.com/photo.jpg'],
        description: 'Dog photo',
        location: { lat: 0, lng: 0 },
        lang: 'en',
        species: 'dog',
      };

      const result = await provider.analyze(input);

      expect(result.animalDetected).toBe(true);
      expect(result.isRealPhoto).toBe(true);
      expect(result.speciesDetected).toBe('dog');
    });

    it('should not have photo fields when no photo provided', async () => {
      const input: AIInput = {
        photoUrls: [],
        description: 'Dog without photo',
        location: { lat: 0, lng: 0 },
        lang: 'en',
        species: 'dog',
      };

      const result = await provider.analyze(input);

      expect(result.animalDetected).toBeUndefined();
      expect(result.isRealPhoto).toBeUndefined();
    });
  });

  describe('health', () => {
    it('should return ok status', async () => {
      const health = await provider.health();

      expect(health.status).toBe('ok');
      expect(health.provider).toBe('mock');
      expect(health.model).toBe('pawlink-mock');
      expect(health.ready).toBe(true);
    });
  });
});
