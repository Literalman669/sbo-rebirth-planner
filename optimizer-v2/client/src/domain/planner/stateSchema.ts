import { z } from 'zod';
import type { PlannerPreferences, PlanProgress } from './state';

const uniqueIds = (ids: string[]) => new Set(ids).size === ids.length;

const persistedIdSchema = z.string().trim().min(1).max(255);

export const plannerPreferencesSchema = z
  .object({
    schemaVersion: z.literal(1),
    mode: z.enum(['beginner', 'detailed']),
    density: z.enum(['comfortable', 'compact']),
    showAllLevels: z.boolean(),
    compactWeaponPathsAfterFirstUse: z.boolean(),
  })
  .strict();

const uniqueIdListSchema = z
  .array(persistedIdSchema)
  .refine(uniqueIds, 'IDs must be unique');

export const planProgressSchema = z
  .object({
    schemaVersion: z.literal(1),
    buildId: persistedIdSchema,
    completedActionIds: uniqueIdListSchema,
    dismissedRecommendationIds: uniqueIdListSchema,
    reconciledThroughLevel: z.number().int().min(1).max(10_000).optional(),
    acknowledgedDatasetVersion: persistedIdSchema.optional(),
  })
  .strict();

export const DEFAULT_PLANNER_PREFERENCES = Object.freeze({
  schemaVersion: 1,
  mode: 'beginner',
  density: 'comfortable',
  showAllLevels: false,
  compactWeaponPathsAfterFirstUse: false,
}) satisfies Readonly<PlannerPreferences>;

export function migratePlannerPreferences(raw: unknown): PlannerPreferences {
  if (raw === undefined || raw === null) return { ...DEFAULT_PLANNER_PREFERENCES };
  const parsed = plannerPreferencesSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Stored planner preferences are invalid');
  return parsed.data;
}

export function migratePlanProgress(raw: unknown): PlanProgress {
  const parsed = planProgressSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Stored plan progress is invalid');
  return {
    ...parsed.data,
    completedActionIds: [...parsed.data.completedActionIds],
    dismissedRecommendationIds: [...parsed.data.dismissedRecommendationIds],
  };
}
