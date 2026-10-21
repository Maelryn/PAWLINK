import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ADOPTION_STATUSES } from '../../shared/enums';

/**
 * `GET /adoptions` — the marketplace query.
 *
 * `status` defaults to `approved` in the service: a visitor only ever sees
 * approved listings, a signed-in user additionally sees their own.
 */
@ApiSchema({ description: 'The `GET /adoptions` filters — the marketplace query.' })
export class QueryAdoptionsDto {
  @ApiPropertyOptional({
    enum: ADOPTION_STATUSES,
    default: 'approved',
    description: 'Non-admins only ever see `approved` listings plus their own.',
  })
  @IsOptional()
  @IsIn(ADOPTION_STATUSES)
  status?: (typeof ADOPTION_STATUSES)[number];

  @ApiPropertyOptional({ default: 1, description: 'Page number, 1-based.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100, description: 'How many rows per page.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
