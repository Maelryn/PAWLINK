import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../common/decorators/auth.decorators';
import type { AuthenticatedUser } from '../common/decorators/auth.decorators';
import { AdminService } from './admin.service';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { AdminStatsDto } from './dto/admin-stats.dto';
import type { User } from '../shared/types';
import type { Paginated } from '../shared/pagination';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Aggregate platform statistics (admin only).' })
  @ApiOkResponse({ type: AdminStatsDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — admin only.' })
  stats(): Promise<AdminStatsDto> {
    return this.admin.stats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List users (admin only).' })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }`.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — admin only.' })
  listUsers(@Query() query: QueryUsersDto): Promise<Paginated<User>> {
    return this.admin.listUsers(query);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Change a user role (admin only).' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'The updated user.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — admin only.' })
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<User> {
    // `user` is available for audit logging if needed later.
    void user;
    return this.admin.updateRole(id, dto);
  }
}
