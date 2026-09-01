import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type {
  PlannerPreferences,
  PlanProgress,
} from '../../domain/planner/state';
import {
  createEmptyPlanProgress,
  planProgressSchema,
} from '../../domain/progress/schema';
import { DEFAULT_PLANNER_PREFERENCES } from '../../domain/planner/stateSchema';
import {
  createGuestBuildStore,
  type GuestBuildStore,
} from '../../infrastructure/storage/guestBuildStore';
import { useBuildDraft } from './BuildDraftContext';
import {
  PlannerStateContext,
  type PlanProgressPatch,
  type PlannerStateContextValue,
} from './PlannerStateContext';

const defaultStore = createGuestBuildStore();

type PlannerStateProviderProps = PropsWithChildren<{
  store?: GuestBuildStore;
}>;

export function PlannerStateProvider({
  children,
  store = defaultStore,
}: PlannerStateProviderProps) {
  const { draft, isHydrated: isDraftHydrated } = useBuildDraft();
  const [preferences, setPreferences] = useState<PlannerPreferences>(() => ({
    ...DEFAULT_PLANNER_PREFERENCES,
  }));
  const [progress, setProgress] = useState<PlanProgress>(() =>
    createEmptyPlanProgress(draft.id),
  );
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [progressBuildId, setProgressBuildId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const preferencesRef = useRef(preferences);
  const progressRef = useRef(progress);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    let active = true;
    void store
      .loadPreferences()
      .then((stored) => {
        if (!active) return;
        preferencesRef.current = stored;
        setPreferences(stored);
      })
      .catch((error: unknown) => {
        if (active) {
          setStorageError(
            error instanceof Error
              ? error.message
              : 'Planner preference storage failed',
          );
        }
      })
      .finally(() => {
        if (active) setPreferencesHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [store]);

  useEffect(() => {
    if (!isDraftHydrated) {
      setProgressBuildId(null);
      return;
    }
    let active = true;
    const buildId = draft.id;
    setProgressBuildId(null);
    const empty = createEmptyPlanProgress(buildId);
    progressRef.current = empty;
    setProgress(empty);
    void store
      .loadPlanProgress(buildId)
      .then((stored) => {
        if (!active) return;
        const next = stored ?? createEmptyPlanProgress(buildId);
        progressRef.current = next;
        setProgress(next);
      })
      .catch((error: unknown) => {
        if (active) {
          setStorageError(
            error instanceof Error ? error.message : 'Plan progress storage failed',
          );
        }
      })
      .finally(() => {
        if (active) setProgressBuildId(buildId);
      });
    return () => {
      active = false;
    };
  }, [draft.id, isDraftHydrated, store]);

  const updatePreferences = useCallback(
    (patch: Partial<PlannerPreferences>) => {
      const next: PlannerPreferences = {
        ...preferencesRef.current,
        ...patch,
        schemaVersion: 1,
      };
      preferencesRef.current = next;
      setPreferences(next);
      setStorageError(null);
      void store.savePreferences(next).catch((error: unknown) => {
        setStorageError(
          error instanceof Error
            ? error.message
            : 'Planner preference storage failed',
        );
      });
    },
    [store],
  );

  const loadProgressForBuild = useCallback(
    async (buildId: string) =>
      (await store.loadPlanProgress(buildId)) ?? createEmptyPlanProgress(buildId),
    [store],
  );

  const saveProgressForBuild = useCallback(
    async (nextProgress: PlanProgress) => {
      const valid = planProgressSchema.parse(nextProgress);
      if (valid.buildId === draft.id) {
        progressRef.current = valid;
        setProgress(valid);
      }
      setStorageError(null);
      try {
        await store.savePlanProgress(valid);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Plan progress storage failed';
        setStorageError(message);
        throw error;
      }
    },
    [draft.id, store],
  );

  const resetProgressForBuild = useCallback(
    async (buildId: string) => {
      const empty = createEmptyPlanProgress(buildId);
      if (buildId === draft.id) {
        progressRef.current = empty;
        setProgress(empty);
      }
      setStorageError(null);
      try {
        await store.deletePlanProgress(buildId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Plan progress storage failed';
        setStorageError(message);
        throw error;
      }
    },
    [draft.id, store],
  );

  const updateProgress = useCallback(
    (
      update: PlanProgressPatch | ((current: PlanProgress) => PlanProgress),
    ) => {
      const current = progressRef.current;
      const candidate =
        typeof update === 'function'
          ? update(current)
          : { ...current, ...update };
      const next = planProgressSchema.parse({
        ...candidate,
        schemaVersion: 2,
        buildId: draft.id,
      });
      progressRef.current = next;
      setProgress(next);
      void saveProgressForBuild(next).catch(() => undefined);
    },
    [draft.id, saveProgressForBuild],
  );

  const resetProgress = useCallback(async () => {
    await resetProgressForBuild(draft.id);
  }, [draft.id, resetProgressForBuild]);

  const value = useMemo<PlannerStateContextValue>(
    () => ({
      preferences,
      updatePreferences,
      progress,
      updateProgress,
      loadProgressForBuild,
      saveProgressForBuild,
      resetProgressForBuild,
      resetProgress,
      isHydrated:
        isDraftHydrated &&
        preferencesHydrated &&
        progressBuildId === draft.id,
      storageError,
    }),
    [
      draft.id,
      isDraftHydrated,
      preferences,
      preferencesHydrated,
      progress,
      progressBuildId,
      loadProgressForBuild,
      resetProgress,
      resetProgressForBuild,
      saveProgressForBuild,
      storageError,
      updatePreferences,
      updateProgress,
    ],
  );

  return (
    <PlannerStateContext.Provider value={value}>
      {children}
    </PlannerStateContext.Provider>
  );
}
