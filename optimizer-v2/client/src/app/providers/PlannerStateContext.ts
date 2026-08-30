import { createContext, useContext } from 'react';
import type {
  PlannerPreferences,
  PlanProgress,
} from '../../domain/planner/state';

export type PlanProgressPatch = Partial<
  Omit<PlanProgress, 'schemaVersion' | 'buildId'>
>;

export type PlannerStateContextValue = {
  preferences: PlannerPreferences;
  updatePreferences(patch: Partial<PlannerPreferences>): void;
  progress: PlanProgress;
  updateProgress(
    update: PlanProgressPatch | ((current: PlanProgress) => PlanProgress),
  ): void;
  resetProgress(): Promise<void>;
  isHydrated: boolean;
  storageError: string | null;
};

export const PlannerStateContext =
  createContext<PlannerStateContextValue | null>(null);

export function usePlannerState(): PlannerStateContextValue {
  const value = useContext(PlannerStateContext);
  if (!value) {
    throw new Error('usePlannerState must be used inside PlannerStateProvider');
  }
  return value;
}

export function useOptionalPlannerState(): PlannerStateContextValue | null {
  return useContext(PlannerStateContext);
}
