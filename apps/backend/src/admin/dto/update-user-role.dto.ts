import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ALL_ROLES } from '../../shared/enums';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ALL_ROLES })
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