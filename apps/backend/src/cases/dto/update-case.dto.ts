import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * `PATCH /cases/:id` — the reporter corrects their own report.
 *
 * Only the text changes: the position, the photos and the animal are part of
 * the report's identity, and a report that moves after the fact would break the
 * trust checks that were run on it.
 */
@ApiSchema({
  description:
    'The reporter edits the description or the condition tags of their report. On a public ' +
    'report the change waits for a moderator (`pendingEdit`); on a report still held for ' +
    'moderation it applies straight away.',
})
export class UpdateCaseDto {
  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'The new description of the report.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    maxLength: 20,
    description: 'The new condition tags (what the animal looks like: "bleeding", "limping"…).',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  conditionTags?: string[];
}
