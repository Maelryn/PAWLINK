import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** `PATCH /admin/cases/:id/moderation` — the two decisions a moderator can make. */
export class ModerateCaseDto {
  @ApiProperty({ enum: ['approved', 'hidden'] })
  @IsIn(['approved', 'hidden'])
  decision!: 'approved' | 'hidden';
}
