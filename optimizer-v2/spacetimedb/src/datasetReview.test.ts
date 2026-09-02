import { describe, expect, it } from 'vitest';
import {
  createDatasetPinnedRevisionProfile,
  mergeDatasetReview,
  parseAndValidateDatasetReviewJson,
  type ServerDatasetReviewReceipt,
} from './datasetReview';

const receipt: ServerDatasetReviewReceipt = {
  schemaVersion: 1,
  buildId: 'build-a',
  inputFingerprint: 'build-input-00000001',
  pinnedDatasetVersion: '2026.08.30.1',
  targetDatasetVersion: '2026.09.01.1',
  impactKeyFingerprint: 'impact-00000002',
  reportFingerprint: 'impact-report-00000003',
  status: 'reviewed',
  reviewedAt: '2026-09-02T00:00:00.000Z',
};

describe('server dataset review receipts', () => {
  it('parses exact version one JSON for the expected build', () => {
    expect(
      parseAndValidateDatasetReviewJson(JSON.stringify(receipt), 'build-a'),
    ).toEqual(receipt);
    for (const invalid of [
      { ...receipt, buildId: 'build-b' },
      { ...receipt, owner: 'private' },
      { ...receipt, inputFingerprint: 'unsafe\0value' },
    ]) {
      expect(() =>
        parseAndValidateDatasetReviewJson(JSON.stringify(invalid), 'build-a'),
      ).toThrow('Stored dataset review is invalid');
    }
  });

  it('merges by reviewed time and uses canonical content for deterministic ties', () => {
    const earlier = structuredClone(receipt);
    const later = {
      ...receipt,
      status: 'applied' as const,
      reviewedAt: '2026-09-02T01:00:00.000Z',
    };
    const tiedLower = { ...later, reportFingerprint: 'impact-report-00000001' };
    const tiedHigher = { ...later, reportFingerprint: 'impact-report-00000009' };

    expect(mergeDatasetReview(earlier, later)).toEqual(later);
    expect(mergeDatasetReview(later, earlier)).toEqual(later);
    expect(mergeDatasetReview(tiedLower, tiedHigher)).toEqual(tiedHigher);
    expect(mergeDatasetReview(tiedHigher, tiedLower)).toEqual(tiedHigher);
    expect(earlier).toEqual(receipt);
  });

  it('copies an authoritative revision profile with only the dataset pin changed', () => {
    const source = {
      schemaVersion: 2,
      level: 20,
      maxFloor: 3,
      weaponPath: 'two-handed',
      goal: 'balanced',
      weaponSkill: 18,
      str: 20,
      def: 10,
      agi: 12,
      vit: 8,
      luk: 5,
      datasetVersion: '2026.08.30.1',
      accessPreferences: 'active-event,badge',
    };

    expect(
      createDatasetPinnedRevisionProfile(source, '2026.09.01.1'),
    ).toEqual({ ...source, datasetVersion: '2026.09.01.1' });
    expect(source.datasetVersion).toBe('2026.08.30.1');
  });
});
