import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Perceptual hashing for the `duplicate` trust check (docs/BACKEND_PROMPT.md §3.5).
 *
 * A dHash is 64 bits: shrink to 9x8 greyscale, then compare each pixel with its
 * right-hand neighbour. It survives recompression and resizing — exactly the two
 * things someone re-using a rescue photo will do — while a checksum would not.
 */

/** Hamming distance at or below this counts as the same photo. */
export const DUPLICATE_THRESHOLD = 8;

export interface DHash {
  /** 16 hex characters (64 bits). */
  hex: string;
  /** The raw 8-byte key, for fast integer comparisons. */
  bits: bigint;
}

@Injectable()
export class DHashService {
  private readonly logger = new Logger(DHashService.name);

  /** Computes the 64-bit dHash of an image buffer. */
  async hash(buffer: Buffer): Promise<DHash> {
    const { data } = await sharp(buffer)
      .resize(9, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let bits = 0n;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = data[row * 9 + col];
        const right = data[row * 9 + col + 1];
        bits = (bits << 1n) | (left > right ? 1n : 0n);
      }
    }

    // Derived once, after the loop: a partial `bits` cannot describe the whole hash.
    const hex = bits.toString(16).padStart(16, '0');
    return { hex, bits };
  }

  /** Number of differing bits — 0 is identical, 64 is nothing alike. */
  hamming(a: DHash, b: DHash): number {
    let x = a.bits ^ b.bits;
    let count = 0;
    while (x) {
      x &= x - 1n;
      count++;
    }
    return count;
  }

  /** True when two hashes are the same photo by the pipeline's threshold. */
  isDuplicate(a: DHash, b: DHash, threshold = DUPLICATE_THRESHOLD): boolean {
    return this.hamming(a, b) <= threshold;
  }

  /** Hamming distance between two hex strings, for rows already in the database. */
  distanceFromHex(hex: string, other: DHash): number {
    return this.hamming(fromHex(hex), other);
  }

  /** Never throws: an unreadable image is the caller's problem to report. */
  async hashOrNull(buffer: Buffer): Promise<DHash | null> {
    try {
      return await this.hash(buffer);
    } catch (error) {
      this.logger.warn(
        `dHash failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}

/** Parses the 16-character hex form stored in `photo_hashes`. */
export function fromHex(hex: string): DHash {
  const bits = BigInt.asUintN(64, hex.length > 0 ? BigInt(`0x${hex}`) : 0n);
  return { hex, bits };
}
