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
import { AdoptionsService } from './adoptions.service';
import { ModerateAdoptionDto } from './dto/adoption.dto';
import { EditDecisionDto } from '../common/dto/edit-decision.dto';
import { QueryAdoptionsDto } from './dto/query-adoptions.dto';
import type { AdoptionProfile } from '../shared/types';
import type { Paginated } from '../shared/pagination';

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

  @Get()
  @ApiOperation({
    summary: 'Every adoption listing, including pending ones (moderation queue).',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Only listings with this moderation status.' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number, 1-based.' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'How many rows per page.' })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }`.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — admin only.' })
  async list(@Query() query: QueryAdoptionsDto): Promise<Paginated<AdoptionProfile>> {
    return this.adoptions.listForAdmin(query);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Approve or reject a listing',
    description:
      '`approved` publishes it and notifies the owner `listingApproved`; `rejected` keeps it off the ' +
      'marketplace and notifies `listingRejected`. There is no other way a listing changes status.',
  })
  @ApiParam({ name: 'id', description: 'The adoption listing id.' })
  @ApiOkResponse({ description: 'The moderated listing.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — the caller is not an admin.' })
  async moderate(@Param('id') id: string, @Body() dto: ModerateAdoptionDto): Promise<AdoptionProfile> {
    return this.adoptions.moderate(id, dto);
  }

  @Patch(':id/edit')
  @ApiOperation({
    summary: 'Approve or refuse the change the owner proposed',
    description:
      'The second review: the owner corrected their live listing, and the public version stays ' +
      'as it is until a moderator decides. `approve` merges the change, `reject` drops it. The ' +
      'owner is notified either way.',
  })
  @ApiParam({ name: 'id', description: 'The adoption listing id.' })
  @ApiOkResponse({ description: 'The listing, with the change merged or dropped.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — the caller is not an admin.' })
  @ApiNotFoundResponse({ description: 'NO_PENDING_EDIT — nothing to decide.' })
  async decideEdit(
    @Param('id') id: string,
    @Body() dto: EditDecisionDto,
  ): Promise<AdoptionProfile> {
    return this.adoptions.decideEdit(id, dto.decision);
  }
}
