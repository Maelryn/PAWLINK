/**
 * Prototype script for single photo + report test.
 * Usage: npm run try-ai (or ts-node scripts/try-ai.ts)
 *
 * This script allows testing the AI service with a single case.
 * It reads from environment variables or uses default test data.
 */

import 'dotenv/config';
import { AIService } from '../src/ai/ai.service';
import type { AIInput } from '../src/ai/ai.provider';
import type { Species } from '../src/shared/types';

async function main() {
  console.log('=== PawLink AI Test Script ===\n');

  // Initialize AI service
  const aiService = new AIService();

  // Check health
  const health = await aiService.health();
  console.log('AI Service Health:', JSON.stringify(health, null, 2));
  console.log();

  // Create test input
  const input: AIInput = {
    photoUrls: process.env.TEST_PHOTO_URL ? [process.env.TEST_PHOTO_URL] : [],
    description:
      process.env.TEST_DESCRIPTION ||
      'My dog was hit by a car. He is awake but cannot stand and his back leg is swollen.',
    species: (process.env.TEST_SPECIES as Species) || 'dog',
    conditionTags: process.env.TEST_TAGS ? process.env.TEST_TAGS.split(',') : ['injured', 'bleeding'],
    location: {
      lat: parseFloat(process.env.TEST_LAT || '36.7538'),
      lng: parseFloat(process.env.TEST_LNG || '3.0588'),
    },
    count: parseInt(process.env.TEST_COUNT || '1'),
    lang: (process.env.TEST_LANG as 'fr' | 'en' | 'ar') || 'en',
  };

  console.log('Test Input:');
  console.log(JSON.stringify(input, null, 2));
  console.log();

  // Run analysis
  console.log('Running AI analysis...\n');
  const startTime = Date.now();
  try {
    const result = await aiService.analyze(input);
    const duration = Date.now() - startTime;

    console.log('=== AI Analysis Result ===');
    console.log(`Duration: ${duration}ms`);
    console.log(JSON.stringify(result, null, 2));
    console.log();

    // Validate key fields
    console.log('=== Validation ===');
    console.log(`Triage: ${result.triage}`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Language matched: ${input.lang === 'en' ? 'English' : input.lang === 'fr' ? 'French' : 'Arabic'}`);
    console.log(`Forced urgent by rule: ${result.forcedUrgentByRule}`);
    console.log(`Disclaimer present: ${result.disclaimer.length > 0}`);
    console.log();
  } catch (err) {
    console.error('Error during analysis:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
