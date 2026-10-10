import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiProvider } from './gemini.provider';
import { MockProvider } from './mock.provider';

/**
 * The AI triage. `AiService` is exported so `POST /cases` can reuse the exact
 * same pipeline instead of reimplementing the rules — the stored `Case.ai` and
 * the previewed one have to be the same answer.
 *
 * Providers are plain classes rather than injectable tokens: there are two of
 * them, the choice is one environment variable read at boot, and a DI indirection
 * here would only hide which one is live.
 */
@Module({
  controllers: [AiController],
  providers: [AiService, MockProvider, GeminiProvider],
  exports: [AiService],
})
export class AiModule {}
