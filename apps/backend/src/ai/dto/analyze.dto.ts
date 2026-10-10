import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { isLang } from '../templates';

/**
 * The `POST /ai/analyze` body (docs/BACKEND_PROMPT.md §3.4).
 *
 * Everything here is a *claim*: the description, the tags and the language are
 * what the caller says, and the triage they produce is checked against the
 * safety rules afterwards. `baseline` is the only triage the server reads, and
 * the rules may still raise it.
 */

export class PointDto {
  @ApiProperty({ example: 36.632 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: 4.205 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class AnalyzeDto {
  @ApiPropertyOptional({
    description: 'Photo URLs. Only their presence matters: it is what makes `animalDetected` non-null.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @ApiProperty({ description: 'What the reporter saw, in their own words.' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({
    enum: ['dog', 'cat', 'bird', 'horse', 'cow', 'sheep', 'goat', 'camel', 'donkey', 'rabbit', 'chicken', 'other'],
  })
  @IsOptional()
  @IsString()
  species?: string;

  @ApiPropertyOptional({ type: [String], description: 'Condition tags, e.g. `["bleeding","trapped"]`.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  conditionTags?: string[];

  @ApiPropertyOptional({
    description: 'Where the animal is — the suggestions are measured from here.',
    type: PointDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PointDto)
  location!: PointDto;

  @ApiPropertyOptional({ description: 'How many animals, for herd reports.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  count?: number;

  @ApiPropertyOptional({
    enum: ['urgent', 'monitoring', 'stable'],
    description: 'The triage already stored. Rules can only raise it.',
  })
  @IsOptional()
  @IsIn(['urgent', 'monitoring', 'stable'])
  baseline?: 'urgent' | 'monitoring' | 'stable';

  @ApiPropertyOptional({ enum: ['fr', 'en', 'ar'], default: 'fr' })
  @IsOptional()
  @IsString()
  lang?: string;
}

/** Narrows the request language to the templates' three, defaulting to French. */
export function requestedLang(value: string | undefined): 'fr' | 'en' | 'ar' | undefined {
  return isLang(value) ? value : undefined;
}
