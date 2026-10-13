import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/auth.decorators';
import type { AuthenticatedUser } from '../common/decorators/auth.decorators';
import { AdoptionsService } from './adoptions.service';
import { DecideRequestDto } from './dto/adoption.dto';
import type { AdoptionRequest } from '../shared/types';

/**
 * `/requests/:id` — the listing owner's decision, on its own top-level route
 * because that is the path the frontend's typed client generates from Swagger.
 * `POST /adoptions/:id/requests` stays nested; the decision is not.
 */
@ApiTags('adoptions')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly adoptions: AdoptionsService) {}

  @Patch(':id')
  @ApiOperation({
    summary: 'Accept or decline a request',
    description:
      'The listing owner only, and terminal — a decided request answers `409 REQUEST_ALREADY_ANSWERED` ' +
      'on a second attempt. The requester receives `adoptAccepted` / `adoptDeclined`.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'The decided `AdoptionRequest`.' })
  async decide(
    @Param('id') id: string,
    @Body() dto: DecideRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdoptionRequest> {
    return this.adoptions.decideRequest(id, dto, user);
  }
}
