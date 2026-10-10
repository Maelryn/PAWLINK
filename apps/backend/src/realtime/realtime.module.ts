import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Realtime — the Socket.IO gateway and the four typed events.
 *
 * `AuthModule` is imported for `TokensService`: the handshake has to verify an
 * access token exactly the way `JwtStrategy` does, and using the same code is
 * what keeps the two paths from drifting apart.
 */
@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
