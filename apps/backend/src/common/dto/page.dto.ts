import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** `?page=&pageSize=` — the paging half every `/me` list shares. */
@ApiSchema({ description: 'The `?page=&pageSize=` pair every paginated list shares.' })
export class PageQueryDto {
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
