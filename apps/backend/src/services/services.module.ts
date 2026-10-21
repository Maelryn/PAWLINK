import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServicesController } from './services.controller';
import { BookingsController } from './bookings.controller';
import { AdminServicesController } from './admin-services.controller';
import { ServicesService } from './services.service';

/**
 * Services — the directory, reviews, bookings.
 *
 * Geo comes from the `@Global` `GeoModule`/`PrismaModule`; notifications from
 * the shared `NotificationsModule`. The `shelterId` check on adoptions reads
 * the `services` table through Prisma, so this module stays a leaf.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [ServicesController, BookingsController, AdminServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
