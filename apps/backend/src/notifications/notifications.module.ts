import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsService } from './notifications.service';

/**
 * Notifications are written by the cases, adoptions and services modules and
 * read by `/me` — a dedicated module keeps those four from importing each
 * other just to share one table.
 */
@Module({
  imports: [RealtimeModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
