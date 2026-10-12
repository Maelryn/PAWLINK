import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CASE_STATUS, HELP_TYPES } from '../../shared/enums';

/** `PATCH /cases/:id/status` — the case lifecycle, volunteer/vet/admin only. */
export class PatchCaseStatusDto {
  @ApiProperty({ enum: CASE_STATUS, description: 'open → in_progress → resolved.' })
  @IsIn(CASE_STATUS)
  status!: (typeof CASE_STATUS)[number];
}

/** `POST /cases/:id/help` — "I can help with this". */
export class OfferHelpDto {
  @ApiProperty({ enum: HELP_TYPES })
  @IsIn(HELP_TYPES)
  helpType!: (typeof HELP_TYPES)[number];

  @ApiPropertyOptional({ maxLength: 500, description: 'Optional note for the reporter.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

/** `POST /cases/:id/flag` — "this does not look right". */
export class FlagCaseDto {
  @ApiPropertyOptional({ maxLength: 500 })
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
export class ConfirmCaseDto {}
