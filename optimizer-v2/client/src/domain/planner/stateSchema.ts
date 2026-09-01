import { z } from 'zod';
import type { PlannerPreferences } from './state';
export {
  createEmptyPlanProgress,
  migratePlanProgress,
  planProgressSchema,
} from '../progress/schema';

export const plannerPreferencesSchema = z
  .object({
    schemaVersion: z.literal(1),
    mode: z.enum(['beginner', 'detailed']),
    density: z.enum(['comfortable', 'compact']),
    showAllLevels: z.boolean(),
    compactWeaponPathsAfterFirstUse: z.boolean(),
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
