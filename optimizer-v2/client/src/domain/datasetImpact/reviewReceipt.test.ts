import { describe, expect, it } from 'vitest';
import {
  datasetReviewReceiptSchema,
  receiptMatchesImpact,
  type DatasetReviewImpactKey,
  type DatasetReviewReceipt,
} from './reviewReceipt';

const receipt: DatasetReviewReceipt = {
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

const impact: DatasetReviewImpactKey = {
  buildId: 'build-a',
  inputFingerprint: 'build-input-00000001',
  pinnedVersion: '2026.08.30.1',
  targetVersion: '2026.09.01.1',
  impactKeyFingerprint: 'impact-00000002',
};

describe('dataset review receipts', () => {
  it('accepts exact private review state and matches its impact key', () => {
    expect(datasetReviewReceiptSchema.parse(receipt)).toEqual(receipt);
    expect(receiptMatchesImpact(receipt, impact)).toBe(true);
    expect(receiptMatchesImpact(receipt, { ...impact, impactKeyFingerprint: undefined }))
      .toBe(false);
    expect(
      receiptMatchesImpact(receipt, {
        ...impact,
        inputFingerprint: 'build-input-edited',
      }),
    ).toBe(false);
    expect(
      receiptMatchesImpact(receipt, {
        ...impact,
        targetVersion: '2026.09.02.1',
      }),
    ).toBe(false);
  });

  it('rejects unknown keys, unsafe identifiers, invalid times, and enums', () => {
    expect(() =>
      datasetReviewReceiptSchema.parse({ ...receipt, privateOwner: 'identity' }),
    ).toThrow();
    expect(() =>
      datasetReviewReceiptSchema.parse({ ...receipt, buildId: 'unsafe\0id' }),
    ).toThrow('unsupported control');
    expect(() =>
      datasetReviewReceiptSchema.parse({
        ...receipt,
        inputFingerprint: 'x'.repeat(256),
      }),
    ).toThrow();
    expect(() =>
      datasetReviewReceiptSchema.parse({ ...receipt, status: 'dismissed' }),
    ).toThrow();
    expect(() =>
      datasetReviewReceiptSchema.parse({ ...receipt, reviewedAt: 'yesterday' }),
    ).toThrow();
  });
});
