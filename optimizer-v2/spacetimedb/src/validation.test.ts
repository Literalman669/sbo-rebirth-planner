import { describe, expect, it } from 'vitest';
import {
  assertExactlyOneCurrentRelease,
  validateDatasetReviewJson,
} from './validation';

describe('assertExactlyOneCurrentRelease', () => {
  it('rejects two current releases', () => {
    expect(() =>
      assertExactlyOneCurrentRelease([
        { version: 'bootstrap-0', isCurrent: true },
        { version: 'bootstrap-1', isCurrent: true },
      ]),
    ).toThrow('exactly one current dataset release required');
  });
});

describe('dataset review validation', () => {
  it('accepts only a strict receipt for its expected build', () => {
    const valid = JSON.stringify({
      schemaVersion: 1,
      buildId: 'build-a',
      inputFingerprint: 'build-input-00000001',
      pinnedDatasetVersion: '2026.08.30.1',
      targetDatasetVersion: '2026.09.01.1',
      impactKeyFingerprint: 'impact-00000002',
      reportFingerprint: 'impact-report-00000003',
      status: 'reviewed',
      reviewedAt: '2026-09-02T00:00:00.000Z',
    });
    expect(validateDatasetReviewJson(valid, 'build-a')).toEqual([]);
    expect(validateDatasetReviewJson(valid, 'build-b')).toEqual([
      'Stored dataset review is invalid',
    ]);
  });
});
