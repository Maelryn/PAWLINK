import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/auth.decorators';
import { AdoptionsService } from '../adoptions/adoptions.service';
import { ServicesService } from '../services/services.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PageQueryDto } from '../common/dto/page.dto';
import { MeService } from './me.service';
import { UpdateMeDto } from './dto/update-me.dto';
import type { User } from '../shared/types';

/**
 * `/me` — the authenticated caller's own profile and their marketplace rows.
 *
 * No `@UseGuards` here: the global `JwtAuthGuard` already protects every route
 * unless it is `@Public()`, so these inherit the protection by default. Every
 * query is scoped to `user.sub` in the owning service — there is no filter a
 * client can add to read someone else's rows.
 */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly adoptions: AdoptionsService,
    private readonly services: ServicesService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Current user', description: 'Read back from the database, never from the token.' })
  @ApiOkResponse({ description: 'The `User` shape from apps/web/lib/types.ts.' })
  @ApiUnauthorizedResponse({ description: 'AUTH_UNAUTHORIZED · AUTH_ACCOUNT_DELETED' })
  async getMe(@CurrentUser() user: { sub: string }): Promise<User> {
    return this.me.get(user.sub);
  }

  @Patch()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Update the current profile',
    description:
      'Profile fields only. Changing `phone` clears `phoneVerified` — the new ' +
      'number must be confirmed by SMS before the next login.',
  })
  @ApiOkResponse({ description: 'The updated user.' })
  async updateMe(@CurrentUser() user: { sub: string }, @Body() dto: UpdateMeDto): Promise<User> {
    return this.me.update(user.sub, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @ApiOperation({
    summary: 'Delete the current account',
    description:
      'Personal data is blanked and the password hash dropped — which is also ' +
      'what marks the account as gone. The row survives so `cases.reporterId` ' +
      'and `reviews.authorId` keep resolving, and every access token issued for ' +
      'it stops working immediately.',
  })
  @ApiOkResponse({ description: '204 — gone.' })
  async removeMe(@CurrentUser() user: { sub: string }): Promise<void> {
    await this.me.remove(user.sub);
  }

  // ─────────── marketplace rows (Phase 3) ───────────

  @Get('adoptions')
  @ApiOperation({ summary: 'My adoption listings', description: 'Any status — this is my dashboard, not the marketplace.' })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }` of `AdoptionProfile`.' })
  async myAdoptions(@CurrentUser() user: { sub: string }, @Query() query: PageQueryDto) {
    return this.adoptions.mine(user.sub, query.page, query.pageSize);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Requests I sent', description: 'The `AdoptionRequest`s on other people’s listings.' })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }` of `AdoptionRequest`.' })
  async myRequests(@CurrentUser() user: { sub: string }, @Query() query: PageQueryDto) {
    return this.adoptions.myRequests(user.sub, query.page, query.pageSize);
  }

  @Get('requests/received')
  @ApiOperation({ summary: 'Requests on my listings', description: 'What the account screen shows an owner.' })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }` of `AdoptionRequest`.' })
  async receivedRequests(@CurrentUser() user: { sub: string }, @Query() query: PageQueryDto) {
    return this.adoptions.receivedRequests(user.sub, query.page, query.pageSize);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Bookings I made', description: 'Appointment requests the caller sent to services.' })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }` of `Booking`.' })
  async myBookings(@CurrentUser() user: { sub: string }, @Query() query: PageQueryDto) {
    return this.services.myBookings(user.sub, query.page, query.pageSize);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'My notifications', description: 'Newest first, including the Phase 2 `help` ones.' })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }` of `AppNotification`.' })
  async myNotifications(@CurrentUser() user: { sub: string }, @Query() query: PageQueryDto) {
    return this.notifications.list(user.sub, query.page ?? 1, query.pageSize ?? 20);
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark every notification read', description: 'Only the caller’s own rows — never anyone else’s.' })
  @ApiNoContentResponse({ description: '204 — done.' })
  async readAllNotifications(@CurrentUser() user: { sub: string }): Promise<void> {
    await this.notifications.readAll(user.sub);
  }
}
