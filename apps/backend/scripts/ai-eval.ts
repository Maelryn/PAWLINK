/**
 * AI Evaluation Script
 * Runs the 35 test cases from test/ai-cases/cases.json and measures performance.
 * Usage: npm run ai:eval
 */

import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { AIService } from '../src/ai/ai.service';
import type { AIInput } from '../src/ai/ai.provider';

config();
const aiEnvPath = join(process.cwd(), '..', 'Ai', '.env');
if (existsSync(aiEnvPath)) {
  config({ path: aiEnvPath, override: false });
}

interface TestCase {
  id: string;
  expectedTriage: 'urgent' | 'monitoring' | 'stable';
  description: string;
  species: string;
  conditionTags: string[];
  lang: 'fr' | 'en' | 'ar';
  location: { lat: number; lng: number };
}

interface TestSuite {
  cases: TestCase[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== PawLink AI Evaluation ===\n');

  const casesPath = join(process.cwd(), 'test', 'ai-cases', 'cases.json');
  const testSuite: TestSuite = JSON.parse(readFileSync(casesPath, 'utf-8'));
  const cases = testSuite.cases;

  console.log(`Loaded ${cases.length} test cases\n`);

  const aiService = new AIService();
  const health = await aiService.health();
  console.log('AI Service Health:', JSON.stringify(health, null, 2));
  console.log();

  const results = {
    total: cases.length,
    correct: 0,
    urgentCases: 0,
    urgentCaught: 0,
    latencies: [] as number[],
    errors: [] as string[],
    mismatches: [] as string[],
  };

  console.log('Running test cases...\n');

  const minIntervalMs = health.provider === 'mock' ? 0 : 1000;

  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    const input: AIInput = {
      photoUrls: [],
      description: testCase.description,
      species: testCase.species as AIInput['species'],
      conditionTags: testCase.conditionTags,
      location: testCase.location,
      lang: testCase.lang,
    };

    const startTime = Date.now();
    try {
      const result = await aiService.analyze(input);
      const latency = Date.now() - startTime;
      results.latencies.push(latency);

      const expectedTriage = testCase.expectedTriage;
      const actualTriage = result.triage;
      const isCorrect = expectedTriage === actualTriage;

      if (isCorrect) {
        results.correct++;
      } else {
        results.mismatches.push(
          `${testCase.id}: expected ${expectedTriage}, got ${actualTriage} (forcedUrgentByRule=${result.forcedUrgentByRule}, model=${result.model})`,
        );
      }

      if (expectedTriage === 'urgent') {
        results.urgentCases++;
        if (actualTriage === 'urgent') {
          results.urgentCaught++;
        }
      }

      console.log(
        `[${testCase.id}] ${testCase.lang.toUpperCase()} - Expected: ${expectedTriage}, Actual: ${actualTriage} - ${isCorrect ? 'OK' : 'MISS'} (${latency}ms)`,
      );
    } catch (err) {
      const latency = Date.now() - startTime;
      results.latencies.push(latency);
      results.errors.push(`${testCase.id}: ${(err as Error).message}`);
      console.log(`[${testCase.id}] ERROR: ${(err as Error).message} (${latency}ms)`);
    }

    const elapsed = Date.now() - startTime;
    if (i < cases.length - 1 && elapsed < minIntervalMs) {
      await sleep(minIntervalMs - elapsed);
    }
  }

  const accuracy = (results.correct / results.total) * 100;
  const urgentAccuracy =
    results.urgentCases > 0 ? (results.urgentCaught / results.urgentCases) * 100 : 100;
  const avgLatency = results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length;
  const maxLatency = Math.max(...results.latencies);
  const minLatency = Math.min(...results.latencies);

  console.log('\n=== Evaluation Results ===');
  console.log(`Total cases: ${results.total}`);
  console.log(`Correct triage: ${results.correct}/${results.total} (${accuracy.toFixed(1)}%)`);
  console.log(
    `Urgent cases caught: ${results.urgentCaught}/${results.urgentCases} (${urgentAccuracy.toFixed(1)}%)`,
  );
  console.log(`Average latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`Min latency: ${minLatency}ms`);
  console.log(`Max latency: ${maxLatency}ms`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.mismatches.length > 0) {
    console.log('\nMismatches:');
    results.mismatches.forEach((row) => console.log(`  - ${row}`));
  }

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach((err) => console.log(`  - ${err}`));
  }

  if (urgentAccuracy < 100) {
    console.log('\nWARNING: Not all urgent cases were caught!');
    process.exit(1);
  }

  console.log('\nAll urgent cases were caught successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
