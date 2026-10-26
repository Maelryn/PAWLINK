import type { CaseHelper, TrustCheck, User as UserRow } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { caseRowToCase, trustRowsToTrust } from './serialize';
import type { CaseRowWithRelations } from './serialize';

/** A complete AIAnalysis — the serializer validates this blob on the way out. */
const VALID_AI = {
  triage: 'urgent',
  confidence: 0.93,
  summary: 'A cat appears to be in immediate danger.',
  observedSigns: ['Animal cannot move away by itself'],
  safetyAdvice: ['Approach slowly and keep a safe distance.'],
  possiblyContagious: false,
  recommendedHelp: ['transport'],
  suggestedServices: [],
  forcedUrgentByRule: true,
  disclaimer: 'PawLink AI does not diagnose. Always contact a veterinarian.',
  model: 'gemini-flash (mock)',
};

function makeRow(overrides: Partial<CaseRowWithRelations> = {}): CaseRowWithRelations {
  const now = new Date('2026-10-03T10:00:00.000Z');
  const base = {
    id: 'c1',
    title: 'Chat coincé sur un toit',
    species: 'cat',
    category: 'companion',
    count: null,
    status: 'open',
    triage: 'urgent',
    lat: 36.66,
    lng: 4.12,
    address: 'Tizi Ouzou',
    photos: ['https://cdn.test/1.jpg'],
    description: 'Un chat coincé depuis hier soir.',
    conditionTags: ['trapped'],
    reporterId: 'u1',
    ai: VALID_AI,
    emergencyZoneId: null,
    reporterOnSite: null,
    moderation: null,
    trustLevel: 'unverified',
    trustScore: 0.75,
    trustConfirmations: 0,
    trustFlags: 0,
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...base,
    reporter: { id: 'u1', name: 'Yasmine Belkacem', avatar: '' },
    helpers: [],
    confirms: [],
    flags: [],
    trustChecks: [],
    ...overrides,
  } as unknown as CaseRowWithRelations;
}

