import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { CharacterProfile } from '../../domain/build/model';
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
  const draftRef = useRef(draft);
  const hydratedRef = useRef(false);
  const activeDraftRef = useRef(false);

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
        }
      })
      .catch((error: unknown) => {
        if (active) {
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

    const timeout = window.setTimeout(() => {
      void store.saveDraft(draft).catch((error: unknown) => {
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
        void store.saveDraft(draftRef.current);
      }
    },
    [store],
  );

  const updateDraft = useCallback((patch: Partial<CharacterProfile>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      draftRef.current = next;
      return next;
    });
    activeDraftRef.current = true;
    setHasActiveDraft(true);
  }, []);

  const replaceDraft = useCallback((profile: CharacterProfile) => {
    draftRef.current = profile;
    activeDraftRef.current = true;
    setDraft(profile);
    setHasActiveDraft(true);
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
    draftRef.current = profile;
    activeDraftRef.current = true;
    setDraft(profile);
    setHasActiveDraft(true);
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
    }),
    [
      draft,
      hasActiveDraft,
      isHydrated,
      deleteSavedBuild,
      loadSavedBuild,
      replaceDraft,
      resetDraft,
      saveNamedBuild,
      savedBuilds,
      storageError,
      updateDraft,
    ],
  );

  return (
    <BuildDraftContext.Provider value={value}>
      {children}
    </BuildDraftContext.Provider>
  );
}
