import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { SERVICE_TYPES } from '../../shared/enums';

/** Without `lat`/`lng` the list skips the geo filter and orders by rating. */
export const DEFAULT_RADIUS_KM = 50;

/**
 * `GET /services` — the directory query.
 *
 * With `lat`+`lng`: `ST_DWithin` on the geography column (GIST index), ordered
 * `pro DESC, distance ASC`. Without: ordered `pro DESC, rating DESC`.
 */
export class QueryServicesDto {
  @ApiPropertyOptional({ description: 'Latitude of the search point.', example: 36.632 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude of the search point.', example: 4.205 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ enum: SERVICE_TYPES })
  @IsOptional()
  @IsIn(SERVICE_TYPES)
  type?: (typeof SERVICE_TYPES)[number];

  @ApiPropertyOptional({ default: DEFAULT_RADIUS_KM, description: 'Only meaningful with lat+lng.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(500)
  radiusKm?: number;

  @ApiPropertyOptional({ description: 'Substring match on name, description or tags.' })
  @IsOptional()
  @Type(() => String)
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
