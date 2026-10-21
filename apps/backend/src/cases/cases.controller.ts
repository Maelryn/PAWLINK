import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../common/decorators/auth.decorators';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { parseBbox } from './bbox';
import { CasesService, type Paginated, type Viewer } from './cases.service';
import { QueryCasesDto, NearbyCasesDto, DEFAULT_NEARBY_RADIUS_KM } from './dto/query-cases.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { FlagCaseDto, OfferHelpDto, PatchCaseStatusDto } from './dto/case.dto';
import { ConfirmCaseDto } from './dto/confirm-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import type { Case } from '../shared/types';

/**
 * `/cases` — the report flow and the map.
 *
 * The reads are `@Public()` and use `OptionalJwtAuthGuard`, so the map works for
 * a visitor while a signed-in one still sees their own held report. Every write
 * inherits the global `JwtAuthGuard` and needs a bearer token.
 */
@ApiTags('cases')
@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Cases inside a bbox — powers the map',
    description:
      'One raw PostGIS statement (`location && ST_MakeEnvelope(...)`) on the GIST index, ordered ' +
      'by `triage` (urgent → monitoring → stable) then `createdAt DESC`. Only `moderation` null or ' +
      '`approved` is public; a signed-in reporter also sees their own held report. ' +
      '`total` is the matching count, not the page length.',
  })
  @ApiQuery({ name: 'bbox', required: false, example: '3.9,36.5,4.4,36.9', description: 'The map box: `minLng,minLat,maxLng,maxLat`.' })
  @ApiQuery({ name: 'triage', required: false, enum: ['urgent', 'monitoring', 'stable'], description: 'Only cases at this triage level.' })
  @ApiQuery({ name: 'species', required: false, description: 'Only cases of this species.' })
  @ApiQuery({ name: 'category', required: false, enum: ['companion', 'livestock'], description: 'Only companion or only livestock cases.' })
  @ApiQuery({ name: 'status', required: false, enum: ['open', 'in_progress', 'resolved'], description: 'Only cases at this lifecycle status.' })
  @ApiQuery({ name: 'zoneId', required: false, description: 'Only cases inside this emergency zone.' })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }` — the pagination envelope.' })
  async list(
    @Query() query: QueryCasesDto,
    @CurrentUser() viewer?: Viewer,
  ): Promise<Paginated<Case>> {
    return this.cases.list(
      {
        bbox: parseBbox(query.bbox),
        triage: query.triage,
        species: query.species,
        category: query.category,
        status: query.status,
        zoneId: query.zoneId,
        page: query.page,
        pageSize: query.pageSize,
      },
      viewer,
    );
  }

  @Get('nearby')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cases within a radius — the dashboards',
    description: '`ST_DWithin` on the geography column, ordered by the KNN operator.',
  })
  @ApiOkResponse({ description: 'Each item carries an extra `distanceKm` (0.1 km).' })
  async nearby(@Query() query: NearbyCasesDto, @CurrentUser() user: Viewer): Promise<Paginated<Case & { distanceKm: number }>> {
    return this.cases.nearby(
      query.lat,
      query.lng,
      query.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM,
      { page: query.page, pageSize: query.pageSize },
      user,
    );
  }

  @Get(':id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'One case',
    description:
      'Public when public. A held case is a 404 for everyone except its reporter, exactly as ' +
      'invisible as it is on the map.',
  })
  @ApiParam({ name: 'id', description: 'The case id.' })
  @ApiOkResponse({ description: 'The `Case` shape from apps/web/lib/types.ts.' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — or a case the caller may not see.' })
  async findOne(@Param('id') id: string, @CurrentUser() viewer?: Viewer): Promise<Case> {
    return this.cases.findOne(id, viewer);
  }

  @Post()
  // The per-account half of the trust rate limit is enforced inside the service
  // and answers 429 TRUST_RATE_LIMITED. This is the **per-IP backstop** the spec
  // asks for ("≤ 5 reports / hour / account **and** per IP"): it catches someone
  // farming accounts from one address, which an account counter cannot.
  //
  // It is deliberately looser than the account limit. At exactly 5 it would fire
  // first every single time and the caller would see `RATE_LIMITED` instead of
  // the documented `TRUST_RATE_LIMITED` — the precise, contract-shaped error
  // would become unreachable. 15 keeps both limits meaningful.
  @Throttle({ default: { limit: 15, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Report a case',
    description:
      'Runs the whole trust pipeline and the AI triage server-side, stores both, and broadcasts ' +
      '`case.created` **only when the case is public**. The response carries `ai` and `trust`. ' +
      'Nothing about `trust`, `moderation`, `ai`, `reporter`, `id` or the timestamps is read from ' +
      'the body — those fields are absent from the DTO and stripped by the whitelist pipe. The ' +
      '5-reports-per-hour limit is enforced per account here and per IP by the throttler.',
  })
  @ApiCreatedResponse({ description: 'The stored case, with `ai` and `trust`.' })
  @ApiUnauthorizedResponse({ description: 'AUTH_UNAUTHORIZED · AUTH_ACCOUNT_DELETED' })
  create(@Body() dto: CreateCaseDto, @CurrentUser() user: Viewer): Promise<Case> {
    return this.cases.create(dto, user as never);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Move a case along its lifecycle',
    description: 'Volunteer, vet or admin only. A reporter gets `403 FORBIDDEN`.',
  })
  @ApiOkResponse({ description: 'The updated case; `case.updated` is broadcast.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiParam({ name: 'id', description: 'The case id.' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: PatchCaseStatusDto,
    @CurrentUser() user: Viewer,
  ): Promise<Case> {
    return this.cases.updateStatus(id, dto, user as never);
  }

  @Post(':id/help')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Offer help on a case',
    description:
      'Moves the case to `in_progress`, replaces this account\'s previous offer, emits ' +
      '`help.offered` and writes a `help` notification for the reporter.',
  })
  @ApiOkResponse({ description: 'The updated case.' })
  @ApiParam({ name: 'id', description: 'The case id.' })
  offerHelp(
    @Param('id') id: string,
    @Body() dto: OfferHelpDto,
    @CurrentUser() user: Viewer,
  ): Promise<Case> {
    return this.cases.offerHelp(id, dto, user as never);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '"Do you see this animal?"',
    description:
      'The answer is a vote: `seen: true` confirms the report, `seen: false` denies it. The ' +
      'caller must be within 1 km of the animal — the server measures the distance itself — and ' +
      'has one answer per report. Two "yes" raise the case to `verified`; two "no" (and more ' +
      '"no" than "yes") make it `suspicious` and send it back to the moderators.',
  })
  @ApiOkResponse({ description: 'The updated case.' })
  @ApiParam({ name: 'id', description: 'The case id.' })
  @ApiForbiddenResponse({ description: 'CONFIRM_TOO_FAR · CONFIRM_OWN_REPORT' })
  confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmCaseDto,
    @CurrentUser() user: Viewer,
  ): Promise<Case> {
    return this.cases.confirm(id, dto, user as never);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'The reporter corrects their report',
    description:
      'The description and the condition tags only. On a public report the change waits for a ' +
      'moderator (`pendingEdit`); on a report still held for moderation it applies straight away.',
  })
  @ApiOkResponse({ description: 'The updated case.' })
  @ApiParam({ name: 'id', description: 'The case id.' })
  @ApiForbiddenResponse({ description: 'CASE_NOT_OWNER' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCaseDto,
    @CurrentUser() user: Viewer,
  ): Promise<Case> {
    return this.cases.update(id, dto, user as never);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'The reporter removes their report',
    description:
      'The report and everything attached to it (helpers, answers, flags) go with it. Only the ' +
      'reporter may do it.',
  })
  @ApiNoContentResponse({ description: '204 — gone.' })
  @ApiParam({ name: 'id', description: 'The case id.' })
  @ApiForbiddenResponse({ description: 'CASE_NOT_OWNER' })
  remove(@Param('id') id: string, @CurrentUser() user: Viewer): Promise<void> {
    return this.cases.remove(id, user as never);
  }

  @Post(':id/flag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Report a case as wrong or abusive',
    description: 'Three distinct flags put the case back into `pending` and off the public map.',
  })
  @ApiOkResponse({ description: 'The updated case.' })
  @ApiParam({ name: 'id', description: 'The case id.' })
  flag(@Param('id') id: string, @Body() dto: FlagCaseDto, @CurrentUser() user: Viewer): Promise<Case> {
    return this.cases.flag(id, dto, user as never);
  }
}
