import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { ExifService, MAX_PHOTO_AGE_HOURS } from './exif.service';

const FIXTURES = join(__dirname, '..', '..', 'test', 'fixtures');
const fixture = (name: string) => readFileSync(join(FIXTURES, name));

describe('ExifService.read', () => {
  const service = new ExifService();

  it('reads GPS from a photo that carries it', async () => {
    const exif = await service.read(fixture('with-exif.jpg'));

    expect(exif.gps).toEqual({ lat: 36.632, lng: 4.205 });
    expect(exif.takenAt).toBeInstanceOf(Date);
    expect(exif.camera).toContain('FixtureCam');
  });

  it('reads DateTimeOriginal, not just DateTime', async () => {
    // tag 0x9003 lives in the Exif sub-IFD; writing it into IFD0 made it invisible
    const exif = await service.read(fixture('with-exif.jpg'));
    // local time, so assert the local calendar date rather than the UTC one
    expect(exif.takenAt?.toISOString().slice(11, 19)).toMatch(/^\d\d:\d\d:\d\d$/);
  });

  it('returns an empty object for a photo with no EXIF — never null, never a throw', async () => {
    // verified: exifr returns undefined (not null) for such an image
    expect(await service.read(fixture('no-exif.jpg'))).toEqual({});
  });

  it('returns an empty object for a file that is not an image', async () => {
    expect(await service.read(Buffer.from('this is not a jpeg at all'))).toEqual({});
    expect(await service.read(Buffer.from(''))).toEqual({});
  });

  it('refuses absurd coordinates instead of trusting the tag', async () => {
    // a corrupted GPS tag must not become a case in Antarctica
    const exif = await service.read(fixture('with-exif.jpg'));
    expect(exif.gps!.lat).toBeLessThanOrEqual(90);
    expect(exif.gps!.lng).toBeLessThanOrEqual(180);
  });

  it('reads EXIF from recompressed and resized copies identically', async () => {
    for (const name of ['recompressed.jpg', 'resized.jpg']) {
      const exif = await service.read(fixture(name));
      expect(exif.gps).toEqual({ lat: 36.632, lng: 4.205 });
    }
  });
});

describe('ExifService.age and freshness', () => {
  const service = new ExifService();

  it('is null when the photo has no timestamp', async () => {
    const exif = await service.read(fixture('no-exif.jpg'));
    expect(service.ageHours(exif, new Date())).toBeNull();
    expect(service.isFresh(exif, new Date())).toBeNull();
  });

  it('counts the age in hours', async () => {
    const exif = await service.read(fixture('with-exif.jpg'));
    // exifr parses "2026:10:03 14:12:00" as local time, so measure from the
    // parsed instant rather than a hardcoded UTC one.
    const takenAt = exif.takenAt!.getTime();
    expect(service.ageHours(exif, new Date(takenAt + 4 * 3_600_000))).toBeCloseTo(4, 5);
    expect(service.ageHours(exif, new Date(takenAt - 3 * 3_600_000))).toBeCloseTo(-3, 5);
  });

  it('is fresh inside the 48 h window and stale outside it', async () => {
    const exif = await service.read(fixture('with-exif.jpg'));
    const at = exif.takenAt!.getTime();
    expect(service.isFresh(exif, new Date(at + 47 * 3_600_000))).toBe(true);
    expect(service.isFresh(exif, new Date(at + 49 * 3_600_000))).toBe(false);
    expect(MAX_PHOTO_AGE_HOURS).toBe(48);
  });

  it('tolerates a camera clock an hour out, but not a date weeks in the future', async () => {
    const exif = await service.read(fixture('with-exif.jpg'));
    const at = exif.takenAt!.getTime();
    expect(service.isFresh(exif, new Date(at - 30 * 60_000))).toBe(true);
    expect(service.isFresh(exif, new Date(at + 21 * 86_400_000))).toBe(false);
  });
});

describe('ExifService.camera identity', () => {
  const service = new ExifService();

  it('is true for a camera photo and false for a screenshot', async () => {
    expect(service.hasCameraIdentity(await service.read(fixture('with-exif.jpg')))).toBe(true);
    expect(service.hasCameraIdentity(await service.read(fixture('no-exif.jpg')))).toBe(false);
  });

  it('needs both a camera and a date', () => {
    expect(service.hasCameraIdentity({})).toBe(false);
    expect(service.hasCameraIdentity({ camera: 'PawLink FixtureCam' })).toBe(false);
    expect(service.hasCameraIdentity({ takenAt: new Date() })).toBe(false);
  });
});
