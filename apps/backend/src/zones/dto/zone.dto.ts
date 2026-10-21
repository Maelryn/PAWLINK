import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
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

@ApiSchema({
  description:
    'Creates an emergency zone — the polygon layer of the rescue map. Admin only. The centroid ' +
    'is recomputed from the polygon; the client never supplies it.',
})
export class CreateZoneDto {
  @ApiProperty({ maxLength: 120, description: 'The zone name, e.g. `Feux de forêt — Larbaâ`.' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ maxLength: 120, example: 'Tizi Ouzou', description: 'The affected region.' })
  @IsString()
  @MaxLength(120)
  region!: string;

  @ApiProperty({ enum: ZONE_TYPES, description: 'The kind of emergency.' })
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

  @ApiPropertyOptional({ default: true, description: 'Whether the zone is currently active.' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'ISO date the emergency started.' })
  @IsOptional()
  @IsString()
  startedAt?: string;
}

@ApiSchema({ description: 'Edits an emergency zone — admin only.' })
export class UpdateZoneDto {
  @ApiPropertyOptional({ maxLength: 120, description: 'The zone name.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ maxLength: 120, description: 'The affected region.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @ApiPropertyOptional({ enum: ZONE_TYPES, description: 'The kind of emergency.' })
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

  @ApiPropertyOptional({ description: 'Whether the zone is currently active.' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@ApiSchema({ description: 'The `GET /emergency-zones` filters.' })
export class QueryZonesDto {
  @ApiPropertyOptional({ description: 'Only active (or only inactive) zones. `?active=true|false`.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: 1, description: 'Page number, 1-based.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, maximum: 200, description: 'How many rows per page.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
