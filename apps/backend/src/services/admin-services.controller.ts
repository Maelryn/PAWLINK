import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { EditDecisionDto } from '../common/dto/edit-decision.dto';
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
  @ApiQuery({ name: 'type', required: false, description: 'Only listings of this type.' })
  @ApiQuery({ name: 'q', required: false, description: 'Substring match on name or description.' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number, 1-based.' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'How many rows per page.' })
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
  @ApiParam({ name: 'id', description: 'The service listing id.' })
  @ApiOkResponse({ description: 'The moderated listing.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — the caller is not an admin.' })
  async moderate(@Param('id') id: string, @Body() dto: ModerateServiceDto): Promise<Service> {
    return this.services.moderate(id, dto);
  }

  @Patch(':id/edit')
  @ApiOperation({
    summary: 'Approve or refuse the change the owner proposed',
    description:
      'The second review: the owner corrected their live listing, and the public version stays ' +
      'as it is until a moderator decides. `approve` merges the change, `reject` drops it. The ' +
      'owner is notified either way.',
  })
  @ApiParam({ name: 'id', description: 'The service listing id.' })
  @ApiOkResponse({ description: 'The listing, with the change merged or dropped.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — the caller is not an admin.' })
  @ApiNotFoundResponse({ description: 'NO_PENDING_EDIT — nothing to decide.' })
  async decideEdit(@Param('id') id: string, @Body() dto: EditDecisionDto): Promise<Service> {
    return this.services.decideEdit(id, dto.decision);
  }
}
