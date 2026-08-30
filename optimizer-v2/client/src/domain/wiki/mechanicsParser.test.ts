import { describe, expect, it } from 'vitest';
import statsFixture from '../../features/curation/fixtures/stats.wikitext?raw';
import type { WikiPageSnapshot } from './model';
import { parseMechanicsSnapshot } from './mechanicsParser';

const snapshot: WikiPageSnapshot = {
  pageId: 100,
  pageTitle: 'Stats',
  sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats',
  revisionId: '23125',
  revisionTimestamp: '2025-11-03T13:14:55Z',
  contentHash: 'sha256:stats',
  content: statsFixture,
};

describe('parseMechanicsSnapshot', () => {
  it('extracts exact parameters only where the source gives a complete rule', () => {
    const result = parseMechanicsSnapshot(snapshot);
    const byId = new Map(result.mechanics.map((mechanic) => [mechanic.id, mechanic]));

    expect(byId.get('attack-from-str')).toMatchObject({
      computability: 'exact',
      parameters: { statCap: 500, damagePerStr: 0.004 },
      sourceRevision: '23125',
    });
    expect(byId.get('multi-hit-from-str-luk')).toMatchObject({
      computability: 'exact',
      parameters: {
        bonusPerPoint: 0.0002,
        individualCap: 0.1,
        combinedCap: 0.15,
      },
    });
    expect(byId.get('resistance-from-vit')).toMatchObject({
      computability: 'exact',
      parameters: { bonusPerVit: 0.0001, cap: 0.05 },
    });
  });

  it('keeps approximate or incomplete behavior descriptive', () => {
    const result = parseMechanicsSnapshot(snapshot);
    const byId = new Map(result.mechanics.map((mechanic) => [mechanic.id, mechanic]));

    expect(byId.get('jump-delay-from-agi')?.computability).toBe('descriptive');
    expect(byId.get('attack-interval-from-agi')?.computability).toBe('descriptive');
    expect(byId.get('drop-reroll-at-luk-cap')?.computability).toBe('descriptive');
    expect(byId.get('attack-interval-from-agi')?.parameters).toEqual({});
  });
});
