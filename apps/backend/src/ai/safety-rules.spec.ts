import { describe, expect, it } from '@jest/globals';
import {
  CONTAGIOUS_KEYWORDS,
  CONTAGIOUS_TAGS,
  MONITOR_TAGS,
  URGENT_KEYWORDS,
  URGENT_TAGS,
  evaluateRules,
  helpForTags,
  isHerd,
  matchesContagiousRule,
  matchesMonitorRule,
  matchesUrgentRule,
  raiseTriage,
  triageRank,
} from './safety-rules';

/**
 * The rule layer, asserted as the web wrote it (apps/web/lib/ai/analyze.ts).
 *
 * The point of the suite is that every keyword really does fire, in every
 * language the frontend ships, and that the layer can only ever *raise* a
 * triage — a rule that lowered one would let a keyword lookup undo a vet's
 * judgement.
 */

describe('urgent keywords', () => {
  it('fires on a French keyword', () => {
    expect(matchesUrgentRule('Le chien saigne de la patte', [])).toBe(true);
  });

  it('fires on an English keyword', () => {
    expect(matchesUrgentRule('It is bleeding badly', [])).toBe(true);
  });

  it('fires on an Arabic keyword', () => {
    expect(matchesUrgentRule('الحيوان ينزيف', [])).toBe(true);
  });

  it('fires on a Darija keyword', () => {
    // "a car hit it"
    expect(matchesUrgentRule('ضربتو طوموبيل', [])).toBe(true);
  });

  it('fires on every single listed keyword, not just one per language', () => {
    for (const keyword of URGENT_KEYWORDS) {
      expect(matchesUrgentRule(`unrelated text ${keyword} more text`, [])).toBe(true);
    }
  });

  it('fires on every urgent tag', () => {
    for (const tag of URGENT_TAGS) {
      expect(matchesUrgentRule('nothing to see here', [tag])).toBe(true);
    }
  });

  it('stays quiet on an ordinary description', () => {
    expect(matchesUrgentRule('Un chat dort sur le mur, il a l\'air bien', ['thin'])).toBe(false);
  });
});

describe('contagious detection', () => {
  it('fires on every contagious keyword', () => {
    for (const keyword of CONTAGIOUS_KEYWORDS) {
      expect(matchesContagiousRule(`text ${keyword} text`, [])).toBe(true);
    }
  });

  it('fires on every contagious tag', () => {
    for (const tag of CONTAGIOUS_TAGS) {
      expect(matchesContagiousRule('', [tag])).toBe(true);
    }
  });

  it('does not fire on an urgent word', () => {
    expect(matchesContagiousRule('il saigne', [])).toBe(false);
  });
});

describe('the monitor bucket', () => {
  it('includes the contagious tags, exactly as the web does', () => {
    for (const tag of CONTAGIOUS_TAGS) {
      expect((MONITOR_TAGS as readonly string[]).includes(tag)).toBe(true);
    }
  });

  it('fires on a plain welfare tag', () => {
    expect(matchesMonitorRule(['limping'])).toBe(true);
    expect(matchesMonitorRule(['abandoned'])).toBe(true);
  });

  it('does not fire on a healthy animal', () => {
    expect(matchesMonitorRule(['healthy'])).toBe(false);
  });
});

describe('raiseTriage — rules can only raise', () => {
  it('raises', () => {
    expect(raiseTriage('stable', 'monitoring')).toBe('monitoring');
    expect(raiseTriage('monitoring', 'urgent')).toBe('urgent');
    expect(raiseTriage('stable', 'urgent')).toBe('urgent');
  });

  it('never lowers', () => {
    expect(raiseTriage('urgent', 'stable')).toBe('urgent');
    expect(raiseTriage('monitoring', 'stable')).toBe('monitoring');
    expect(raiseTriage('urgent', 'monitoring')).toBe('urgent');
  });

  it('holds on an equal level', () => {
    expect(raiseTriage('monitoring', 'monitoring')).toBe('monitoring');
  });

  it('orders the three levels', () => {
    expect(triageRank('stable')).toBeLessThan(triageRank('monitoring'));
    expect(triageRank('monitoring')).toBeLessThan(triageRank('urgent'));
  });
});

describe('evaluateRules', () => {
  it('reports all three families at once', () => {
    expect(evaluateRules('il saigne et tousse', ['trapped', 'coughing'])).toEqual({
      hit: true,
      contagious: true,
      monitor: true,
    });
  });

  it('reports a quiet case', () => {
    expect(evaluateRules('un chat tranquille', ['healthy'])).toEqual({
      hit: false,
      contagious: false,
      monitor: false,
    });
  });
});

describe('helpForTags', () => {
  it('always asks for something', () => {
    expect(helpForTags([], 'stable').size).toBeGreaterThan(0);
  });

  it('asks for medical as soon as the case is urgent', () => {
    expect(helpForTags([], 'urgent').has('medical')).toBe(true);
  });

  it('maps a trapped animal to transport and search', () => {
    const help = helpForTags(['trapped'], 'urgent');
    expect(help.has('transport')).toBe(true);
    expect(help.has('search')).toBe(true);
  });

  it('maps an abandoned kitten to foster', () => {
    expect(helpForTags(['abandoned', 'young'], 'monitoring').has('foster')).toBe(true);
  });
});

describe('isHerd', () => {
  it('is true for a flock past two animals', () => {
    expect(isHerd('sheep', 3)).toBe(true);
    expect(isHerd('chicken', 12)).toBe(true);
  });

  it('is false for companions and for a single animal', () => {
    expect(isHerd('dog', 3)).toBe(false);
    expect(isHerd('cow', 2)).toBe(false);
  });
});
