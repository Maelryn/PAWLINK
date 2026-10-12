import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { OTP_LENGTH } from '../otp.service';

export class LoginDto {
  @ApiProperty({ example: 'yasmine@pawlink.dz', maxLength: 160 })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: 'pawlink2026', minLength: 1, maxLength: 72 })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}

/**
 * `POST /auth/verify-phone`.
 *
 * `phone` is optional but recommended: `phone_otps` has no phone column, so a
 * code-only lookup scans the live codes instead of one account's. Sending the
 * phone narrows the search and removes that ambiguity.
 */
export class VerifyPhoneDto {
  @ApiProperty({ example: '482913', minLength: OTP_LENGTH, maxLength: OTP_LENGTH })
  @IsString()
  @Matches(new RegExp(`^\\d{${OTP_LENGTH}}$`), { message: 'Le code doit contenir 6 chiffres.' })
  code!: string;

  @ApiPropertyOptional({ example: '+213 26 00 00 07' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class ResendCodeDto {
  @ApiProperty({ example: '+213 26 00 00 07' })
  @IsString()
  @Matches(/^\+?[0-9\s().-]{8,20}$/, { message: 'Numéro de téléphone invalide.' })
  phone!: string;
}
