/**
 * Decided once, before any spec file is collected, from the marker written by
 * `test/global-setup.ts`. Suites built on `describeWithDatabase` report as
 * *skipped* — never as green — when the database is unreachable.
 */
export const DATABASE_UP = process.env.E2E_DATABASE === 'up';

export const describeWithDatabase = DATABASE_UP ? describe : describe.skip;

/** Unique per run, so a suite can be replayed against a database with data in it. */
export function uniquePhone(): string {
  const suffix = String(Date.now()).slice(-6);
  return `+213 5${suffix} ${String(Math.floor(Math.random() * 900) + 100)}`;
}

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@pawlink.dz`;
}

/** Pulls the first `name=value` pair out of a `set-cookie` header array. */
export function cookieFrom(headers: Record<string, unknown>): string {
  const raw = (headers['set-cookie'] as string[] | undefined)?.[0];
  return raw ? raw.split(';')[0] : '';
}

/**
 * The build stamp hand-written into `test/fixtures/*.jpg` by
 * `scripts/make-fixtures.ts` (same 19-byte EXIF `YYYY:MM:DD HH:MM:SS` shape).
 */
const FIXTURE_EXIF_STAMP = '2026:10:03 14:12:00';

/**
 * Rewrites the fixture's `DateTime` / `DateTimeOriginal` tags to `at` — in
 * place, byte for byte, so no EXIF offset changes and `exifr` reads it like a
 * real camera photo.
 *
 * `photoFresh` is a 48-hour rule (trust.service.ts), so a checked-in fixture
 * with a fixed date makes the e2e suite rot 48 hours after it was written. The
 * fixtures stay immutable and reviewable; the *upload* pretends the photo was
 * taken now, which is exactly what a real report from a real camera looks like.
 * The dHash is untouched — it is computed from pixels, not metadata.
 */
export function freshExif(buffer: Buffer, at = new Date()): Buffer {
  const stamp = [
    String(at.getFullYear()).padStart(4, '0'),
    String(at.getMonth() + 1).padStart(2, '0'),
    String(at.getDate()).padStart(2, '0'),
  ].join(':') +
    ' ' +
    [at.getHours(), at.getMinutes(), at.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');

  const out = Buffer.from(buffer);
  const needle = Buffer.from(FIXTURE_EXIF_STAMP, 'ascii');
  for (let at_ = out.indexOf(needle); at_ !== -1; at_ = out.indexOf(needle, at_ + 1)) {
    out.write(stamp, at_, 'ascii');
  }
  return out;
}
