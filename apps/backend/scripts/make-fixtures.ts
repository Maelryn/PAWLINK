/**
 * Writes the JPEG fixtures the e2e suite needs: images that carry real camera
 * EXIF (GPS + DateTimeOriginal), which is what the trust pipeline reads.
 *
 *   npx ts-node scripts/make-fixtures.ts
 *
 * The output is checked in under test/fixtures so the suite never regenerates
 * them at run time (and so the exact bytes under test are reviewable in a diff).
 * `test/fixtures/README.md` records how they were made.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT_DIR = join(__dirname, '..', 'test', 'fixtures');

/** The seeded wildfire case's coordinates — a report that will pass photoGps. */
const GPS = { lat: 36.632, lng: 4.205 };
const EXIF_DATE = '2026:10:03 14:12:00';

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const plain = await sharp({
    create: { width: 160, height: 160, channels: 3, background: { r: 120, g: 96, b: 72 } },
  })
    .composite([{ input: Buffer.from(SVG_MARKUP), blend: 'over' }])
    .jpeg({ quality: 88 })
    .toBuffer();

  // every "copy" derives from the EXIF-bearing image, so a re-used photo keeps
  // its metadata the way a real camera photo re-saved by someone would
  const withExif = insertExif(plain);

  writeFileSync(join(OUT_DIR, 'with-exif.jpg'), withExif);
  writeFileSync(join(OUT_DIR, 'no-exif.jpg'), plain);
  writeFileSync(
    join(OUT_DIR, 'recompressed.jpg'),
    // withMetadata(): sharp drops EXIF on output by default, which is exactly
    // the metadata-stripping the trust pipeline is designed to catch
    await sharp(withExif).jpeg({ quality: 62, progressive: true }).withMetadata().toBuffer(),
  );
  writeFileSync(
    join(OUT_DIR, 'resized.jpg'),
    await sharp(withExif).resize(320, 320, { fit: 'fill' }).jpeg({ quality: 88 }).withMetadata().toBuffer(),
  );
  writeFileSync(
    join(OUT_DIR, 'different.jpg'),
    await sharp({
      create: { width: 160, height: 160, channels: 3, background: { r: 30, g: 90, b: 200 } },
    })
      .composite([{ input: Buffer.from(OTHER_SVG), blend: 'over' }])
      .jpeg({ quality: 88 })
      .toBuffer(),
  );

  for (const name of ['with-exif.jpg', 'no-exif.jpg', 'recompressed.jpg', 'resized.jpg', 'different.jpg']) {
    console.log(`  wrote ${name}`);
  }
}

/**
 * Splices an APP1/EXIF segment in just after the SOI marker. Written by hand
 * because an EXIF-writing dependency is not worth adding for a fixture; only the
 * tags the pipeline reads are present (Make, Model, DateTimeOriginal, GPS + refs).
 */
function insertExif(jpeg: Buffer): Buffer {
  const exif = buildExifSegment();
  return Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]);
}

function buildExifSegment(): Buffer {
  const tiff = buildTiff();
  const segment = Buffer.alloc(2 + 2 + 6 + tiff.length);
  segment.writeUInt16BE(0xffe1, 0); // APP1 marker
  segment.writeUInt16BE(segment.length - 2, 2); // segment length
  segment.write('Exif\0\0', 4, 'ascii');
  tiff.copy(segment, 10);
  return segment;
}

/**
 * Little-endian TIFF. Every section is laid out with one cursor in order, so the
 * offsets cannot disagree with the allocated size — an earlier version of this
 * file pre-computed them by hand and overflowed the buffer.
 */
