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
} from 'class-validator';
import { SERVICE_TYPES } from '../../shared/enums';

/** Same photo-URL rule as cases and adoptions. */
export const PHOTO_URL_PATTERN = /^https?:\/\/\S+$/;

/**
 * `POST /services` — the whitelist is the boundary: `rating`, `reviewCount`,
 * `verified`, `pro`, `status` and `ownerId` are absent on purpose. Every one of
 * those is server-owned: ratings come only from reviews, `verified` only from
 * an admin, `ownerId` from the JWT.
 */
@ApiSchema({
  description:
    'Lists a service — a vet, a shelter, a transporter. It is created as `pending` and stays off ' +
    'the public directory until an admin approves it.',
})
export class CreateServiceDto {
  @ApiProperty({ enum: SERVICE_TYPES, description: 'The kind of service.' })
  @IsIn(SERVICE_TYPES)
  type!: (typeof SERVICE_TYPES)[number];

  @ApiProperty({ maxLength: 120, description: 'The listing name.' })
  @IsString()
  @MaxLength(120)
  name!: string;

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

  @ApiPropertyOptional({
    maxLength: 40,
    example: '+213 555 00 00 00',
    description: 'The public phone number.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ description: 'Whether the listing currently answers the phone.' })
  @IsOptional()
  @IsBoolean()
  openNow?: boolean;

  @ApiPropertyOptional({ description: 'Cloudinary URL.' })
  @IsOptional()
  @IsString()
  @Matches(PHOTO_URL_PATTERN, { message: 'must be an http(s) URL' })
  @MaxLength(500)
  photo?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['urgence', 'chat'],
    description: 'Free-text tags used by the directory search.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];

  @ApiPropertyOptional({ maxLength: 2000, description: 'What the service offers, in its own words.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    example: 'Lun–Ven 8h–18h',
    description: 'Opening hours, as free text.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  hours?: string;
}

/**
 * `PATCH /services/:id` — owner only, content fields only. `status`,
 * `verified`, `pro` and `ownerId` are absent on purpose: they are moderation,
 * billing and identity, never a body field.
 */
@ApiSchema({
  description:
    'Edits the content of a listing, owner only. Every field is optional. `status`, `verified`, ' +
    '`pro` and `ownerId` are server-owned and are not editable here.',
})
export class UpdateServiceDto {
  @ApiPropertyOptional({ maxLength: 120, description: 'The listing name.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 36.632, description: 'Latitude, in decimal degrees.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 4.205, description: 'Longitude, in decimal degrees.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ maxLength: 200, description: 'A human-readable address.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ maxLength: 40, description: 'The public phone number.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ description: 'Whether the listing currently answers the phone.' })
  @IsOptional()
  @IsBoolean()
  openNow?: boolean;

  @ApiPropertyOptional({ description: 'Cloudinary URL.' })
  @IsOptional()
  @IsString()
  @Matches(PHOTO_URL_PATTERN, { message: 'must be an http(s) URL' })
  @MaxLength(500)
  photo?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Free-text tags used by the directory search.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];

  @ApiPropertyOptional({ maxLength: 2000, description: 'What the service offers, in its own words.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 500, description: 'Opening hours, as free text.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  hours?: string;
}

/** `POST /services/:id/reviews` — `rating` bounds are validated, never trusted. */
@ApiSchema({
  description:
    'A review. One per user per service — a second one answers `409 REVIEW_EXISTS`. The rating ' +
    'recomputes the listing’s average and review count.',
})
export class CreateReviewDto {
  @ApiProperty({
    enum: [1, 2, 3, 4, 5],
    example: 5,
    description: 'A whole number from 1 to 5.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: 1 | 2 | 3 | 4 | 5;

  @ApiProperty({ maxLength: 2000, description: 'The review text.' })
  @IsString()
  @MaxLength(2000)
  text!: string;
}

/** `PATCH /services/:id/reviews/:reviewId` — the business answers (Pro feature). */
@ApiSchema({ description: 'The owner’s public reply to a review.' })
export class ReplyReviewDto {
  @ApiProperty({ maxLength: 2000, description: 'The reply text, shown under the review.' })
  @IsString()
  @MaxLength(2000)
  reply!: string;
}

/** `POST /services/:id/bookings` — an appointment request, `sent` until the owner answers. */
@ApiSchema({
  description:
    'An appointment request. It stays `sent` until the service owner confirms or declines it.',
})
export class CreateBookingDto {
  @ApiProperty({
    maxLength: 40,
    example: '2026-10-20',
    description: 'The requested date, as free text (e.g. `2026-10-20`).',
  })
  @IsString()
  @MaxLength(40)
  date!: string;

  @ApiProperty({
    maxLength: 40,
    example: '14:30',
    description: 'The requested time, as free text (e.g. `14:30`).',
  })
  @IsString()
  @MaxLength(40)
  time!: string;

  @ApiProperty({
    maxLength: 120,
    example: 'Rex (chien, 3 ans)',
    description: 'Which animal the appointment is about.',
  })
  @IsString()
  @MaxLength(120)
  animal!: string;

  @ApiProperty({ maxLength: 1000, description: 'Why the appointment is needed.' })
  @IsString()
  @MaxLength(1000)
  reason!: string;
}

/** `PATCH /bookings/:id` — the service owner's terminal answer. */
@ApiSchema({ description: 'The owner’s answer. Terminal — a booking cannot be re-decided.' })
export class DecideBookingDto {
  @ApiProperty({ enum: ['confirmed', 'declined'], description: 'The decision.' })
  @IsIn(['confirmed', 'declined'])
  status!: 'confirmed' | 'declined';
}

/** `PATCH /admin/services/:id` — the moderation decision. */
@ApiSchema({ description: 'The moderator’s decision on a pending listing.' })
export class ModerateServiceDto {
  @ApiProperty({
    enum: ['approved', 'rejected'],
    description: '`approved` publishes the listing and marks it verified; `rejected` keeps it private.',
  })
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}
