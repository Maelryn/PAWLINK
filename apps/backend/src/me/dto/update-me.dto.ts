import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { HELP_TYPES } from '../../shared/enums';

/** `{ lat, lng }` — the wire shape in `GeoPoint` (apps/web/lib/types.ts). */
export class GeoPointDto {
  @ApiProperty({ example: 36.7538 })
  @IsNumber()
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 3.0588 })
  @IsNumber()
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({ example: 'Alger centre' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}

/**
 * `PATCH /me`. Everything optional, and only **profile** fields: `role`,
 * `email`, `phoneVerified` and `licenseVerified` are absent on purpose — those
 * change through admin routes and OTP flows, never through a profile update.
 */
export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Nour Benali' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.test/a.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @ApiPropertyOptional({ example: '+213 26 00 00 07' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'Oran' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'Bénévole le week-end.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://cdn.test/p.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photo?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({ enum: HELP_TYPES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(HELP_TYPES, { each: true })
  helpTypes?: string[];

  @ApiPropertyOptional({ type: GeoPointDto, description: 'Send an empty object to clear the location.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  location?: GeoPointDto;
}
