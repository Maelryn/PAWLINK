import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AIService } from './ai.service';
import type { AIInput } from './ai.provider';
import type { AIAnalysis } from '../shared/types';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AIService) {}

  @Post('analyze')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analyze an animal report with the AI triage module' })
  @ApiResponse({ status: 201, description: 'AIAnalysis' })
  analyze(@Body() input: AIInput): Promise<AIAnalysis> {
    return this.ai.analyze(input);
  }
}
