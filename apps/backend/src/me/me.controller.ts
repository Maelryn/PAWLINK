import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/auth.decorators';
import { MeService } from './me.service';
import { UpdateMeDto } from './dto/update-me.dto';
import type { User } from '../shared/types';

/**
 * `/me` — the authenticated caller's own profile.
 *
 * No `@UseGuards` here: the global `JwtAuthGuard` already protects every route
 * unless it is `@Public()`, so these inherit the protection by default.
 */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

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
}
