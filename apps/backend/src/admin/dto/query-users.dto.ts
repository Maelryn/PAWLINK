import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ALL_ROLES } from '../../shared/enums';

@ApiSchema({ description: 'The `GET /admin/users` filters.' })
export class QueryUsersDto {
  @ApiPropertyOptional({ enum: ALL_ROLES, description: 'Only accounts with this role.' })
  @IsOptional()
  @IsIn(ALL_ROLES)
  role?: (typeof ALL_ROLES)[number];

  @ApiPropertyOptional({ description: 'Substring match on name or email.' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1, description: 'Page number, 1-based.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100, description: 'How many rows per page.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}