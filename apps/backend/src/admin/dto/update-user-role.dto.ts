import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ALL_ROLES } from '../../shared/enums';

@ApiSchema({
  description:
    'Changes an account’s role. Promoting to `vet` sets `licenseVerified` unless the flag is ' +
    'sent explicitly.',
})
export class UpdateUserRoleDto {
  @ApiProperty({ enum: ALL_ROLES, description: 'The new role.' })
  @IsIn(ALL_ROLES)
  role!: (typeof ALL_ROLES)[number];

  @ApiPropertyOptional({
    description:
      'Admin-managed verification flag (relevant for vets). Omitted leaves it untouched.',
  })
  @IsOptional()
  @IsBoolean()
  licenseVerified?: boolean;
}