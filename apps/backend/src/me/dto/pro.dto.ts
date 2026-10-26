import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * `POST /me/pro` — the PawLink Pro subscription (demo payment).
 *
 * **No real money moves here.** The demo takes the plan and the period and
 * activates the subscription; the real payment (Chargily — CIB / Edahabia)
 * would be a webhook that calls the same service. The `demo` flag in the
 * response says so, so nobody mistakes the demo for a real sale.
 */
@ApiSchema({
  description:
    'Activates PawLink Pro on the caller\'s business listing. The payment is a demo: no money ' +
    'moves, and the response says `demo: true`.',
})
export class ActivateProDto {
  @ApiProperty({
    enum: ['pro', 'plus'],
    description: 'The tier: `pro` or the `pro+` tier. Upgrading keeps the days left.',
  })
  @IsIn(['pro', 'plus'])
  plan!: 'pro' | 'plus';

  @ApiProperty({
    enum: ['month', 'year'],
    description: 'How long the subscription runs: 30 days or 365 days.',
  })
  @IsIn(['month', 'year'])
  period!: 'month' | 'year';

  @ApiPropertyOptional({
    maxLength: 40,
    description: 'A promo code. `DEMODAY` makes the subscription free (demo only).',
    example: 'DEMODAY',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  promoCode?: string;
}

/** The promo code that makes the demo subscription free. */
export const DEMO_PROMO_CODE = 'DEMODAY';
