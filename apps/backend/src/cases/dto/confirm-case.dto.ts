import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsLatitude, IsLongitude } from 'class-validator';

/**
 * `POST /cases/:id/confirm` — "do you see this animal?".
 *
 * The answer is a **vote**, not only a confirmation, and it is only worth
 * something from somebody standing next to the animal: the server checks the
 * distance (≤ 1 km) and refuses the answer otherwise. The web checks the same
 * radius on the device before sending, and the API checks it again — the client
 * is never the one that decides.
 */
@ApiSchema({
  description:
    'Answers "do you see this animal?" for a case. `seen: true` confirms the report, ' +
    '`seen: false` denies it. The caller must be within 1 km of the case and has ' +
    'one answer per report.',
})
export class ConfirmCaseDto {
  @ApiProperty({
    description: 'true = "I see the animal", false = "I don\'t see it".',
    example: true,
  })
  @IsBoolean()
  seen!: boolean;

  @ApiProperty({
    description: 'The latitude of the person answering — the server measures the distance from it.',
    example: 36.7538,
    minimum: -90,
    maximum: 90,
  })
  @IsLatitude()
  lat!: number;

  @ApiProperty({
    description: 'The longitude of the person answering — the server measures the distance from it.',
    example: 3.0588,
    minimum: -180,
    maximum: 180,
  })
  @IsLongitude()
  lng!: number;
}
