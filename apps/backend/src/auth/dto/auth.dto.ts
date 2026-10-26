import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { OTP_LENGTH } from '../otp.service';
import { PHONE_ERROR_MESSAGE, PHONE_MAX_LENGTH, PHONE_PATTERN } from '../../shared/phone';

@ApiSchema({ description: 'Credentials for `POST /auth/login`.' })
export class LoginDto {
  @ApiProperty({
    example: 'yasmine@pawlink.dz',
    maxLength: 160,
    description: 'The account email. A bad email and a bad password return the same error.',
  })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({
    example: 'pawlink2026',
    minLength: 1,
    maxLength: 72,
    description: 'The account password, in plaintext — it is sent over TLS and hashed with argon2.',
  })
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
@ApiSchema({
  description:
    'The SMS code sent at registration. On success the API returns the first access token ' +
    'and sets the refresh cookie.',
})
export class VerifyPhoneDto {
  @ApiProperty({
    example: '482913',
    minLength: OTP_LENGTH,
    maxLength: OTP_LENGTH,
    description: `The ${OTP_LENGTH}-digit code, valid for 5 minutes with 5 attempts.`,
  })
  @IsString()
  @Matches(new RegExp(`^\\d{${OTP_LENGTH}}$`), { message: 'Le code doit contenir 6 chiffres.' })
  code!: string;

  @ApiPropertyOptional({
    example: '+213 26 00 00 07',
    maxLength: PHONE_MAX_LENGTH,
    description: 'The phone the code was sent to. Narrows the lookup to one account.',
  })
  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, { message: PHONE_ERROR_MESSAGE })
  phone?: string;
}

@ApiSchema({ description: 'Asks for a new SMS code. The previous one is superseded.' })
export class ResendCodeDto {
  @ApiProperty({
    example: '+213 26 00 00 07',
    maxLength: PHONE_MAX_LENGTH,
    description: 'The phone to text. Must match an account awaiting verification.',
  })
  @IsString()
  @Matches(PHONE_PATTERN, { message: PHONE_ERROR_MESSAGE })
  phone!: string;
}
