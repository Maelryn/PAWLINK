import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
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
@ApiSchema({ description: 'A point on the map — the wire shape of `GeoPoint`.' })
export class GeoPointDto {
  @ApiProperty({ example: 36.7538, description: 'Latitude, in decimal degrees.' })
  @IsNumber()
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 3.0588, description: 'Longitude, in decimal degrees.' })
  @IsNumber()
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({ example: 'Alger centre', description: 'A human-readable address.' })
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
@ApiSchema({
  description:
    'Partial profile update. Every field is optional — omit one to leave it untouched. ' +
    '`role`, `email`, `phoneVerified` and `licenseVerified` are not editable here.',
})
export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Nour Benali', description: 'The display name.' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.test/a.jpg',
    description: 'An absolute http(s) URL for the profile picture.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @ApiPropertyOptional({
    example: '+213 26 00 00 07',
    description: 'A new phone. It clears `phoneVerified` until the new number is confirmed.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'Oran', description: 'The city.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'Bénévole le week-end.', description: 'A free-text bio.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.test/p.jpg',
    description: 'An absolute http(s) URL for the cover photo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photo?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether a volunteer is available to help.' })
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({
    enum: HELP_TYPES,
    isArray: true,
    description: 'The kinds of help this volunteer offers.',
  })
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
