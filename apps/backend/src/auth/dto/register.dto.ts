import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { HELP_TYPES, SIGNABLE_ROLES } from '../../shared/enums';

/**
 * `POST /auth/register` (docs/BACKEND_PROMPT.md §3.2).
 *
 * `role` is validated by the **service**, not here: a request for `admin` (or
 * any typo) must come back as `AUTH_ROLE_NOT_ALLOWED`, a stable machine code the
 * client can switch on — not as a generic `VALIDATION_ERROR`.
 */
export class RegisterDto {
  @ApiProperty({ example: 'Nour Benali', minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'nour@pawlink.dz', maxLength: 160 })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: 'pawlink2026', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: '+213 26 00 00 07', description: 'Also the SMS OTP destination.' })
  @IsString()
  @Matches(/^\+?[0-9\s().-]{8,20}$/, { message: 'Numéro de téléphone invalide.' })
  phone!: string;

  @ApiProperty({
    enum: SIGNABLE_ROLES,
    example: 'reporter',
    description: '`admin` is never allowed here — see AUTH_ROLE_NOT_ALLOWED.',
  })
  @IsString()
  @MaxLength(20)
  role!: string;

  @ApiPropertyOptional({ example: 'Tizi Ouzou', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({
    enum: HELP_TYPES,
    isArray: true,
    description: 'Volunteers only; ignored for other roles.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(HELP_TYPES.length)
  @IsIn(HELP_TYPES, { each: true })
  helpTypes?: string[];
}
