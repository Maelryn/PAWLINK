import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { AIAnalysis } from '../shared/types';
import type { AIInput, AIRaw, AIProvider } from './ai.provider';
import { toAIAnalysis } from './adapter';
import { applySafetyRules, isMonitoringByRule, isUrgentByRule } from './safety';
import { GeminiProvider } from './gemini.provider';
import { MockProvider } from './mock.provider';
import { isValidAIRaw } from './schema';

const ANALYZE_TIMEOUT_MS = 5000;

const FALLBACK_SUMMARIES: Record<'urgent' | 'monitoring' | 'stable', Record<'fr' | 'en' | 'ar', string>> = {
  urgent: {
    en: 'Urgent animal situation requiring immediate attention.',
    fr: "Situation animale urgente nécessitant une prise en charge immédiate.",
    ar: 'حالة حيوان عاجلة تتطلب اهتماماً فورياً.',
  },
  monitoring: {
    en: 'Animal situation requiring monitoring and follow-up.',
    fr: 'Situation animale nécessitant une surveillance et un suivi.',
    ar: 'حالة حيوان تتطلب المراقبة والمتابعة.',
  },
  stable: {
    en: 'Animal appears stable but may need assistance.',
    fr: "L'animal semble stable mais peut avoir besoin d'aide.",
    ar: 'الحيوان يبدو مستقراً ولكن قد يحتاج إلى مساعدة.',
  },
};

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private provider: AIProvider;
  private fallbacks: Record<string, AIRaw> = {};

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim() !== '') {
      this.provider = new GeminiProvider(apiKey);
      this.logger.log('AI Service initialized with Gemini provider');
    } else {
      this.provider = new MockProvider();
      this.logger.log('AI Service initialized with Mock provider (no GEMINI_API_KEY)');
    }

    this.loadFallbacks();
  }

  private fallbacksDir(): string {
    const candidates = [
      join(__dirname, 'fallbacks'),
      join(process.cwd(), 'src', 'ai', 'fallbacks'),
      join(process.cwd(), 'dist', 'ai', 'fallbacks'),
    ];
    return candidates.find((dir) => existsSync(join(dir, 'urgent.json'))) ?? candidates[0];
  }

  private loadFallbacks() {
    try {
      const fallbacksPath = this.fallbacksDir();
      this.fallbacks = {
        urgent: JSON.parse(readFileSync(join(fallbacksPath, 'urgent.json'), 'utf-8')),
        monitoring: JSON.parse(readFileSync(join(fallbacksPath, 'monitoring.json'), 'utf-8')),
        stable: JSON.parse(readFileSync(join(fallbacksPath, 'stable.json'), 'utf-8')),
      };
      this.logger.log('Fallback responses loaded successfully');
    } catch (err) {
      this.logger.error('Failed to load fallback responses', err);
      this.fallbacks = {} as Record<string, AIRaw>;
    }
  }

  /**
   * Provider → JSON validation → safety rules.
   * On error, invalid JSON, or timeout > 5.0s: cached fallback JSON.
   */
  async analyze(input: AIInput): Promise<AIAnalysis> {
    const started = Date.now();

    try {
      const result = await this.withTimeout(this.provider.analyze(input), ANALYZE_TIMEOUT_MS);

      if (!isValidAIRaw(result)) {
        throw new Error('Invalid JSON structure from AI provider');
      }

      const safe = applySafetyRules(input, result);
      const analysis = toAIAnalysis(safe, this.getModelUsed(), input.lang);

      this.logger.log(`AI analysis completed in ${Date.now() - started}ms`);
      return analysis;
    } catch (err) {
      this.logger.warn(
        `AI analysis failed after ${Date.now() - started}ms: ${(err as Error).message}. Using cached fallback.`,
      );

      const fallback = this.getFallback(input);
      return toAIAnalysis(fallback, 'fallback', input.lang);
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`AI timeout after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  private getFallback(input: AIInput): AIRaw {
    const text = input.description ?? '';
    const tags = input.conditionTags ?? [];
    const isUrgent = isUrgentByRule(text, tags);

    let fallbackKey: 'urgent' | 'monitoring' | 'stable' = 'stable';
    if (isUrgent) {
      fallbackKey = 'urgent';
    } else if (isMonitoringByRule(text, tags)) {
      fallbackKey = 'monitoring';
    }

    const cached = this.fallbacks[fallbackKey] || this.fallbacks.monitoring;
    const withLang: AIRaw = {
      ...cached,
      detected_language: input.lang,
      summary: FALLBACK_SUMMARIES[fallbackKey][input.lang] ?? cached.summary,
      animal: {
        type: input.species ?? cached.animal?.type ?? 'unknown',
        category: cached.animal?.category ?? 'unknown',
      },
    };

    return applySafetyRules(input, withLang);
  }

  private getModelUsed(): string {
    if (this.provider instanceof GeminiProvider) {
      return this.provider.lastModelUsed || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    }
    return 'pawlink-mock';
  }

  async health() {
    if (this.provider.health) {
      return this.provider.health();
    }
    return { status: 'ok', provider: 'unknown' };
  }
}
