import { Controller, HttpCode, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/auth.decorators';
import type { CloudinarySignature } from './cloudinary';
import { MAX_UPLOAD_BYTES, UploadsService, type ProbeResult, type UploadedFile as UploadedPhoto } from './uploads.service';

/**
 * `/uploads` — everything that touches the raw bytes of a photo.
 *
 * Both routes need a bearer token: they are the trust pipeline's only source of
 * truth, so an anonymous caller must not be able to mint probes or signatures.
 */
@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('probe')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Read EXIF and a perceptual hash from an original photo',
    description:
      'The server reads `GPSLatitude`/`GPSLongitude`, `DateTimeOriginal`, the camera ' +
      'identity and a 64-bit dHash from the file **before** it is uploaded to Cloudinary, ' +
      'and returns an opaque `probeId`. `POST /cases` takes those ids, so `photoGps`, ' +
      '`photoFresh` and `duplicate` are computed from what the server saw rather than from ' +
      'anything the client claims. A photo with no EXIF is not an error: `exif` comes back ' +
      'empty and the checks that depend on it turn `null`.',
  })
  @ApiOkResponse({ description: '`{ probeId, exif, dHash }` — keep the probeId for POST /cases.' })
  async probe(
    @CurrentUser() user: { sub: string },
    @UploadedFile() file: UploadedPhoto,
  ): Promise<ProbeResult> {
    return this.uploads.probe(user.sub, file);
  }

  @Post('signature')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Cloudinary signed-upload parameters',
    description:
      'Authorises one direct browser → Cloudinary upload into the caller\'s own folder. ' +
      'The API secret never leaves the server. Without Cloudinary credentials this answers ' +
      '501 `UPLOADS_NOT_CONFIGURED` — the demo runs with no upload account.',
  })
  @ApiCreatedResponse({ description: 'Signed params for one upload.' })
  signature(@CurrentUser() user: { sub: string }): CloudinarySignature {
    return this.uploads.signatureFor(user.sub);
  }
}
