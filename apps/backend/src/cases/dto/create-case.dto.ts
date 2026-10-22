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
import { CASE_CATEGORY, SPECIES, TRIAGE } from '../../shared/enums';

/** One photo probe per photo — the EXIF and the hash are read from the original. */
export const MAX_PHOTOS = 6;

/**
 * A photo reference is an absolute URL — the only thing the API ever receives.
 *
 * Declared at the top of the file on purpose: `emitDecoratorMetadata` turns a
 * property's declared type into `Reflect.metadata('design:type', …)`, which is
 * evaluated when the class is *defined*. A nested DTO declared later in the file
 * is therefore still in its temporal dead zone, and the module throws a
 * `ReferenceError` the first time a controller imports it. The compiler cannot
 * see this, so the rule here is simply: nested DTOs come first.
 */
export const PHOTO_URL_PATTERN = /^https?:\/\/\S+$/;

export function isPhotoUrl(value: string): boolean {
  return PHOTO_URL_PATTERN.test(value);
}

@ApiSchema({ description: 'Where the animal is — the wire shape of `GeoPoint`.' })
export class CreateCaseLocationDto {
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
 * The reporter's answers to the triage's quick questions. Every answer is
 * optional: the questions are asked only when something important is missing.
 */
@ApiSchema({
  description:
    'The reporter’s answers to the triage’s quick questions. Only the answered questions are ' +
    'stored, so the triage can stop asking them.',
})
export class TriageAnswersDto {
  @ApiPropertyOptional({ description: 'Is the animal conscious?' })
  @IsOptional()
  @IsBoolean()
  conscious?: boolean;

  @ApiPropertyOptional({ description: 'Is it bleeding?' })
  @IsOptional()
  @IsBoolean()
  bleeding?: boolean;

  @ApiPropertyOptional({ description: 'Can it walk?' })
  @IsOptional()
  @IsBoolean()
  walk?: boolean;

  @ApiPropertyOptional({ description: 'Is it eating?' })
  @IsOptional()
  @IsBoolean()
  eating?: boolean;
}

/**
 * The `POST /cases` body (docs/BACKEND_PROMPT.md §3.3, PHASE2_PLAN §5).
 *
 * The whitelist is the security boundary: `trust`, `moderation`, `ai`,
 * `reporter`, `id`, `createdAt` and `updatedAt` are **absent** on purpose, so the
 * global `ValidationPipe({ whitelist: true })` strips them rather than trusting
 * them. Every one of those is recomputed server-side by the trust pipeline.
 *
 * `triage` is a *baseline* — the caller's own urgency guess. The safety-rule
 * layer may raise it; nothing may lower it.
 */
@ApiSchema({
  description:
    'Reports an animal needing help. The response carries the server-computed `trust` object — ' +
    'the client never sends it — and the case may be held for moderation.',
})
export class CreateCaseDto {
  @ApiProperty({ maxLength: 120, description: 'A short headline for the report.' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ enum: SPECIES, description: 'The species.' })
  @IsIn(SPECIES)
  species!: (typeof SPECIES)[number];

  @ApiProperty({
    enum: CASE_CATEGORY,
    description: '`companion` for a pet, `livestock` for a herd.',
  })
  @IsIn(CASE_CATEGORY)
  category!: (typeof CASE_CATEGORY)[number];

  @ApiPropertyOptional({ description: 'Herd size, for livestock cases.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  count?: number;

  @ApiPropertyOptional({
    enum: TRIAGE,
    description: 'A baseline only. The safety rules may raise it, never lower it.',
  })
  @IsOptional()
  @IsIn(TRIAGE)
  triage?: (typeof TRIAGE)[number];

  @ApiProperty({ description: 'Where the animal is.', type: CreateCaseLocationDto })
  @ValidateNested()
  @Type(() => CreateCaseLocationDto)
  location!: CreateCaseLocationDto;

  @ApiPropertyOptional({
    type: [String],
    description: 'Cloudinary URLs, already uploaded. One `probeIds` entry per photo.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(PHOTO_URL_PATTERN, { each: true, message: 'each value must be an http(s) URL' })
  @ArrayMaxSize(MAX_PHOTOS)
  photos?: string[];

  @ApiProperty({ maxLength: 2000, description: 'What the reporter saw, in their own words.' })
  @IsString()
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional({ type: [String], description: 'e.g. `["bleeding","trapped"]`.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  conditionTags?: string[];

  @ApiPropertyOptional({
    type: TriageAnswersDto,
    description: 'The reporter’s answers to the triage’s quick questions — stored on the case.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TriageAnswersDto)
  answers?: TriageAnswersDto;

  @ApiPropertyOptional({
    description: "The device's own GPS, when the reporter is standing next to the animal.",
    type: CreateCaseLocationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCaseLocationDto)
  device?: CreateCaseLocationDto;

  @ApiPropertyOptional({ description: 'The emergency zone this report falls in, if any.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  emergencyZoneId?: string;

  @ApiPropertyOptional({ description: 'The reporter says they can stay near the animal.' })
  @IsOptional()
  reporterOnSite?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description:
      'One `probeId` per photo, from `POST /uploads/probe`. This is what makes the EXIF and ' +
      'duplicate checks server-side: without a probe there is no GPS and no freshness.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(MAX_PHOTOS)
  probeIds?: string[];
}
