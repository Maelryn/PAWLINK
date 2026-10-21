import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * `PATCH /admin/{cases|adoptions|services}/:id/edit` — the second review.
 *
 * One shape for the three kinds (a report, an adoption listing, a business
 * listing): the owner proposed a change on a live row, a moderator either
 * merges it (`approve`) or drops it (`reject`).
 */
@ApiSchema({
  description:
    'The moderator’s decision on a proposed change. `approve` merges the change into the ' +
    'public version; `reject` drops it and leaves the public version untouched.',
})
export class EditDecisionDto {
  @ApiProperty({ enum: ['approve', 'reject'], description: 'The decision.' })
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';
}