describe('caseRowToCase', () => {
  it('never leaks the reporter row or a password hash', () => {
    const row = makeRow({
      reporter: {
        id: 'u1',
        name: 'Yasmine',
        avatar: '',
      } as CaseRowWithRelations['reporter'],
    });
    const json = JSON.stringify(caseRowToCase(row));
    expect(json).not.toMatch(/passwordHash|reporterId|location geography/i);
    expect((caseRowToCase(row).reporter as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('serializes dates as ISO 8601 UTC strings', () => {
    const c = caseRowToCase(makeRow());
    expect(c.createdAt).toBe('2026-10-03T10:00:00.000Z');
    expect(c.updatedAt).toBe('2026-10-03T10:00:00.000Z');
  });

  it('omits optional fields instead of sending null', () => {
    const c = caseRowToCase(makeRow({ ai: null }));
    expect(c.count).toBeUndefined();
    expect(c.emergencyZoneId).toBeUndefined();
    expect(c.reporterOnSite).toBeUndefined();
    expect(c.moderation).toBeUndefined();
    expect(c.ai).toBeUndefined();
    // top level only: trust.checks[].ok is null BY CONTRACT ("not enough data")
    for (const [key, value] of Object.entries(c)) {
      if (key === 'trust') continue;
      expect(value).not.toBeNull();
    }
  });

  it('keeps a fully populated case intact', () => {
    const now = new Date('2026-10-03T10:00:00.000Z');
    const c = caseRowToCase(
      makeRow({
        count: 5,
        moderation: 'pending',
        reporterOnSite: true,
        emergencyZoneId: 'z1',
        ai: VALID_AI,
        helpers: [
          {
            id: 'h1',
            caseId: 'c1',
            userId: 'u2',
            helpType: 'transport',
            message: null,
            createdAt: now,
            user: { id: 'u2', name: 'Amine Haddad', avatar: '' },
          } as unknown as CaseHelper & { user: Pick<UserRow, 'id' | 'name' | 'avatar'> },
        ],
      }),
    );

    expect(c).toMatchObject({
      count: 5,
      moderation: 'pending',
      reporterOnSite: true,
      emergencyZoneId: 'z1',
      ai: VALID_AI,
      helpers: [{ user: { id: 'u2', name: 'Amine Haddad', avatar: '' }, helpType: 'transport' }],
    });
  });

  it('carries the helper stage, nextHelp and answers', () => {
    const now = new Date('2026-10-03T10:00:00.000Z');
    const c = caseRowToCase(
      makeRow({
        helpers: [
          {
            id: 'h1',
            caseId: 'c1',
            userId: 'u2',
            helpType: 'transport',
            message: null,
            stage: 'onsite',
            stageAt: now,
            createdAt: now,
            user: { id: 'u2', name: 'Amine Haddad', avatar: '' },
          } as unknown as CaseHelper & { user: Pick<UserRow, 'id' | 'name' | 'avatar'> },
        ],
        nextHelp: { types: ['transport', 'foster'], by: 'u1', at: '2026-10-03T11:00:00.000Z' },
        answers: { conscious: true, bleeding: false, walk: 'yes', unrelated: true },
      }),
    );

    expect(c.helpers[0]).toMatchObject({ stage: 'onsite', stageAt: now.toISOString() });
    expect(c.nextHelp).toEqual({
      types: ['transport', 'foster'],
      by: 'u1',
      at: '2026-10-03T11:00:00.000Z',
    });
    // unknown questions and non-boolean answers never reach the wire
    expect(c.answers).toEqual({ conscious: true, bleeding: false });
  });

  it('drops malformed nextHelp and answers instead of passing the Json through', () => {
    expect(caseRowToCase(makeRow({ nextHelp: { types: [], by: 'u1', at: 'x' } })).nextHelp).toBeUndefined();
    expect(caseRowToCase(makeRow({ nextHelp: [] })).nextHelp).toBeUndefined();
    expect(caseRowToCase(makeRow({ answers: [] })).answers).toBeUndefined();
    expect(caseRowToCase(makeRow({ answers: { conscious: 'yes' } })).answers).toBeUndefined();
  });

  it('passes ai through untouched — the AI contract is the API contract', () => {    const ai = {
      triage: 'urgent',
      confidence: 0.93,
      summary: 'A cat appears to be in immediate danger.',
      observedSigns: ['trapped'],
      safetyAdvice: ['Keep a safe distance.'],
      possiblyContagious: false,
      recommendedHelp: ['transport'],
      suggestedServices: [],
      forcedUrgentByRule: true,
      disclaimer: 'PawLink AI does not diagnose.',
      model: 'gemini-flash (mock)',
    };
    expect(caseRowToCase(makeRow({ ai: ai })).ai).toEqual(ai);
  });

  it('embeds the reporter as UserLite, only id/name/avatar', () => {
    const c = caseRowToCase(makeRow());
    expect(Object.keys(c.reporter).sort()).toEqual(['avatar', 'id', 'name']);
  });
});

describe('trustRowsToTrust', () => {
  const checks: TrustCheck[] = [
    { id: 't1', caseId: 'c1', check: 'rateLimit', ok: true, detail: null },
    { id: 't2', caseId: 'c1', check: 'account', ok: true, detail: null },
    { id: 't3', caseId: 'c1', check: 'inAlgeria', ok: true, detail: null },
    { id: 't4', caseId: 'c1', check: 'photoGps', ok: null, detail: 'no exif' },
    { id: 't5', caseId: 'c1', check: 'duplicate', ok: false, detail: 'same dHash' },
  ] as TrustCheck[];

  it('orders checks exactly as the web UI reads them, account first', () => {
    const trust = trustRowsToTrust('unverified', 0.75, 0, 0, checks);
    expect(trust.checks.map((c) => c.id)).toEqual([
      'account',
      'inAlgeria',
      'photoGps',
      'photoFresh',
      'onSite',
      'animalDetected',
      'duplicate',
      'rateLimit',
    ]);
    expect(trust.checks[0].id).toBe('account');
    expect(trust.checks[0].ok).toBe(true);
  });

  it('fills missing checks with ok:null rather than dropping them', () => {
    const trust = trustRowsToTrust('unverified', 0, 0, 0, [checks[0]]);
    expect(trust.checks.map((c) => c.id)).toHaveLength(8);
    expect(trust.checks.filter((c) => c.ok === null)).toHaveLength(7);
    expect(trust.checks.every((c) => !('detail' in c) || c.detail === undefined)).toBe(true);
  });

  it('keeps a detail string only when one exists', () => {
    const trust = trustRowsToTrust('unverified', 0, 0, 0, checks);
    expect(trust.checks.find((c) => c.id === 'photoGps')?.detail).toBe('no exif');
    expect(trust.checks.find((c) => c.id === 'account')).not.toHaveProperty('detail');
  });

  it('rounds the score to 2 decimals like the web scorer', () => {
    expect(trustRowsToTrust('unverified', 0.6666666, 0, 0, []).score).toBe(0.67);
  });

  it('carries confirmations and flags through', () => {
    const trust = trustRowsToTrust('verified', 0.9, 3, 1, []);
    expect(trust).toMatchObject({ confirmations: 3, flags: 1, level: 'verified' });
  });

  it('works with no checks at all', () => {
    expect(trustRowsToTrust('unverified', 0, 0, 0, [])).toMatchObject({ level: 'unverified' });
  });
});

describe('"do you see this animal?" — who answered', () => {
  it('keeps the yes and the no apart, so the web can refuse a second answer', () => {
    const trust = trustRowsToTrust(
      'verified',
      0.9,
      2,
      0,
      [],
      [
        { userId: 'u2', seen: true },
        { userId: 'u3', seen: true },
        { userId: 'u4', seen: false },
      ],
    );

    expect(trust.confirmedBy).toEqual(['u2', 'u3']);
    expect(trust.deniedBy).toEqual(['u4']);
  });

  it('omits both lists when nobody answered — never an empty array on the wire', () => {
    const trust = trustRowsToTrust('unverified', 0.5, 0, 0, []);
    expect(trust).not.toHaveProperty('confirmedBy');
    expect(trust).not.toHaveProperty('deniedBy');
  });

  it('carries the people who flagged the report', () => {
    const trust = trustRowsToTrust('suspicious', 0.2, 0, 1, [], [], [{ userId: 'u5' }]);
    expect(trust.flaggedBy).toEqual(['u5']);
  });
});
