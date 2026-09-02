import { z } from 'zod';

const unsafeTextControls = /[\u0000-\u001f\u007f]/;
const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (value) => !unsafeTextControls.test(value),
    'Identifier contains an unsupported control character',
  );

export const datasetReviewReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    buildId: identifierSchema,
    inputFingerprint: identifierSchema,
    pinnedDatasetVersion: identifierSchema,
    targetDatasetVersion: identifierSchema,
    impactKeyFingerprint: identifierSchema,
    reportFingerprint: identifierSchema,
    status: z.enum(['reviewed', 'applied']),
    reviewedAt: z.iso.datetime(),
  })
  .strict();

export type DatasetReviewReceipt = z.infer<
  typeof datasetReviewReceiptSchema
>;

export interface DatasetReviewImpactKey {
  buildId: string;
  inputFingerprint: string;
  pinnedVersion: string;
  targetVersion: string;
  impactKeyFingerprint?: string;
}

export function receiptMatchesImpact(
  receipt: DatasetReviewReceipt,
  impact: DatasetReviewImpactKey,
): boolean {
  return (
    impact.impactKeyFingerprint !== undefined &&
    receipt.buildId === impact.buildId &&
    receipt.inputFingerprint === impact.inputFingerprint &&
    receipt.pinnedDatasetVersion === impact.pinnedVersion &&
    receipt.targetDatasetVersion === impact.targetVersion &&
    receipt.impactKeyFingerprint === impact.impactKeyFingerprint
  );
}
