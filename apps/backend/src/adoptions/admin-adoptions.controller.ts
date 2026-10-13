import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdoptionsService } from './adoptions.service';
import { ModerateAdoptionDto } from './dto/adoption.dto';
import type { AdoptionProfile } from '../shared/types';

/**
 * `/admin/adoptions` — the listing moderation decision. The **queue** (the
 * `GET` that lists pending listings) is Phase 4; the flow needs the decision
 * itself now, or a submitted listing could never go public.
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/adoptions')
export class AdminAdoptionsController {
  constructor(private readonly adoptions: AdoptionsService) {}

  @Patch(':id')
  @ApiOperation({
    summary: 'Approve or reject a listing',
    description:
      '`approved` publishes it and notifies the owner `listingApproved`; `rejected` keeps it off the ' +
      'marketplace and notifies `listingRejected`. There is no other way a listing changes status.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'The moderated listing.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — the caller is not an admin.' })
  async moderate(@Param('id') id: string, @Body() dto: ModerateAdoptionDto): Promise<AdoptionProfile> {
    return this.adoptions.moderate(id, dto);
  }
}
