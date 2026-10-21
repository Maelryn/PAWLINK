import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdoptionsController } from './adoptions.controller';
import { RequestsController } from './requests.controller';
import { AdminAdoptionsController } from './admin-adoptions.controller';
import { AdoptionsService } from './adoptions.service';

/**
 * Adoptions — listings, requests, and the phone-reveal rule.
 *
 * `UploadsModule` for the probe pipeline (`ExifService.hasCameraIdentity`,
 * `UploadsService.consume`) and `NotificationsModule` for every notification
 * the flow fires. `PrismaModule` and `GeoModule` are `@Global`.
 */
@Module({
  imports: [UploadsModule, NotificationsModule],
  controllers: [AdoptionsController, RequestsController, AdminAdoptionsController],
  providers: [AdoptionsService],
  exports: [AdoptionsService],
})
export class AdoptionsModule {}
