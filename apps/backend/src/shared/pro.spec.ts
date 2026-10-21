import { describe, expect, it } from '@jest/globals';
import { isProActive, readProSubscription } from './pro';

/**
 * The `users.pro` Json column, read back safely.
 *
 * The column is Json: anything at all can be in it (an old row, a hand-edited
 * value, a shape from a future version). A listing must never be featured, and
 * a request must never crash, because of a value the server did not write.
 */

const VALID = {
  plan: 'pro',
  since: '2026-09-01T00:00:00.000Z',
  until: '2026-10-01T00:00:00.000Z',
} as const;

describe('readProSubscription', () => {
  it('reads the shape the server writes', () => {
    expect(readProSubscription(VALID)).toEqual(VALID);
  });

  it('accepts the pro+ tier', () => {
    expect(readProSubscription({ ...VALID, plan: 'plus' })?.plan).toBe('plus');
  });

  const BAD: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['a string', 'pro'],
    ['an array', [VALID]],
    ['an unknown plan', { ...VALID, plan: 'gold' }],
    ['a missing until', { plan: 'pro', since: VALID.since }],
    ['an unparseable until', { ...VALID, until: 'tomorrow' }],
  ];

  it.each(BAD)('refuses %s', (_label, value) => {
    expect(readProSubscription(value)).toBeUndefined();
  });
});

describe('isProActive', () => {
  const now = Date.parse('2026-10-21T12:00:00.000Z');

  it('is active while until is in the future', () => {
    expect(isProActive({ ...VALID, until: '2026-11-01T00:00:00.000Z' }, now)).toBe(true);
  });

  it('is not active once until has passed — the listing turns itself off', () => {
    expect(isProActive(VALID, now)).toBe(false);
  });

  it('is not active without a subscription', () => {
    expect(isProActive(undefined, now)).toBe(false);
    expect(isProActive(null, now)).toBe(false);
  });
});
