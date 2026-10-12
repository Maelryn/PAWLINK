import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { CASE_CATEGORY, CASE_STATUS, SPECIES, TRIAGE } from '../../shared/enums';
/**
 * `GET /cases` — the map's query (docs/BACKEND_PROMPT.md §3.3).
 *
 * The bbox is the only spatial filter and it is one raw PostGIS statement; the
 * rest are plain columns added to the same `WHERE`. Every invalid combination
 * becomes one `VALIDATION_ERROR`, so a client bug is never a Postgres error.
 */
export class QueryCasesDto {
  @ApiPropertyOptional({
    description: '`minLng,minLat,maxLng,maxLat`. Required by the map; omit to list without a box.',
    example: '3.9,36.5,4.4,36.9',
  })
  @IsOptional()
  @IsString()
  bbox?: string;

  @ApiPropertyOptional({ enum: TRIAGE })
  @IsOptional()
  @IsIn(TRIAGE)
  triage?: (typeof TRIAGE)[number];

  @ApiPropertyOptional({ enum: SPECIES })
  @IsOptional()
  @IsIn(SPECIES)
  species?: (typeof SPECIES)[number];

  @ApiPropertyOptional({ enum: CASE_CATEGORY })
  @IsOptional()
  @IsIn(CASE_CATEGORY)
  category?: (typeof CASE_CATEGORY)[number];

  @ApiPropertyOptional({ enum: CASE_STATUS })
  @IsOptional()
  @IsIn(CASE_STATUS)
  status?: (typeof CASE_STATUS)[number];

  @ApiPropertyOptional({ description: 'Only cases inside this emergency zone.' })
  @IsOptional()
  @IsString()
  zoneId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 200, maximum: 500, description: 'The bbox query is capped at 500.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;
}

/** `GET /cases/nearby?lat=&lng=&radiusKm=` — the dashboards' radius query. */
export class NearbyCasesDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({ default: 25, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(200)
  radiusKm?: number;

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

/** The validated, normalised query the service actually receives. */
export interface CaseListQuery {
  bbox?: import('../bbox').Bbox | null;
  triage?: string;
  species?: string;
  category?: string;
  status?: string;
  zoneId?: string;
  /** Both default inside the service, so a caller may omit either. */
  page?: number;
  pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 200;
export const MAX_PAGE_SIZE = 500;
export const DEFAULT_NEARBY_RADIUS_KM = 25;
export const DEFAULT_NEARBY_PAGE_SIZE = 50;
