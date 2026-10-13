import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../common/decorators/auth.decorators';
import type { AuthenticatedUser } from '../common/decorators/auth.decorators';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { Viewer } from '../shared/pagination';
import { AdoptionsService } from './adoptions.service';
import {
  CreateAdoptionDto,
  CreateRequestDto,
  UpdateAdoptionDto,
} from './dto/adoption.dto';
import { QueryAdoptionsDto } from './dto/query-adoptions.dto';
import type { AdoptionProfile, AdoptionRequest } from '../shared/types';

/**
 * `/adoptions` — the marketplace listings and their requests.
 *
 * The two reads are `@Public()` + `OptionalJwtAuthGuard` — the marketplace is
 * browsed logged-out, while a signed-in viewer still gets the phone-reveal
 * treatment. Every write inherits the global `JwtAuthGuard`. The phone rule
 * itself is applied in the serializer, so a controller can never leak
 * `ownerPhone` by forgetting a filter.
 */
@ApiTags('adoptions')
@ApiBearerAuth()
@Controller('adoptions')
export class AdoptionsController {
  constructor(private readonly adoptions: AdoptionsService) {}

  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Marketplace listings',
    description:
      'Defaults to `status=approved`. Non-admins only ever see approved listings plus their own in ' +
      'any status. `ownerPhone` appears only for the owner, an admin, or an accepted requester.',
  })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }` of `AdoptionProfile`.' })
  async list(@Query() query: QueryAdoptionsDto, @CurrentUser() viewer?: Viewer) {
    return this.adoptions.list(query, viewer);
  }

  @Get(':id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'One listing',
    description: 'A non-approved listing is a 404 unless the caller owns it or is an admin.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'The `AdoptionProfile` shape from apps/web/lib/types.ts.' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — or a listing the caller may not see.' })
  async findOne(@Param('id') id: string, @CurrentUser() viewer?: Viewer): Promise<AdoptionProfile> {
    return this.adoptions.findOne(id, viewer);
  }

  @Post()
  // §7: 5 adoptions per 10 minutes, per account and per IP.
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Post an adoption listing',
    description:
      'Always created `pending` — an admin approves before it appears. `ownerId` comes from the JWT ' +
      'and `ownerPhone` from the owner’s row. Every photo needs a probe from `POST /uploads/probe`: ' +
      'no camera EXIF → `ADOPTION_PHOTO_NO_EXIF`, a photo already used on PawLink → ' +
      '`ADOPTION_PHOTO_DUPLICATE`, more than 3 photos → `ADOPTION_TOO_MANY_PHOTOS`.',
  })
  @ApiCreatedResponse({ description: 'The stored listing, in the `AdoptionProfile` shape.' })
  @ApiUnauthorizedResponse({ description: 'AUTH_UNAUTHORIZED' })
  @ApiForbiddenResponse({ description: 'AUTH_ACCOUNT_DELETED' })
  async create(@Body() dto: CreateAdoptionDto, @CurrentUser() user: AuthenticatedUser): Promise<AdoptionProfile> {
    return this.adoptions.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit my listing',
    description: 'Owner only. Content fields only — `status` and `ownerId` are never accepted from a body.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'The updated listing.' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND, or ADOPTION_NOT_OWNER.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAdoptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdoptionProfile> {
    return this.adoptions.update(id, dto, user);
  }

  @Post(':id/requests')
  // §7: 10 adoption requests per 10 minutes.
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Ask to adopt',
    description:
      'One request per user per listing — a second one answers `409 ADOPTION_REQUEST_EXISTS`. ' +
      'The listing owner receives an `adoptRequest` notification.',
  })
  @ApiParam({ name: 'id' })
  @ApiCreatedResponse({ description: 'The stored `AdoptionRequest`.' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND, ADOPTION_OWN_LISTING or ADOPTION_REQUEST_EXISTS.' })
  async createRequest(
    @Param('id') id: string,
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdoptionRequest> {
    return this.adoptions.createRequest(id, dto, user);
  }
}
