import { describe, expect, it } from '@jest/globals';
import {
  HARD_FAIL_IDS,
  MAX_ON_SITE_KM,
  MAX_PHOTO_AGE_HOURS,
  MAX_PHOTO_GPS_DRIFT_KM,
  MAX_REPORTS_PER_HOUR,
  TrustService,
  raiseTriage,
  scoreTrust,
} from './trust.service';
import { ExifService } from '../uploads/exif.service';
import type { TrustCheck } from '../shared/types';

/**
 * The scenarios are the web's own (apps/web/lib/trust.ts), ported rather than
 * paraphrased: the thresholds, the hardFail set, the 0.5 fallback score and the
 * 0.85 verified cut-off are all values the frontend already displays.
 */

const ALGER = { lat: 36.7538, lng: 3.0588 };
const KABYLIE = { lat: 36.632, lng: 4.205 };

const service = new TrustService(new ExifService());

function check(overrides: Partial<Parameters<TrustService['check']>[0]> = {}) {
  return service.check({
    user: { phoneVerified: true },
    location: ALGER,
    hasPhoto: true,
    recentReports: 0,
    inAlgeria: true,
    ...overrides,
  });
}

describe('scoreTrust — the ported arithmetic', () => {
  it('scores 0.5 when nothing is known', () => {
    const trust = scoreTrust([
      { id: 'account', ok: null },
      { id: 'inAlgeria', ok: null },
      { id: 'photoGps', ok: null },
      { id: 'photoFresh', ok: null },
      { id: 'onSite', ok: null },
      { id: 'animalDetected', ok: null },
      { id: 'duplicate', ok: null },
      { id: 'rateLimit', ok: null },
    ] satisfies TrustCheck[]);
    expect(trust.score).toBe(0.5);
    expect(trust.level).toBe('unverified'); // 0.5 is not < 0.5
  });

  it('rounds the score to two decimals', () => {
    expect(scoreTrust([{ id: 'account', ok: true }, { id: 'duplicate', ok: false }]).score).toBe(0.5);
    expect(scoreTrust([{ id: 'account', ok: true }, { id: 'duplicate', ok: true }, { id: 'rateLimit', ok: false }]).score).toBe(0.67);
  });

  it('needs every known check to pass for verified, plus account', () => {
    const allPass = scoreTrust([
      { id: 'account', ok: true },
      { id: 'inAlgeria', ok: true },
      { id: 'photoGps', ok: true },
      { id: 'photoFresh', ok: true },
      { id: 'onSite', ok: true },
      { id: 'animalDetected', ok: true },
      { id: 'duplicate', ok: true },
      { id: 'rateLimit', ok: true },
    ]);
    expect(allPass.level).toBe('verified');

    // 7 of 8 known checks pass (0.875 >= 0.85) but the account failed, so the
    // level stays unverified — the web requires checks[0] (account) for verified
    const noAccount = scoreTrust([
      { id: 'account', ok: false },
      { id: 'inAlgeria', ok: true },
      { id: 'photoGps', ok: true },
      { id: 'photoFresh', ok: true },
      { id: 'onSite', ok: true },
      { id: 'animalDetected', ok: true },
      { id: 'duplicate', ok: true },
      { id: 'rateLimit', ok: true },
    ]);
    expect(noAccount.score).toBe(0.88);
    expect(noAccount.level).toBe('unverified');
  });

  it('treats a hardFail id as suspicious whatever the score', () => {
    const highScoreButFailed = scoreTrust([
      { id: 'account', ok: true },
      { id: 'inAlgeria', ok: true },
      { id: 'photoGps', ok: true },
      { id: 'photoFresh', ok: true },
      { id: 'onSite', ok: true },
      { id: 'animalDetected', ok: true },
      { id: 'duplicate', ok: true },
      // a hard-fail id that failed
      { id: 'rateLimit', ok: false },
    ]);
    expect(highScoreButFailed.score).toBeGreaterThanOrEqual(0.85);
    expect(highScoreButFailed.level).toBe('suspicious');
  });

  it('keeps a non-hardFail failure as merely unverified', () => {
    const trust = scoreTrust([
      { id: 'account', ok: true },
      { id: 'onSite', ok: false }, // not in the hardFail set
    ]);
    expect(trust.level).toBe('unverified');
  });

  it('hard-tails the four documented ids', () => {
    expect(HARD_FAIL_IDS).toEqual(['inAlgeria', 'photoGps', 'duplicate', 'rateLimit']);
  });

  it('starts with confirmations and flags at zero', () => {
    expect(scoreTrust([{ id: 'account', ok: true }])).toMatchObject({ confirmations: 0, flags: 0 });
  });

  it('exposes the thresholds the web uses', () => {
    expect(MAX_PHOTO_GPS_DRIFT_KM).toBe(2);
    expect(MAX_ON_SITE_KM).toBe(5);
    expect(MAX_PHOTO_AGE_HOURS).toBe(48);
    expect(MAX_REPORTS_PER_HOUR).toBe(5);
  });
});

