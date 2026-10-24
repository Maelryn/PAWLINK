import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/auth.decorators';
import type { AuthenticatedUser } from '../common/decorators/auth.decorators';
import { ServicesService } from './services.service';
import { DecideBookingDto } from './dto/service.dto';
import type { Booking } from '../shared/types';

/**
 * `/bookings/:id` — the service owner's decision, on its own top-level route
 * because that is the path the frontend's typed client generates. Booking
 * *creation* stays nested under `/services/:id/bookings`.
 */
@ApiTags('services')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly services: ServicesService) {}

  @Patch(':id')
  @ApiOperation({
    summary: 'Confirm or decline a booking',
    description:
      'The service owner only, and terminal — a decided booking answers ' +
      '`409 BOOKING_ALREADY_ANSWERED` on a second attempt. The booker receives ' +
      '`bookingConfirmed` / `bookingDeclined`.',
  })
  @ApiParam({ name: 'id', description: 'The booking id.' })
  @ApiOkResponse({ description: 'The decided `Booking`.' })
  async decide(
    @Param('id') id: string,
    @Body() dto: DecideBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Booking> {
    return this.services.decideBooking(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a booking', description: 'The booker may cancel a sent or confirmed booking; the provider receives `bookingCancelled`.' })
  @ApiParam({ name: 'id', description: 'The booking id.' })
  @ApiNoContentResponse({ description: '204 — cancelled.' })
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.services.cancelBooking(id, user);
  }
}
