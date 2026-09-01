import { z } from 'zod';
import {
  MAX_PROGRESS_HISTORY,
  MAX_PROGRESS_OBJECTIVES,
  type PlanProgress,
  type ProgressEventOutcome,
  type ProgressObjectiveStatus,
  type ProgressTaskCategory,
} from './model';

const unsafeTextControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const persistedIdSchema = z.string().trim().min(1).max(255);
const safeTextSchema = (max: number) =>
  z.string().trim().min(1).max(max).refine(
    (value) => !unsafeTextControls.test(value),
    'Text contains unsupported control characters',
  );
const timestampSchema = z.iso.datetime();

const categorySchema = z.enum([
  'stat-allocation',
  'equipment-upgrade',
  'level-milestone',
  'floor-milestone',
  'manual-objective',
] satisfies ProgressTaskCategory[]);
const objectiveStatusSchema = z.enum([
  'pending',
  'completed',
  'skipped',
] satisfies ProgressObjectiveStatus[]);
const eventOutcomeSchema = z.enum([
  'completed',
  'skipped',
  'reopened',
  'superseded',
] satisfies ProgressEventOutcome[]);
const eventSourceSchema = z.enum(['automatic', 'manual', 'legacy']);

const objectiveSchema = z
  .object({
    actionKey: persistedIdSchema,
    category: categorySchema,
    status: objectiveStatusSchema,
    source: eventSourceSchema,
    planFingerprint: persistedIdSchema,
    updatedAt: timestampSchema.optional(),
    note: safeTextSchema(500).optional(),
  })
  .strict()
  .superRefine((objective, context) => {
    if (objective.source !== 'legacy' && objective.updatedAt === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Current objective states require an update timestamp',
        path: ['updatedAt'],
      });
    }
  });

const historyEventSchema = z
  .object({
    id: persistedIdSchema,
    actionKey: persistedIdSchema,
    category: categorySchema,
    label: safeTextSchema(200),
    outcome: eventOutcomeSchema,
    source: eventSourceSchema,
    planFingerprint: persistedIdSchema,
    datasetVersion: persistedIdSchema.optional(),
    occurredAt: timestampSchema.optional(),
    note: safeTextSchema(500).optional(),
  })
  .strict()
  .superRefine((event, context) => {
    if (event.source !== 'legacy' && event.occurredAt === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Current history events require a timestamp',
        path: ['occurredAt'],
      });
    }
  });

const uniqueBy = <T>(values: T[], select: (value: T) => string) =>
  new Set(values.map(select)).size === values.length;

export const planProgressSchema = z
  .object({
    schemaVersion: z.literal(2),
    buildId: persistedIdSchema,
    wallet: z
      .object({
        balance: z.number().int().nonnegative().safe(),
        updatedAt: timestampSchema,
      })
      .strict()
      .optional(),
    objectives: z
      .array(objectiveSchema)
      .max(MAX_PROGRESS_OBJECTIVES)
      .refine(
        (values) => uniqueBy(values, (value) => value.actionKey),
        'Objective action keys must be unique',
      ),
    history: z
      .array(historyEventSchema)
      .max(MAX_PROGRESS_HISTORY)
      .refine(
        (values) => uniqueBy(values, (value) => value.id),
        'History event IDs must be unique',
      ),
    currentPlanFingerprint: persistedIdSchema.optional(),
    reconciledThroughLevel: z.number().int().min(1).max(10_000).optional(),
    acknowledgedDatasetVersion: persistedIdSchema.optional(),
  })
  .strict();

const legacyProgressSchema = z
  .object({
    schemaVersion: z.literal(1),
    buildId: persistedIdSchema,
    completedActionIds: z
      .array(persistedIdSchema)
      .refine((ids) => new Set(ids).size === ids.length, 'IDs must be unique'),
    dismissedRecommendationIds: z
      .array(persistedIdSchema)
      .refine((ids) => new Set(ids).size === ids.length, 'IDs must be unique'),
    reconciledThroughLevel: z.number().int().min(1).max(10_000).optional(),
    acknowledgedDatasetVersion: persistedIdSchema.optional(),
  })
  .strict();

function categoryForLegacyAction(actionKey: string): ProgressTaskCategory {
  if (actionKey.startsWith('spend-stats:')) return 'stat-allocation';
  if (actionKey.startsWith('equipment:')) return 'equipment-upgrade';
  return 'manual-objective';
}

function legacyObjective(
  actionKey: string,
  status: 'completed' | 'skipped',
) {
  return {
    actionKey,
    category: categoryForLegacyAction(actionKey),
    status,
    source: 'legacy' as const,
    planFingerprint: 'legacy',
  };
}

function legacyEvent(
  actionKey: string,
  outcome: 'completed' | 'skipped',
) {
  const readableId = `legacy:${outcome}:${actionKey}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < readableId.length; index += 1) {
    hash ^= readableId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return {
    id:
      readableId.length <= 255
        ? readableId
        : `legacy:${outcome}:${(hash >>> 0).toString(16).padStart(8, '0')}`,
    actionKey,
    category: categoryForLegacyAction(actionKey),
    label: actionKey.slice(0, 200),
    outcome,
    source: 'legacy' as const,
    planFingerprint: 'legacy',
  };
}

export function createEmptyPlanProgress(buildId: string): PlanProgress {
  return planProgressSchema.parse({
    schemaVersion: 2,
    buildId,
    objectives: [],
    history: [],
  });
}

export function migratePlanProgress(raw: unknown): PlanProgress {
  const current = planProgressSchema.safeParse(raw);
  if (current.success) return current.data;

  const legacy = legacyProgressSchema.safeParse(raw);
  if (!legacy.success) throw new Error('Stored plan progress is invalid');

  const completed = new Set(legacy.data.completedActionIds);
  const objectiveKeys = [
    ...legacy.data.completedActionIds,
    ...legacy.data.dismissedRecommendationIds.filter((id) => !completed.has(id)),
  ];
  return planProgressSchema.parse({
    schemaVersion: 2,
    buildId: legacy.data.buildId,
    objectives: objectiveKeys.map((actionKey) =>
      legacyObjective(actionKey, completed.has(actionKey) ? 'completed' : 'skipped'),
    ),
    history: [
      ...legacy.data.completedActionIds.map((actionKey) =>
        legacyEvent(actionKey, 'completed'),
      ),
      ...legacy.data.dismissedRecommendationIds.map((actionKey) =>
        legacyEvent(actionKey, 'skipped'),
      ),
    ],
    ...(legacy.data.reconciledThroughLevel === undefined
      ? {}
      : { reconciledThroughLevel: legacy.data.reconciledThroughLevel }),
    ...(legacy.data.acknowledgedDatasetVersion === undefined
      ? {}
      : { acknowledgedDatasetVersion: legacy.data.acknowledgedDatasetVersion }),
  });
}
