import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary';
import { DHashService } from './dhash.service';
import { ExifService } from './exif.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

/**
 * Uploads — EXIF, perceptual hashing and Cloudinary signing.
 *
 * `DHashService` and `ExifService` are exported because the trust pipeline
 * (`cases/trust.service.ts`) is the other consumer of the same two primitives,
 * and it must not re-read the bytes itself.
 */
@Module({
  controllers: [UploadsController],
  providers: [UploadsService, CloudinaryService, ExifService, DHashService],
  exports: [UploadsService, ExifService, DHashService, CloudinaryService],
})
export class UploadsModule {}
