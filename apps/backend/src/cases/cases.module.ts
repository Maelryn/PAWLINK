import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';
import { AdminCasesController } from '../admin/admin-cases.controller';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { TrustService } from './trust.service';

/**
 * Cases — the whole Phase 2 surface.
 *
 * `GeoModule`, `PrismaModule` and `UsersModule` are `@Global`; the other three
 * dependencies are listed because the trust pipeline genuinely needs all of
 * them: `UploadsModule` for the probes and `RealtimeModule` for the broadcasts.
 * Removing one of those imports would break `POST /cases`, which is what makes
 * the dependency worth seeing. The AI module is now wired in (CasesService calls
 * AIService during case creation).
 */
@Module({
  imports: [UploadsModule, RealtimeModule, AuthModule, NotificationsModule, AiModule],
  controllers: [CasesController, AdminCasesController],
  providers: [CasesService, TrustService],
  exports: [CasesService],
})
export class CasesModule {}
