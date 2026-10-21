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
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Public } from '../common/decorators/auth.decorators';
import { ZonesService } from './zones.service';
import { CreateZoneDto, QueryZonesDto, UpdateZoneDto } from './dto/zone.dto';
import type { EmergencyZone } from '../shared/types';

/**
 * `/emergency-zones` — the polygon layer of the map.
 *
 * The list is `@Public()` — the zones are drawn on the rescue map, which is
 * browsed logged-out. Writes carry `@UseGuards(AdminGuard)` — the enforcement
 * point is the guard, not an annotation a future editor can forget.
 */
@ApiTags('zones')
@ApiBearerAuth()
@Controller('emergency-zones')
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Emergency zones',
    description:
      '`polygon` is GeoJSON ([lng, lat]); `center` is computed by `ST_Centroid` and `stats` by ' +
      '`ST_Intersects` against live cases — never read from a client or a stale column.',
  })
  @ApiQuery({ name: 'active', required: false, description: '`true` or `false`.' })
  @ApiOkResponse({ description: '`{ items, total, page, pageSize }` of `EmergencyZone`.' })
  async list(@Query() query: QueryZonesDto) {
    return this.zones.list(query);
  }

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Create a zone (admin)',
    description:
      'The polygon must be a closed GeoJSON ring inside Algeria, else `400 ZONE_INVALID_POLYGON`. ' +
      '`center` is recomputed with `ST_Centroid` — the client never supplies it.',
  })
  @ApiCreatedResponse({ description: 'The stored zone.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — the caller is not an admin.' })
  async create(@Body() dto: CreateZoneDto): Promise<EmergencyZone> {
    return this.zones.create(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Edit a zone (admin)',
    description: 'A polygon change recomputes `center` in the same statement that stores it.',
  })
  @ApiParam({ name: 'id', description: 'The emergency zone id.' })
  @ApiOkResponse({ description: 'The updated zone.' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND, or ZONE_INVALID_POLYGON.' })
  async update(@Param('id') id: string, @Body() dto: UpdateZoneDto): Promise<EmergencyZone> {
    return this.zones.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a zone (admin)',
    description:
      'Refused with `409 ZONE_IN_USE` while cases still belong to the zone — the FK is ' +
      '`ON DELETE SET NULL`, so deleting anyway would silently detach them.',
  })
  @ApiParam({ name: 'id', description: 'The emergency zone id.' })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND, or ZONE_IN_USE.' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.zones.remove(id);
  }
}
