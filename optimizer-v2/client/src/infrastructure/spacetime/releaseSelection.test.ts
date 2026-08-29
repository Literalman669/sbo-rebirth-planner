import { describe, expect, it } from 'vitest';
import {
  parseFormulaSetVersion,
  selectCurrentRelease,
} from './releaseSelection';

const fallback = {
  version: 'bootstrap-0',
  formulaSetVersion: 'sbor-stats-v1' as const,
  sourceSummary: 'Bundled fallback',
  publishedAtMicros: 0n,
  lastReviewedAt: '2026-08-29',
};

describe('selectCurrentRelease', () => {
  it('prefers the single live current release', () => {
    const selected = selectCurrentRelease(
      [{ ...fallback, version: '2026.08.29.1', isCurrent: true }],
      fallback,
    );

    expect(selected).toEqual({
      release: expect.objectContaining({ version: '2026.08.29.1' }),
      source: 'live',
    });
  });

  it('uses the fallback when live data is unavailable', () => {
    expect(selectCurrentRelease([], fallback)).toEqual({
      release: fallback,
      source: 'fallback',
    });
  });

  it('rejects ambiguous live state', () => {
    expect(() =>
      selectCurrentRelease(
        [
          { ...fallback, version: 'a', isCurrent: true },
          { ...fallback, version: 'b', isCurrent: true },
        ],
        fallback,
      ),
    ).toThrow('ambiguous current dataset release');
  });

  it('rejects formula implementations the client does not support', () => {
    expect(() => parseFormulaSetVersion('future-formulas-v2')).toThrow(
      'unsupported formula set: future-formulas-v2',
    );
  });
});
