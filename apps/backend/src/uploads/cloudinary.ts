import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiError } from '../common/filters/http-exception.filter';

/**
 * Cloudinary signed-upload parameters (docs/BACKEND_PROMPT.md §3.3/§3.5).
 *
 * The browser uploads straight to Cloudinary, so the API only hands out the
 * signed params that authorise one upload to one folder. Keeping the signature
 * here — rather than letting the client build it — is the whole point: the API
 * secret never leaves the server.
 */

/** One signed-upload authorisation, valid for `UPLOAD_SIGNATURE_TTL`. */
export interface CloudinarySignature {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  /** sha1 of the sorted `key=value&…` string plus the API secret. */
  signature: string;
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Reads the three credentials from the environment; `null` when any is missing. */
export function readCloudinaryConfig(env = process.env): CloudinaryConfig | null {
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

/**
 * Cloudinary's own signing rule: sort the params by key, join them as
 * `key=value&…`, append the API secret, sha1 the whole thing. Anything signed
 * differently is rejected upstream, so the order is not a preference.
 */
export function signParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const query = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(query + apiSecret).digest('hex');
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  /** `true` when all three credentials are present. */
  isConfigured(): boolean {
    return readCloudinaryConfig() !== null;
  }

  /**
   * A one-shot signed-upload authorisation.
   *
   * Without the credentials this is a typed `UPLOADS_NOT_CONFIGURED` (501), not a
   * 500: the demo must run with no Cloudinary account, and the caller has to be
   * able to tell "not set up" from "broken".
   */
  signature(folder = 'pawlink/cases'): CloudinarySignature {
    const config = readCloudinaryConfig();
    if (!config) {
      this.logger.warn('POST /uploads/signature called without Cloudinary credentials.');
      throw new ApiError(
        501,
        'UPLOADS_NOT_CONFIGURED',
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and ' +
          'CLOUDINARY_API_SECRET to enable uploads.',
      );
    }

    // Cloudinary ignores a TTL in the params: a signed upload is simply
    // valid from `timestamp` onwards, so the only lever is how long the caller
    // keeps the answer. 10 minutes is plenty for a browser to PUT one file.
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signParams({ folder, timestamp }, config.apiSecret);

    return {
      cloudName: config.cloudName,
      apiKey: config.apiKey,
      folder,
      timestamp,
      signature,
    };
  }
}
