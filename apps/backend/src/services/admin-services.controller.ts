import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
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
import { ServicesService } from './services.service';
import { ModerateServiceDto } from './dto/service.dto';
import { QueryServicesDto } from './dto/query-services.dto';
import type { Paginated } from '../shared/pagination';
import type { Viewer } from '../shared/pagination';
import type { ServiceWithDistance } from './serialize';
import type { Service } from '../shared/types';

/**
 * `/admin/services` — the listing moderation decision. The **queue** (the `GET`
 * listing pending services) is Phase 4; approving and rejecting are here
 * because the flow cannot work without them.
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/services')
export class AdminServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Every service listing, including pending ones (moderation queue).' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }`.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — admin only.' })
  async list(
    @Query() query: QueryServicesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Paginated<ServiceWithDistance>> {
    const viewer: Viewer = { sub: user.sub, role: user.role };
    return this.services.list(query, viewer);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Approve or reject a service listing',
    description:
      'Approve sets `status: approved` **and** `verified: true` (the approval IS the license check) ' +
      'and notifies the owner `serviceApproved`. Reject only sets `status: rejected` — no ' +
      'notification, matching the web client’s `moderateService` exactly.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'The moderated listing.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — the caller is not an admin.' })
  async moderate(@Param('id') id: string, @Body() dto: ModerateServiceDto): Promise<Service> {
    return this.services.moderate(id, dto);
  }
}
