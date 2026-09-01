import type { PlanProgress } from '../domain/progress/model';

export function progressFixture(
  buildId: string,
  completedActionIds: readonly string[] = [],
  skippedActionIds: readonly string[] = [],
): PlanProgress {
  return {
    schemaVersion: 2,
    buildId,
    objectives: [
      ...completedActionIds.map((actionKey) => ({
        actionKey,
        category: 'manual-objective' as const,
        status: 'completed' as const,
        source: 'legacy' as const,
        planFingerprint: 'legacy',
      })),
      ...skippedActionIds.map((actionKey) => ({
        actionKey,
        category: 'manual-objective' as const,
        status: 'skipped' as const,
        source: 'legacy' as const,
        planFingerprint: 'legacy',
      })),
    ],
    history: [],
  };
}
