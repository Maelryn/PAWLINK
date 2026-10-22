import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
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

@ApiSchema({ description: 'Where the animal is — the wire shape of `GeoPoint`.' })
export class AdoptionLocationDto {
  @ApiProperty({ example: 36.632, description: 'Latitude, in decimal degrees.' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: 4.205, description: 'Longitude, in decimal degrees.' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({ maxLength: 200, description: 'A human-readable address.' })
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
@ApiSchema({
  description:
    'Posts an adoption listing. It is created as `pending` and stays invisible on the public ' +
    'marketplace until an admin approves it.',
})
export class CreateAdoptionDto {
  @ApiProperty({ maxLength: 80, example: 'Rex', description: 'The animal’s name.' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: SPECIES, description: 'The species.' })
  @IsIn(SPECIES)
  species!: (typeof SPECIES)[number];

  @ApiPropertyOptional({ maxLength: 60, description: 'The breed, when known.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  breed?: string;

  @ApiProperty({ enum: SEXES, description: 'The animal’s sex.' })
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

  @ApiProperty({
    maxLength: 200,
    description: 'The health status in the owner’s words, e.g. `vaccinated, healthy`.',
  })
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

  @ApiPropertyOptional({
    type: [String],
    example: ['calm', 'children'],
    description: 'Behaviour tags, e.g. `good with kids`, `shy`.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  behavior?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['garden', 'daily walk'],
    description: 'What the animal needs day to day.',
  })
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
 * `PATCH /adoptions/:id` — owner only. Content fields, plus `status: "adopted"`
 * to close the listing: every other status is an admin decision. `ownerId` and
 * `ownerPhone` are absent on purpose — they come from the token and the owner's row.
 */
@ApiSchema({
  description:
    'Edits the content of a listing, owner only. Every field is optional; omit one to leave it ' +
    'untouched. `status` accepts only `adopted` (closing the listing) — moderation statuses are ' +
    'admin decisions.',
})
export class UpdateAdoptionDto {
  @ApiPropertyOptional({ maxLength: 80, description: 'The animal’s name.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ maxLength: 60, description: 'The breed, when known.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  breed?: string;

  @ApiPropertyOptional({
    type: [String],
    maxLength: 10,
    description: 'Cloudinary URLs, already uploaded. Max 3 — one `probeIds` entry per photo.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(PHOTO_URL_PATTERN, { each: true, message: 'each value must be an http(s) URL' })
  @ArrayMaxSize(10)
  photos?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'One `probeId` per photo, from `POST /uploads/probe` — same count as `photos`.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  probeIds?: string[];

  @ApiPropertyOptional({
    maxLength: 200,
    description: 'The health status in the owner’s words, e.g. `vaccinated, healthy`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  healthStatus?: string;

  @ApiPropertyOptional({
    type: [Object],
    description: '`{ name, date }` per vaccination — replaces the whole list.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  vaccinations?: Array<{ name: string; date: string }>;

  @ApiPropertyOptional({
    type: [Object],
    description: '`{ date, note }` per history entry — replaces the whole list.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  medicalHistory?: Array<{ date: string; note: string }>;

  @ApiPropertyOptional({
    type: [String],
    description: 'Behaviour tags, e.g. `good with kids`, `shy`.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  behavior?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'What the animal needs day to day.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  careNeeds?: string[];

  @ApiPropertyOptional({ maxLength: 4000, description: 'The story, in the owner’s words.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  story?: string;

  @ApiPropertyOptional({ type: AdoptionLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdoptionLocationDto)
  location?: AdoptionLocationDto;

  @ApiPropertyOptional({
    enum: ['adopted'],
    description:
      'The owner confirms the animal found its family. The listing leaves the public market; ' +
      'requests still waiting are declined.',
  })
  @IsOptional()
  @IsIn(['adopted'])
  status?: 'adopted';
}

/** `POST /adoptions/:id/requests` — a real form, not a comment. */
@ApiSchema({
  description:
    'An adoption request. One per user per listing — a second attempt answers `409 ' +
    'ADOPTION_REQUEST_EXISTS`.',
})
export class CreateRequestDto {
  @ApiProperty({ maxLength: 2000, description: 'A message to the owner, in the adopter’s words.' })
  @IsString()
  @MaxLength(2000)
  message!: string;

  @ApiProperty({ enum: HOUSING, description: 'The kind of home the adopter can offer.' })
  @IsIn(HOUSING)
  housing!: (typeof HOUSING)[number];

  @ApiProperty({ description: 'Has the requester kept an animal before?' })
  @IsBoolean()
  experience!: boolean;
}

/** `PATCH /requests/:id` — the listing owner's one decision. Terminal. */
@ApiSchema({
  description:
    'The owner’s answer. Terminal — a request already answered answers `409 ' +
    'REQUEST_ALREADY_ANSWERED`. Accepting reveals both phone numbers.',
})
export class DecideRequestDto {
  @ApiProperty({ enum: ['accepted', 'declined'], description: 'The decision.' })
  @IsIn(['accepted', 'declined'])
  status!: 'accepted' | 'declined';
}

/** `PATCH /adoptions/:id/status` — the owner closes the listing as adopted. */
@ApiSchema({
  description:
    'The owner confirms the animal found its family. The listing becomes `adopted` and leaves the ' +
    'public marketplace; requests still waiting are declined.',
})
export class MarkAdoptedDto {
  @ApiProperty({
    enum: ['adopted'],
    description: 'Only `adopted` is accepted — moderation statuses are admin-only.',
  })
  @IsIn(['adopted'])
  status!: 'adopted';
}

/** `PATCH /admin/adoptions/:id` — the moderation decision. */
@ApiSchema({ description: 'The moderator’s decision on a pending listing.' })
export class ModerateAdoptionDto {
  @ApiProperty({
    enum: ['approved', 'rejected'],
    description: '`approved` publishes the listing; `rejected` keeps it off the marketplace.',
  })
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}
