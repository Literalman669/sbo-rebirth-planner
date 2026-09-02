import { describe, expect, it } from 'vitest';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import { fingerprintDatasetSnapshot } from './fingerprint';
import { buildDatasetReleaseIndex } from './releaseIndex';

function snapshot(version: string, publishedAt: string) {
  return { ...structuredClone(bootstrapRelease), version, publishedAt };
}

describe('dataset release index', () => {
  it('orders by publication metadata and prefers the strongest source per version', () => {
    const earlier = snapshot('2026.08.30.9', '2026-08-30T12:00:00.000Z');
    const sameTimeLower = snapshot(
      '2026.09.01.1',
      '2026-09-01T12:00:00.000Z',
    );
    const sameTimeHigher = snapshot(
      '2026.09.01.2',
      '2026-09-01T12:00:00.000Z',
    );

    const index = buildDatasetReleaseIndex([
      { snapshot: sameTimeHigher, availability: 'cached' },
      { snapshot: earlier, availability: 'bundled' },
      { snapshot: sameTimeLower, availability: 'cached' },
      { snapshot: sameTimeHigher, availability: 'live' },
    ]);

    expect(index.map(({ version }) => version)).toEqual([
      '2026.08.30.9',
      '2026.09.01.1',
      '2026.09.01.2',
    ]);
    expect(index.at(-1)).toMatchObject({
      availability: 'live',
      contentFingerprint: fingerprintDatasetSnapshot(sameTimeHigher),
    });
  });
});
