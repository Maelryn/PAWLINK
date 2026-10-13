import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ZONE_TYPES } from '../../shared/enums';

/**
 * Query strings arrive as text, and `Boolean("false")` is `true` — the classic
 * way a `?active=false` filter silently matches everything. This coerces the
 * two real spellings and rejects anything else.
 */
function toBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
}

export class CreateZoneDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ maxLength: 120, example: 'Tizi Ouzou' })
  @IsString()
  @MaxLength(120)
  region!: string;

  @ApiProperty({ enum: ZONE_TYPES })
  @IsIn(ZONE_TYPES)
  type!: (typeof ZONE_TYPES)[number];

  @ApiProperty({
    description:
      'A GeoJSON Polygon in [lng, lat] order — `{ type: "Polygon", coordinates: [[ [lng, lat], … ]] }`. ' +
      'Closed ring, inside Algeria; `center` is recomputed from it with `ST_Centroid`. ' +
      'Validated in depth by the service (a missing polygon is a 400, never a Postgres error).',
    example: {
      type: 'Polygon',
      coordinates: [[[3.9, 36.5], [4.4, 36.5], [4.4, 36.9], [3.9, 36.9], [3.9, 36.5]]],
    },
  })
  @IsOptional()
  polygon?: unknown;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'ISO date the emergency started.' })
  @IsOptional()
  @IsString()
  startedAt?: string;
}

export class UpdateZoneDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @ApiPropertyOptional({ enum: ZONE_TYPES })
  @IsOptional()
  @IsIn(ZONE_TYPES)
  type?: (typeof ZONE_TYPES)[number];

  @ApiPropertyOptional({
    description: 'GeoJSON Polygon in [lng, lat] order. A change recomputes `center`.',
    example: {
      type: 'Polygon',
      coordinates: [[[3.9, 36.5], [4.4, 36.5], [4.4, 36.9], [3.9, 36.9], [3.9, 36.5]]],
    },
  })
  @IsOptional()
  polygon?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class QueryZonesDto {
  @ApiPropertyOptional({ description: 'Only active (or only inactive) zones. `?active=true|false`.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
