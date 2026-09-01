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

function createEmptyProgress(buildId: string): PlanProgress {
  return {
    schemaVersion: 1,
    buildId,
    completedActionIds: [],
    dismissedRecommendationIds: [],
  };
}

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
    createEmptyProgress(draft.id),
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
    const empty = createEmptyProgress(buildId);
    progressRef.current = empty;
    setProgress(empty);
    void store
      .loadPlanProgress(buildId)
      .then((stored) => {
        if (!active) return;
        const next = stored ?? createEmptyProgress(buildId);
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

  const updateProgress = useCallback(
    (
      update: PlanProgressPatch | ((current: PlanProgress) => PlanProgress),
    ) => {
      const current = progressRef.current;
      const candidate =
        typeof update === 'function'
          ? update(current)
          : { ...current, ...update };
      const next: PlanProgress = {
        ...candidate,
        schemaVersion: 1,
        buildId: draft.id,
      };
      progressRef.current = next;
      setProgress(next);
      setStorageError(null);
      void store.savePlanProgress(next).catch((error: unknown) => {
        setStorageError(
          error instanceof Error ? error.message : 'Plan progress storage failed',
        );
      });
    },
    [draft.id, store],
  );

  const resetProgress = useCallback(async () => {
    const empty = createEmptyProgress(draft.id);
    progressRef.current = empty;
    setProgress(empty);
    setStorageError(null);
    try {
      await store.deletePlanProgress(draft.id);
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : 'Plan progress storage failed',
      );
    }
  }, [draft.id, store]);

  const value = useMemo<PlannerStateContextValue>(
    () => ({
      preferences,
      updatePreferences,
      progress,
      updateProgress,
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
      resetProgress,
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
