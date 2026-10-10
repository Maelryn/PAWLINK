import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { DUPLICATE_THRESHOLD, DHashService, fromHex } from './dhash.service';

const FIXTURES = join(__dirname, '..', '..', 'test', 'fixtures');
const fixture = (name: string) => readFileSync(join(FIXTURES, name));

describe('DHashService', () => {
  const service = new DHashService();

  it('produces a 64-bit hash as 16 hex characters', async () => {
    const hash = await service.hash(fixture('with-exif.jpg'));
    expect(hash.hex).toMatch(/^[0-9a-f]{16}$/);
    expect(hash.bits).toBeLessThanOrEqual(0xffffffffffffffffn);
  });

  it('is deterministic for the same file', async () => {
    const a = await service.hash(fixture('with-exif.jpg'));
    const b = await service.hash(fixture('with-exif.jpg'));
    expect(a.hex).toBe(b.hex);
    expect(service.hamming(a, b)).toBe(0);
  });

  it('round-trips through the hex form stored in the database', async () => {
    const hash = await service.hash(fixture('with-exif.jpg'));
    expect(fromHex(hash.hex).bits).toBe(hash.bits);
    expect(fromHex(hash.hex).hex).toBe(hash.hex);
  });

  it('treats a zero hash and an empty string as valid', () => {
    expect(fromHex('').bits).toBe(0n);
    expect(fromHex('0'.repeat(16)).bits).toBe(0n);
  });

  describe('survives re-encoding — the whole point of a dHash', () => {
    it('matches a recompressed copy', async () => {
      const original = await service.hash(fixture('with-exif.jpg'));
      const copy = await service.hash(fixture('recompressed.jpg'));
      expect(service.hamming(original, copy)).toBeLessThanOrEqual(DUPLICATE_THRESHOLD);
    });

    it('matches a resized copy', async () => {
      const original = await service.hash(fixture('with-exif.jpg'));
      const resized = await service.hash(fixture('resized.jpg'));
      expect(service.hamming(original, resized)).toBeLessThanOrEqual(DUPLICATE_THRESHOLD);
    });

    it('does not match a different image', async () => {
      const original = await service.hash(fixture('with-exif.jpg'));
      const other = await service.hash(fixture('different.jpg'));
      expect(service.hamming(original, other)).toBeGreaterThan(DUPLICATE_THRESHOLD);
    });

    it('separates two different images', async () => {
      expect(service.hamming(await service.hash(fixture('with-exif.jpg')), await service.hash(fixture('different.jpg')))).toBeGreaterThan(
        DUPLICATE_THRESHOLD,
      );
    });
  });

  describe('hamming', () => {
    it('counts differing bits', () => {
      const a = fromHex('0000000000000000');
      const b = fromHex('00000000000000ff');
      expect(service.hamming(a, b)).toBe(8);
      expect(service.hamming(a, a)).toBe(0);
    });

    it('is symmetric', async () => {
      const a = await service.hash(fixture('with-exif.jpg'));
      const b = await service.hash(fixture('recompressed.jpg'));
      expect(service.hamming(a, b)).toBe(service.hamming(b, a));
    });

    it('never exceeds 64', async () => {
      const a = await service.hash(fixture('with-exif.jpg'));
      const b = await service.hash(fixture('different.jpg'));
      expect(service.hamming(a, b)).toBeLessThanOrEqual(64);
    });
  });

  describe('isDuplicate / distanceFromHex', () => {
    it('is true at or below the threshold and false above it', () => {
      const near = { hex: '0'.repeat(14) + '0f', bits: 15n };
      expect(service.isDuplicate(fromHex('0'.repeat(16)), near)).toBe(true);
      expect(service.isDuplicate(fromHex('0'.repeat(16)), fromHex('ff'.repeat(8)))).toBe(false);
    });

    it('honours a custom threshold', async () => {
      const a = await service.hash(fixture('with-exif.jpg'));
      const b = await service.hash(fixture('recompressed.jpg'));
      const distance = service.hamming(a, b);
      expect(service.isDuplicate(a, b, distance)).toBe(true);
      expect(service.isDuplicate(a, b, distance - 1)).toBe(false);
    });

    it('compares a stored hex row against a fresh hash', async () => {
      const stored = await service.hash(fixture('with-exif.jpg'));
      const fresh = await service.hash(fixture('recompressed.jpg'));
      expect(service.distanceFromHex(stored.hex, fresh)).toBeLessThanOrEqual(DUPLICATE_THRESHOLD);
    });
  });

  describe('hashOrNull', () => {
    it('returns null instead of throwing on a non-image', async () => {
      expect(await service.hashOrNull(Buffer.from('not an image'))).toBeNull();
      expect(await service.hashOrNull(Buffer.from(''))).toBeNull();
    });

    it('returns the hash for a real image', async () => {
      expect(await service.hashOrNull(fixture('with-exif.jpg'))).toMatchObject({ hex: expect.stringMatching(/^[0-9a-f]{16}$/) });
    });
  });
});