describe('TrustService.check — the eight checks', () => {
  it('passes everything for a verified reporter with a fresh photo in Algeria', async () => {
    const result = await check();
    expect(result.level).toBe('verified');
    expect(result.moderation).toBeNull();
    expect(result.checks).toHaveLength(8);
  });

  it('fails the account check for an unverified phone', async () => {
    const result = await check({ user: { phoneVerified: false } });
    expect(result.checks[0]).toEqual({ id: 'account', ok: false });
    expect(result.level).toBe('unverified'); // account alone is not a hard fail
  });

  it('fails inAlgeria and holds the report for moderation', async () => {
    const result = await check({
      location: { lat: 48.8566, lng: 2.3522 },
      inAlgeria: false,
    });
    expect(result.checks[1]).toEqual({ id: 'inAlgeria', ok: false });
    expect(result.level).toBe('suspicious');
    expect(result.moderation).toBe('pending');
  });

  describe('photoGps', () => {
    it('fails when the photo was taken more than 2 km from the pin', async () => {
      const result = await check({
        location: KABYLIE,
        exif: { gps: { lat: 36.66, lng: 4.12 }, takenAt: new Date(), camera: 'X' },
      });
      expect(result.checks.find((c) => c.id === 'photoGps')?.ok).toBe(false);
      expect(result.moderation).toBe('pending'); // photoGps is a hard fail
    });

    it('passes when the photo is within 2 km', async () => {
      const result = await check({
        location: KABYLIE,
        exif: { gps: { lat: 36.633, lng: 4.206 }, takenAt: new Date(), camera: 'X' },
      });
      expect(result.checks.find((c) => c.id === 'photoGps')?.ok).toBe(true);
    });

    it('is null — not false — when there is no EXIF GPS', async () => {
      const result = await check({ exif: { takenAt: new Date(), camera: 'X' } });
      const photoGps = result.checks.find((c) => c.id === 'photoGps');
      expect(photoGps?.ok).toBeNull();
      expect(photoGps).not.toHaveProperty('detail');
    });

    it('is null when the photo carries no EXIF at all', async () => {
      const result = await check({ exif: null });
      expect(result.checks.find((c) => c.id === 'photoGps')?.ok).toBeNull();
    });

    it('reports the drift in the detail string', async () => {
      const result = await check({
        exif: { gps: { lat: 36.755, lng: 3.065 }, takenAt: new Date(), camera: 'X' },
      });
      expect(result.checks.find((c) => c.id === 'photoGps')?.detail).toMatch(/km/);
    });
  });

  describe('photoFresh', () => {
    it('passes for a photo taken now', async () => {
      const result = await check({ exif: { takenAt: new Date(), camera: 'X' } });
      expect(result.checks.find((c) => c.id === 'photoFresh')?.ok).toBe(true);
    });

    it('fails for a photo older than 48 h', async () => {
      const result = await check({
        exif: { takenAt: new Date(Date.now() - 49 * 3_600_000), camera: 'X' },
      });
      expect(result.checks.find((c) => c.id === 'photoFresh')?.ok).toBe(false);
    });

    it('tolerates a camera clock an hour behind', async () => {
      const result = await check({
        exif: { takenAt: new Date(Date.now() - 3_600_000), camera: 'X' },
      });
      expect(result.checks.find((c) => c.id === 'photoFresh')?.ok).toBe(true);
    });

    it('fails a photo dated weeks in the future', async () => {
      const result = await check({
        exif: { takenAt: new Date(Date.now() + 21 * 86_400_000), camera: 'X' },
      });
      expect(result.checks.find((c) => c.id === 'photoFresh')?.ok).toBe(false);
    });

    it('is null when the timestamp is missing', async () => {
      const result = await check({ exif: { camera: 'X' } });
      expect(result.checks.find((c) => c.id === 'photoFresh')?.ok).toBeNull();
    });
  });

  describe('onSite', () => {
    it('passes within 5 km and fails beyond', async () => {
      expect(
        (await check({ device: { lat: 36.75, lng: 3.06 } })).checks.find((c) => c.id === 'onSite')?.ok,
      ).toBe(true);
      expect(
        (await check({ device: { lat: 35.6969, lng: -0.6308 } })).checks.find((c) => c.id === 'onSite')?.ok,
      ).toBe(false);
    });

    it('is null for a remote report, which is allowed', async () => {
      const result = await check({ device: null });
      expect(result.checks.find((c) => c.id === 'onSite')?.ok).toBeNull();
    });
  });

  describe('animalDetected', () => {
    // The AI service (apps/Ai/) is not delivered yet, so this check has no
    // signal to read: it is always "not enough data". When the backend↔AI
    // link is wired in, these tests regain their real pass/fail assertions.
    it('is null and explains itself as unavailable', async () => {
      const result = await check({ hasPhoto: true });
      const animal = result.checks.find((c) => c.id === 'animalDetected');
      expect(animal?.ok).toBeNull();
      expect(animal?.detail).toMatch(/indisponible/);
    });
  });

  it('fails duplicate when the photo is already in use', async () => {
    const result = await check({ duplicatePhoto: true });
    expect(result.checks.find((c) => c.id === 'duplicate')?.ok).toBe(false);
    expect(result.level).toBe('suspicious');
    expect(result.moderation).toBe('pending');
  });

  describe('rateLimit', () => {
    it('fails on the fifth report in an hour', async () => {
      const result = await check({ recentReports: MAX_REPORTS_PER_HOUR });
      expect(result.checks.find((c) => c.id === 'rateLimit')?.ok).toBe(false);
      expect(result.moderation).toBe('pending');
    });

    it('passes below the limit', async () => {
      expect((await check({ recentReports: 4 })).checks.find((c) => c.id === 'rateLimit')?.ok).toBe(true);
    });

    it('explains itself in the detail', async () => {
      const result = await check({ recentReports: 5 });
      expect(result.checks.find((c) => c.id === 'rateLimit')?.detail).toBe('5 signalements dans la dernière heure');
    });
  });

  it('orders the checks exactly as the web UI reads them', async () => {
    const result = await check();
    expect(result.checks.map((c) => c.id)).toEqual([
      'account',
      'inAlgeria',
      'photoGps',
      'photoFresh',
      'onSite',
      'animalDetected',
      'duplicate',
      'rateLimit',
    ]);
  });

  it('holds a report when only a hard-fail id fails even if the score is high', async () => {
    const result = await check({ duplicatePhoto: true });
    expect(result.level).toBe('suspicious');
    expect(result.moderation).toBe('pending');
  });
});

describe('raiseTriage', () => {
  it('never lowers the current triage', () => {
    expect(raiseTriage('urgent', 'stable')).toBe('urgent');
    expect(raiseTriage('monitoring', 'stable')).toBe('monitoring');
  });

  it('raises it when the rule demands it', () => {
    expect(raiseTriage('stable', 'monitoring')).toBe('monitoring');
    expect(raiseTriage('monitoring', 'urgent')).toBe('urgent');
    expect(raiseTriage('stable', 'urgent')).toBe('urgent');
  });

  it('keeps it when equal', () => {
    expect(raiseTriage('monitoring', 'monitoring')).toBe('monitoring');
  });
});
