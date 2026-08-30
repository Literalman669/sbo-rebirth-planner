import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { CharacterProfile } from '../../domain/build/model';
import type { DraftPersistenceStatus } from '../../domain/planner/state';
import {
  createGuestBuildStore,
  type GuestBuildListResult,
  type GuestBuildStore,
} from '../../infrastructure/storage/guestBuildStore';
import { useDataset } from './DatasetProvider';
import {
  BuildDraftContext,
  type BuildDraftContextValue,
} from './BuildDraftContext';

const defaultStore = createGuestBuildStore();

function createEmptyProfile(datasetVersion: string): CharacterProfile {
  return {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    level: 1,
    maxFloor: 1,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion,
    accessPreferences: {
      activeEvent: false,
      gamepass: false,
      badge: false,
      limited: false,
    },
  };
}

type BuildDraftProviderProps = PropsWithChildren<{
  store?: GuestBuildStore;
}>;

export function BuildDraftProvider({
  children,
  store = defaultStore,
}: BuildDraftProviderProps) {
  const { snapshot } = useDataset();
  const [draft, setDraft] = useState(() =>
    createEmptyProfile(snapshot.version),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasActiveDraft, setHasActiveDraft] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [savedBuilds, setSavedBuilds] = useState<GuestBuildListResult[]>([]);
  const [persistenceStatus, setPersistenceStatus] =
    useState<DraftPersistenceStatus>('idle');
  const [cloudPersistenceStatus, setCloudPersistenceStatus] = useState<
    'sync-queued' | 'synced' | 'error' | null
  >(null);
  const [canUndo, setCanUndo] = useState(false);
  const draftRef = useRef(draft);
  const hydratedRef = useRef(false);
  const activeDraftRef = useRef(false);
  const undoStackRef = useRef<CharacterProfile[]>([]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    let active = true;

    void Promise.all([store.loadDraft(), store.listBuilds()])
      .then(([storedDraft, storedBuilds]) => {
        if (active) setSavedBuilds(storedBuilds);
        if (active && storedDraft) {
          draftRef.current = storedDraft;
          activeDraftRef.current = true;
          setDraft(storedDraft);
          setHasActiveDraft(true);
          setPersistenceStatus('saved-local');
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setPersistenceStatus('error');
          setStorageError(
            error instanceof Error ? error.message : 'Draft storage failed',
          );
        }
      })
      .finally(() => {
        if (active) {
          hydratedRef.current = true;
          setIsHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, [store]);

  useEffect(() => {
    if (!isHydrated || !hasActiveDraft) return;

    setPersistenceStatus('saving');
    const timeout = window.setTimeout(() => {
      void store
        .saveDraft(draft)
        .then(() => {
          setStorageError(null);
          setPersistenceStatus('saved-local');
        })
        .catch((error: unknown) => {
          setPersistenceStatus('error');
          setStorageError(
            error instanceof Error ? error.message : 'Draft storage failed',
          );
        });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [draft, hasActiveDraft, isHydrated, store]);

  useEffect(
    () => () => {
      if (hydratedRef.current && activeDraftRef.current) {
        void store.saveDraft(draftRef.current).catch(() => undefined);
      }
    },
    [store],
  );

  const updateDraft = useCallback((
    patch: Partial<CharacterProfile>,
    options: { recordUndo?: boolean } = {},
  ) => {
    const current = draftRef.current;
    const next = { ...current, ...patch };
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    if (options.recordUndo !== false) {
      undoStackRef.current = [...undoStackRef.current, current].slice(-10);
      setCanUndo(true);
    }
    draftRef.current = next;
    setDraft(next);
    activeDraftRef.current = true;
    setHasActiveDraft(true);
    setStorageError(null);
    setCloudPersistenceStatus(null);
    setPersistenceStatus('saving');
  }, []);

  const replaceDraft = useCallback((profile: CharacterProfile) => {
    undoStackRef.current = [];
    setCanUndo(false);
    draftRef.current = profile;
    activeDraftRef.current = true;
    setDraft(profile);
    setHasActiveDraft(true);
    setCloudPersistenceStatus(null);
    setPersistenceStatus('saving');
  }, []);

  const undoLastChange = useCallback(() => {
    const previous = undoStackRef.current.at(-1);
    if (!previous) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    draftRef.current = previous;
    activeDraftRef.current = true;
    setDraft(previous);
    setHasActiveDraft(true);
    setCanUndo(undoStackRef.current.length > 0);
    setStorageError(null);
    setCloudPersistenceStatus(null);
    setPersistenceStatus('saving');
  }, []);

  const saveNamedBuild = useCallback(
    async (name: string, overrides?: Partial<CharacterProfile>) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Build name is required');
      const savedBuild = {
        ...draftRef.current,
        ...overrides,
        id: crypto.randomUUID(),
        name: trimmedName,
      };
      await store.saveBuild(savedBuild);
      setSavedBuilds(await store.listBuilds());
      return savedBuild;
    },
    [store],
  );

  const loadSavedBuild = useCallback((profile: CharacterProfile) => {
    undoStackRef.current = [];
    setCanUndo(false);
    draftRef.current = profile;
    activeDraftRef.current = true;
    setDraft(profile);
    setHasActiveDraft(true);
    setCloudPersistenceStatus(null);
    setPersistenceStatus('saving');
  }, []);

  const deleteSavedBuild = useCallback(
    async (id: string) => {
      await store.deleteBuild(id);
      setSavedBuilds(await store.listBuilds());
    },
    [store],
  );

  const resetDraft = useCallback(async () => {
    const nextDraft = createEmptyProfile(snapshot.version);
    draftRef.current = nextDraft;
    activeDraftRef.current = false;
    setDraft(nextDraft);
    setHasActiveDraft(false);
    undoStackRef.current = [];
    setCanUndo(false);
    setCloudPersistenceStatus(null);
    setPersistenceStatus('idle');
    await store.clearDraft();
  }, [snapshot.version, store]);

  const value = useMemo<BuildDraftContextValue>(
    () => ({
      draft,
      updateDraft,
      replaceDraft,
      saveNamedBuild,
      resetDraft,
      isHydrated,
      hasActiveDraft,
      storageError,
      savedBuilds,
      loadSavedBuild,
      deleteSavedBuild,
      persistenceStatus: cloudPersistenceStatus ?? persistenceStatus,
      canUndo,
      undoLastChange,
      setCloudPersistenceStatus,
    }),
    [
      draft,
      hasActiveDraft,
      isHydrated,
      deleteSavedBuild,
      canUndo,
      cloudPersistenceStatus,
      loadSavedBuild,
      persistenceStatus,
      replaceDraft,
      resetDraft,
      saveNamedBuild,
      savedBuilds,
      storageError,
      updateDraft,
      undoLastChange,
      setCloudPersistenceStatus,
    ],
  );

  return (
    <BuildDraftContext.Provider value={value}>
      {children}
    </BuildDraftContext.Provider>
  );
}
