import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CASE_STATUS, HELP_TYPES, HELPER_STAGES } from '../../shared/enums';

/** `PATCH /cases/:id/status` — the case lifecycle, volunteer/vet/admin only. */
@ApiSchema({
  description:
    'Moves a case along its lifecycle. A reporter gets `403 FORBIDDEN` — only a volunteer, a ' +
    'vet or an admin may change the status.',
})
export class PatchCaseStatusDto {
  @ApiProperty({ enum: CASE_STATUS, description: 'open → in_progress → resolved.' })
  @IsIn(CASE_STATUS)
  status!: (typeof CASE_STATUS)[number];
}

/** `POST /cases/:id/help` — "I can help with this". */
@ApiSchema({
  description:
    'Offers help on a case. The case moves `open → in_progress` and the reporter is notified.',
})
export class OfferHelpDto {
  @ApiProperty({ enum: HELP_TYPES, description: 'The kind of help being offered.' })
  @IsIn(HELP_TYPES)
  helpType!: (typeof HELP_TYPES)[number];

  @ApiPropertyOptional({ maxLength: 500, description: 'Optional note for the reporter.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

/** `PATCH /cases/:id/help` — the helper says where they are. */
@ApiSchema({
  description:
    'The helper moves along the rescue: `onway` (on the way), then `onsite` (with the animal). ' +
    'Only somebody who offered help on this case may do it.',
})
export class HelperStageDto {
  @ApiProperty({ enum: HELPER_STAGES, description: 'Where the helper is now.' })
  @IsIn(HELPER_STAGES)
  stage!: (typeof HELPER_STAGES)[number];
}

/** `POST /cases/:id/next-help` — the reporter (or a helper) asks for the next step. */
@ApiSchema({
  description:
    'Records the help still needed on a case (`Case.nextHelp`): the kinds of help, who asked and ' +
    'when. Reporter and helpers only.',
})
export class NextHelpDto {
  @ApiProperty({
    enum: HELP_TYPES,
    isArray: true,
    description: 'The kinds of help still needed — at least one.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(HELP_TYPES.length)
  @ArrayUnique()
  @IsIn(HELP_TYPES, { each: true })
  types!: (typeof HELP_TYPES)[number][];
}

/** `POST /cases/:id/flag` — "this does not look right". */
@ApiSchema({
  description:
    'Flags a case as wrong or abusive. Three flags from three distinct accounts send it back to ' +
    'moderation.',
})
export class FlagCaseDto {
  @ApiPropertyOptional({ maxLength: 500, description: 'Why the case is being flagged.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
