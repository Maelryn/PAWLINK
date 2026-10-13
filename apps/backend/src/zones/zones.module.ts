import { Module } from '@nestjs/common';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

/**
 * Emergency zones — reads, and admin-only writes. `PrismaModule` is `@Global`;
 * everything else the service needs is raw PostGIS.
 */
@Module({
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
