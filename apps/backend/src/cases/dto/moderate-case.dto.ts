import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** `PATCH /admin/cases/:id/moderation` — the two decisions a moderator can make. */
@ApiSchema({
  description:
    'The moderator’s decision on a held case. `approved` puts it back on the public map; ' +
    '`hidden` keeps it off.',
})
export class ModerateCaseDto {
  @ApiProperty({ enum: ['approved', 'hidden'], description: 'The decision.' })
  @IsIn(['approved', 'hidden'])
  decision!: 'approved' | 'hidden';
}
