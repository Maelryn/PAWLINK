import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { ServicesService } from './services.service';
import {
  CreateBookingDto,
  CreateReviewDto,
  CreateServiceDto,
  ReplyReviewDto,
  UpdateServiceDto,
} from './dto/service.dto';
import { QueryServicesDto } from './dto/query-services.dto';
import { PageQueryDto } from '../common/dto/page.dto';
import type { Booking, Review, Service } from '../shared/types';

/**
 * `/services` — the directory, its reviews and its bookings.
 *
 * The three reads are `@Public()` + `OptionalJwtAuthGuard`, so the directory is
 * browsed logged-out while a signed-in caller still sees their own pending
 * listing. Every write inherits the global `JwtAuthGuard`, and the listing
 * gate lives in the service — the controller can never serve a pending
 * service by accident.
 */
@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Service directory',
    description:
      'With `lat`+`lng`: `ST_DWithin` radius filter, ordered `pro DESC, distance ASC`. Without: ' +
      'ordered `pro DESC, rating DESC`. `q` matches name, description and tags (parameterized ' +
      '`ILIKE`). Approved listings plus your own in any status.',
  })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }` of `Service` (± `distanceKm`).' })
  async list(@Query() query: QueryServicesDto, @CurrentUser() viewer?: Viewer) {
    return this.services.list(query, viewer);
  }

  @Get(':id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'One service', description: 'Approved, or the owner’s own, or an admin’s view.' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'The `Service` shape from apps/web/lib/types.ts.' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — or a listing the caller may not see.' })
  async findOne(@Param('id') id: string, @CurrentUser() viewer?: Viewer): Promise<Service> {
    return this.services.findOne(id, viewer);
  }

  @Post()
  // §7: 5 service listings per 10 minutes.
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @ApiOperation({
    summary: 'List a service',
    description:
      'Always created `pending`; an admin approves before it appears. `ownerId` comes from the JWT — ' +
      '`rating`, `reviewCount`, `verified`, `pro` and `status` are never accepted from a body.',
  })
  @ApiCreatedResponse({ description: 'The stored listing.' })
  @ApiUnauthorizedResponse({ description: 'AUTH_UNAUTHORIZED' })
  async create(@Body() dto: CreateServiceDto, @CurrentUser() user: AuthenticatedUser): Promise<Service> {
    return this.services.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit my listing',
    description: 'Owner only. Content fields only — moderation, billing and identity are not yours.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'The updated listing.' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND, or SERVICE_NOT_OWNER.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Service> {
    return this.services.update(id, dto, user);
  }

  @Get(':id/reviews')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Reviews of a listing', description: 'Newest first, with the business reply when present.' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }` of `Review`.' })
  async reviews(@Param('id') id: string, @Query() query: PageQueryDto) {
    return this.services.reviews(id, query.page, query.pageSize);
  }

  @Post(':id/reviews')
  // §7: 5 reviews per 10 minutes.
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Review a service',
    description:
      'One per user per service — a second one answers `409 REVIEW_EXISTS`. `rating` is validated ' +
      '1–5 server-side; the listing’s `rating` (AVG, 1 decimal) and `reviewCount` are recomputed ' +
      'in the same transaction. Not on your own listing (`REVIEW_OWNER`).',
  })
  @ApiParam({ name: 'id' })
  @ApiCreatedResponse({ description: 'The stored `Review`.' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND, REVIEW_OWNER or REVIEW_EXISTS.' })
  async addReview(
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Review> {
    return this.services.addReview(id, dto, user);
  }

  @Patch(':id/reviews/:reviewId')
  @ApiOperation({
    summary: 'Reply to a review',
    description: 'The service owner only — this is the Pro reply the services screen renders.',
  })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'reviewId' })
  @ApiOkResponse({ description: 'The review, now with `reply`.' })
  async reply(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReplyReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Review> {
    return this.services.replyReview(id, reviewId, dto.reply, user);
  }

  @Post(':id/bookings')
  // §7: 10 bookings per 10 minutes.
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Request an appointment',
    description: 'Stored as `sent`; the service owner confirms or declines it. They receive a `booking` notification.',
  })
  @ApiParam({ name: 'id' })
  @ApiCreatedResponse({ description: 'The stored `Booking`.' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND — the listing is not visible to the caller.' })
  async book(
    @Param('id') id: string,
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Booking> {
    return this.services.book(id, dto, user);
  }
}
