import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CASE_STATUS, HELP_TYPES } from '../../shared/enums';

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

/**
 * `POST /cases/:id/confirm` — "I see it too".
 *
 * Deliberately empty: the confirmation is the authenticated caller's existence,
 * so there is nothing to send and nothing to validate.
 */
@ApiSchema({
  description:
    'Confirms the case is real. The body is empty — the confirmation is the authenticated ' +
    'caller’s existence. One confirmation per account.',
})
export class ConfirmCaseDto {}
