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
export class CreateServiceDto {
  @ApiProperty({ enum: SERVICE_TYPES })
  @IsIn(SERVICE_TYPES)
  type!: (typeof SERVICE_TYPES)[number];

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

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

  @ApiPropertyOptional({ maxLength: 40, example: '+213 555 00 00 00' })
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

  @ApiPropertyOptional({ type: [String], example: ['urgence', 'chat'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'Lun–Ven 8h–18h' })
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
export class UpdateServiceDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 36.632 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 4.205 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  openNow?: boolean;

  @ApiPropertyOptional({ description: 'Cloudinary URL.' })
  @IsOptional()
  @IsString()
  @Matches(PHOTO_URL_PATTERN, { message: 'must be an http(s) URL' })
  @MaxLength(500)
  photo?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  hours?: string;
}

/** `POST /services/:id/reviews` — `rating` bounds are validated, never trusted. */
export class CreateReviewDto {
  @ApiProperty({ enum: [1, 2, 3, 4, 5], example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: 1 | 2 | 3 | 4 | 5;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  text!: string;
}

/** `PATCH /services/:id/reviews/:reviewId` — the business answers (Pro feature). */
export class ReplyReviewDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  reply!: string;
}

/** `POST /services/:id/bookings` — an appointment request, `sent` until the owner answers. */
export class CreateBookingDto {
  @ApiProperty({ maxLength: 40, example: '2026-10-20' })
  @IsString()
  @MaxLength(40)
  date!: string;

  @ApiProperty({ maxLength: 40, example: '14:30' })
  @IsString()
  @MaxLength(40)
  time!: string;

  @ApiProperty({ maxLength: 120, example: 'Rex (chien, 3 ans)' })
  @IsString()
  @MaxLength(120)
  animal!: string;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  reason!: string;
}

/** `PATCH /bookings/:id` — the service owner's terminal answer. */
export class DecideBookingDto {
  @ApiProperty({ enum: ['confirmed', 'declined'] })
  @IsIn(['confirmed', 'declined'])
  status!: 'confirmed' | 'declined';
}

/** `PATCH /admin/services/:id` — the moderation decision. */
export class ModerateServiceDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}
