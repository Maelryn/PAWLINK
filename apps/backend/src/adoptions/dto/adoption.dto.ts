import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { HOUSING, SEXES, SPECIES } from '../../shared/enums';

/** Adoptions list photos are capped at 3 (docs/BACKEND_PROMPT.md §3.6). */
export const MAX_ADOPTION_PHOTOS = 3;

/**
 * Photo URL check, same rule as cases: an absolute http(s) URL, never a path.
 * Declared before the nested DTOs for the `emitDecoratorMetadata` reason
 * documented in `cases/dto/create-case.dto.ts`.
 */
export const PHOTO_URL_PATTERN = /^https?:\/\/\S+$/;

export class AdoptionLocationDto {
  @ApiProperty({ example: 36.632 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: 4.205 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}

/**
 * `POST /adoptions` (docs/BACKEND_PROMPT.md §3.3).
 *
 * The whitelist is the boundary: `status`, `ownerId`, `ownerPhone`, `id` are
 * **absent on purpose** — status is always `pending` until an admin decides,
 * the owner comes from the JWT, and the phone is read from the owner's own row.
 */
export class CreateAdoptionDto {
  @ApiProperty({ maxLength: 80, example: 'Rex' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: SPECIES })
  @IsIn(SPECIES)
  species!: (typeof SPECIES)[number];

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  breed?: string;

  @ApiProperty({ enum: SEXES })
  @IsIn(SEXES)
  sex!: (typeof SEXES)[number];

  @ApiProperty({ description: 'Age in months.', example: 14 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(480)
  ageMonths!: number;

  @ApiProperty({
    type: [String],
    description: 'Cloudinary URLs, already uploaded. Max 3 — one `probeIds` entry per photo.',
    example: ['https://res.cloudinary.com/demo/image/upload/v1/rex.jpg'],
  })
  @IsArray()
  @IsString({ each: true })
  @Matches(PHOTO_URL_PATTERN, { each: true, message: 'each value must be an http(s) URL' })
  // A loose outer bound: the real ≤ 3 rule is enforced in the service, which
  // answers 413 ADOPTION_TOO_MANY_PHOTOS instead of a generic validation error.
  @ArrayMaxSize(10)
  photos!: string[];

  @ApiProperty({
    type: [String],
    description: 'One `probeId` per photo, from `POST /uploads/probe` — same count as `photos`.',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  probeIds!: string[];

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  healthStatus!: string;

  @ApiPropertyOptional({
    type: [Object],
    description: '`{ name, date }` per vaccination.',
    example: [{ name: 'Rage', date: '2026-01-12' }],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  vaccinations?: Array<{ name: string; date: string }>;

  @ApiPropertyOptional({ type: [Object], description: '`{ date, note }` per history entry.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  medicalHistory?: Array<{ date: string; note: string }>;

  @ApiPropertyOptional({ type: [String], example: ['calm', 'children'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  behavior?: string[];

  @ApiPropertyOptional({ type: [String], example: ['garden', 'daily walk'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  careNeeds?: string[];

  @ApiProperty({ maxLength: 4000, description: 'The story, in the owner’s words.' })
  @IsString()
  @MaxLength(4000)
  story!: string;

  @ApiPropertyOptional({ description: 'A shelter Service listing id; omit for a personal listing.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  shelterId?: string;

  @ApiProperty({ type: AdoptionLocationDto })
  @ValidateNested()
  @Type(() => AdoptionLocationDto)
  location!: AdoptionLocationDto;
}

/**
 * `PATCH /adoptions/:id` — content fields only, owner only. `status`,
 * `ownerId` and `ownerPhone` are absent on purpose: the first is an admin
 * decision, the other two come from the token and the owner's row.
 */
export class UpdateAdoptionDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  breed?: string;

  @ApiPropertyOptional({ type: [String], maxLength: 10 })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(PHOTO_URL_PATTERN, { each: true, message: 'each value must be an http(s) URL' })
  @ArrayMaxSize(10)
  photos?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  probeIds?: string[];

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  healthStatus?: string;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  vaccinations?: Array<{ name: string; date: string }>;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  medicalHistory?: Array<{ date: string; note: string }>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  behavior?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  careNeeds?: string[];

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  story?: string;

  @ApiPropertyOptional({ type: AdoptionLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdoptionLocationDto)
  location?: AdoptionLocationDto;
}

/** `POST /adoptions/:id/requests` — a real form, not a comment. */
export class CreateRequestDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  message!: string;

  @ApiProperty({ enum: HOUSING })
  @IsIn(HOUSING)
  housing!: (typeof HOUSING)[number];

  @ApiProperty({ description: 'Has the requester kept an animal before?' })
  @IsBoolean()
  experience!: boolean;
}

/** `PATCH /requests/:id` — the listing owner's one decision. Terminal. */
export class DecideRequestDto {
  @ApiProperty({ enum: ['accepted', 'declined'] })
  @IsIn(['accepted', 'declined'])
  status!: 'accepted' | 'declined';
}

/** `PATCH /admin/adoptions/:id` — the moderation decision. */
export class ModerateAdoptionDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}