function buildTiff(): Buffer {
  const make = 'PawLink';
  const model = 'FixtureCam';

  const HEADER = 8;
  const IFD0 = 2 + 6 * 12 + 4; // 6 entries (incl. the Exif + GPS IFD pointers) + next-IFD
  const STRINGS = make.length + 1 + (model.length + 1) + (EXIF_DATE.length + 1);
  const EXIF_IFD = 2 + 2 * 12 + 4; // DateTimeOriginal lives in the Exif sub-IFD
  const GPS_IFD = 2 + 4 * 12 + 4;
  const GPS_REFS = 4; // "N\0" + "E\0"
  const GPS_RATIONALS = 6 * 8; // lat: 3 rationals, lng: 3 rationals

  const ifd0 = HEADER;
  const strings = ifd0 + IFD0;
  const exifIfd = strings + STRINGS;
  const gpsIfd = exifIfd + EXIF_IFD;
  const refs = gpsIfd + GPS_IFD;
  const rationals = refs + GPS_REFS;
  const tiff = Buffer.alloc(rationals + GPS_RATIONALS);

  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(ifd0, 4);

  let cursor = strings;
  const writeString = (value: string): number => {
    const at = cursor;
    tiff.write(value, at, 'ascii');
    tiff.writeUInt8(0, at + value.length);
    cursor += value.length + 1;
    return at;
  };
  const makeOffset = writeString(make);
  const modelOffset = writeString(model);
  const dateOffset = writeString(EXIF_DATE);

  // Writes one IFD: entries, then the (always zero) next-IFD pointer.
  const writeIfd = (at: number, entries: Array<[number, number, number, number]>): void => {
    tiff.writeUInt16LE(entries.length, at);
    let p = at + 2;
    for (const [tag, type, count, value] of entries) {
      tiff.writeUInt16LE(tag, p);
      tiff.writeUInt16LE(type, p + 2);
      tiff.writeUInt32LE(count, p + 4);
      tiff.writeUInt32LE(value, p + 8);
      p += 12;
    }
    tiff.writeUInt32LE(0, p);
  };

  writeIfd(ifd0, [
    [0x010f, 2, make.length + 1, makeOffset], // Make
    [0x0110, 2, model.length + 1, modelOffset], // Model
    [0x0132, 2, EXIF_DATE.length + 1, dateOffset], // DateTime
    [0x8769, 4, 1, exifIfd], // pointer to the Exif sub-IFD
    [0x8825, 4, 1, gpsIfd], // pointer to the GPS IFD
  ]);

  // DateTimeOriginal belongs in the Exif sub-IFD. My first version wrote it into
  // IFD0, which is where exifr (and every real camera) cannot see it.
  writeIfd(exifIfd, [
    [0x9003, 2, EXIF_DATE.length + 1, dateOffset], // DateTimeOriginal
    [0x9004, 2, EXIF_DATE.length + 1, dateOffset], // DateTimeDigitized
  ]);

  const latRationals = rationals;
  const lngRationals = rationals + 24;
  writeIfd(gpsIfd, [
    [0x0001, 2, 2, refs], // GPSLatitudeRef "N"
    [0x0002, 5, 3, latRationals], // GPSLatitude
    [0x0003, 2, 2, refs + 2], // GPSLongitudeRef "E"
    [0x0004, 5, 3, lngRationals], // GPSLongitude
  ]);

  tiff.write('N\0', refs, 'ascii');
  tiff.write('E\0', refs + 2, 'ascii');

  rational(tiff, latRationals, GPS.lat);
  rational(tiff, lngRationals, GPS.lng);

  return tiff;
}

function rational(tiff: Buffer, at: number, value: number): void {
  const deg = Math.floor(value);
  const minFloat = (value - deg) * 60;
  const min = Math.floor(minFloat);
  // seconds are stored with a denominator of 100, so the value must be
  // scaled by 100 — writing the raw seconds would truncate 55.2s to 0.55s
  const secHundredths = Math.round((minFloat - min) * 6000);

  let p = at;
  tiff.writeUInt32LE(deg, p); p += 4; tiff.writeUInt32LE(1, p);
  p += 4; tiff.writeUInt32LE(min, p); p += 4; tiff.writeUInt32LE(1, p);
  p += 4; tiff.writeUInt32LE(secHundredths, p); p += 4; tiff.writeUInt32LE(100, p);
}

/** Enough visual structure that a dHash has something real to compare. */
const SVG_MARKUP = `<svg width="160" height="160"><rect x="20" y="30" width="40" height="70" fill="#8a4b1f"/><rect x="90" y="80" width="55" height="40" fill="#f0e0c0"/><circle cx="110" cy="55" r="26" fill="#6b4423"/></svg>`;
const OTHER_SVG = `<svg width="160" height="160"><rect x="10" y="120" width="140" height="20" fill="#f5f5f5"/><ellipse cx="80" cy="70" rx="60" ry="30" fill="#1e63b8"/></svg>`;

main().catch((error) => {
  console.error('fixture generation failed:', error);
  process.exitCode = 1;
});
