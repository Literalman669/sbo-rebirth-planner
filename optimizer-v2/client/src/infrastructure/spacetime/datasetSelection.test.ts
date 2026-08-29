import { describe, expect, it } from 'vitest';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import { selectPreferredDataset } from './datasetSelection';

const bundled = {
  ...bootstrapRelease,
  version: '2026.08.29.1',
  publishedAt: '2026-08-29T10:00:00.000Z',
};

describe('selectPreferredDataset', () => {
  it('prefers a newer cached release over bundled data', () => {
    const cached = {
      ...bundled,
      version: '2026.08.29.2',
      publishedAt: '2026-08-29T11:00:00.000Z',
    };

    expect(
      selectPreferredDataset(
        { snapshot: bundled, source: 'bundled' },
        { snapshot: cached, source: 'cached' },
      ),
    ).toMatchObject({ source: 'cached', snapshot: { version: cached.version } });
  });

  it('prefers equally versioned live data over cache', () => {
    expect(
      selectPreferredDataset(
        { snapshot: bundled, source: 'cached' },
        { snapshot: bundled, source: 'live' },
      ).source,
    ).toBe('live');
  });

  it('does not replace a newer cache with older live data', () => {
    const cached = {
      ...bundled,
      version: '2026.08.29.3',
      publishedAt: '2026-08-29T12:00:00.000Z',
    };

    expect(
      selectPreferredDataset(
        { snapshot: cached, source: 'cached' },
        { snapshot: bundled, source: 'live' },
      ).source,
    ).toBe('cached');
  });
});
