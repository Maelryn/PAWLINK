import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/auth.decorators';
import { AiService, type AnalyzeResult } from './ai.service';
import { AnalyzeDto } from './dto/analyze.dto';
import type { AnalyzeInput } from './ai.provider';

/**
 * `POST /ai/analyze` — the triage for a report, on demand.
 *
 * `POST /cases` calls the same service internally, so the two can never
 * disagree: the stored `ai` and the previewed `ai` are produced by one code
 * path. The route exists so the report flow can show a triage before the case
 * exists.
 */
@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('analyze')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Triage a report',
    description:
      'Returns an `AIAnalysis` (apps/web/lib/types.ts) plus `animalDetected` and `isRealPhoto`, ' +
      'which the trust checks read. The safety-rule layer runs **after** the model and can only ' +
      'raise the triage: a keyword or tag hit forces `urgent` and sets `forcedUrgentByRule: true`. ' +
      '`disclaimer` is always present and always points to a veterinarian — no diagnosis, ever. ' +
      'On a timeout (< 5 s), a model error or an invalid answer the response comes from one of ' +
      'three cached examples and is marked `model: "gemini-flash (fallback)"`.',
  })
  @ApiBody({ type: AnalyzeDto })
  @ApiCreatedResponse({ description: 'The triage, with real nearby suggestions.' })
  @ApiOkResponse({ description: 'The triage.' })
  analyze(@CurrentUser() user: { sub: string }, @Body() dto: AnalyzeDto): Promise<AnalyzeResult> {
    return this.ai.analyze({
      photoUrls: dto.photoUrls,
      description: dto.description,
      species: dto.species as AnalyzeInput['species'],
      conditionTags: dto.conditionTags ?? [],
      location: dto.location,
      count: dto.count,
      baseline: dto.baseline,
      lang: dto.lang === 'fr' || dto.lang === 'en' || dto.lang === 'ar' ? dto.lang : undefined,
    });
  }
}
