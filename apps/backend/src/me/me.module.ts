import { Module } from '@nestjs/common';
import { AdoptionsModule } from '../adoptions/adoptions.module';
import { ServicesModule } from '../services/services.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

/**
 * `/me` — the caller's own rows.
 *
 * The Phase 3 additions (`/me/adoptions`, `/me/requests`, `/me/bookings`,
 * `/me/notifications`) are thin delegations: the querying lives in the module
 * that owns the table, so `/me` never grows a second copy of a `WHERE`.
 */
@Module({
  imports: [AdoptionsModule, ServicesModule, NotificationsModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
