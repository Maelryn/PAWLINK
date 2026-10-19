import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ALL_ROLES } from '../../shared/enums';

export class QueryUsersDto {
  @ApiPropertyOptional({ enum: ALL_ROLES })
  @IsOptional()
  @IsIn(ALL_ROLES)
  role?: (typeof ALL_ROLES)[number];

  @ApiPropertyOptional({ description: 'Substring match on name or email.' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}