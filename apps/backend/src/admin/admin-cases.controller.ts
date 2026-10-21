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
import { CasesService, type Paginated, type Viewer } from '../cases/cases.service';
import { QueryCasesDto } from '../cases/dto/query-cases.dto';
import { ModerateCaseDto } from '../cases/dto/moderate-case.dto';
import { parseBbox } from '../cases/bbox';
import type { Case } from '../shared/types';

/**
 * `/admin/cases` — the moderation queue (PHASE2_PLAN §1 "Moderation", R6).
 *
 * A deliberate phase overlap: the trust pipeline cannot be demonstrated without
 * a `pending → approved` path, and a report held back forever is a report the
 * reporter never gets answered. The rest of `/admin/*` stays in Phase 4.
 *
 * `@UseGuards(AdminGuard)` is the enforcement point — there is no annotation to
 * forget and no role in the body or a header that can change it.
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/cases')
export class AdminCasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  @ApiOperation({
    summary: 'Every case, including the held ones',
    description:
      'No moderation gating — this is the queue. Sorted the same way as the public map, so an ' +
      'admin sees urgent reports first.',
  })
  @ApiQuery({ name: 'bbox', required: false, example: '3.9,36.5,4.4,36.9', description: 'The map box: `minLng,minLat,maxLng,maxLat`.' })
  @ApiQuery({ name: 'triage', required: false, description: 'Only cases at this triage level.' })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }`.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — admin only.' })
  list(@Query() query: QueryCasesDto): Promise<Paginated<Case>> {
    return this.cases.listForAdmin({
      bbox: parseBbox(query.bbox),
      triage: query.triage,
      species: query.species,
      category: query.category,
      status: query.status,
      zoneId: query.zoneId,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Patch(':id/moderation')
  @ApiOperation({
    summary: 'Approve or hide a case',
    description:
      '`approved` puts a held case on the public map; `hidden` removes it. Either way the case ' +
      'is re-broadcast as `case.updated`.',
  })
  @ApiParam({ name: 'id', description: 'The case id.' })
  @ApiOkResponse({ description: 'The moderated case.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — admin only.' })
  moderate(
    @Param('id') id: string,
    @Body() dto: ModerateCaseDto,
    @CurrentUser() user: Viewer,
  ): Promise<Case> {
    return this.cases.moderate(id, dto.decision, user as never);
  }
}
