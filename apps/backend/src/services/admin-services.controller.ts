import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ServicesService } from './services.service';
import { ModerateServiceDto } from './dto/service.dto';
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
