import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { CharacterProfile } from '../../domain/build/model';
import {
  createGuestBuildStore,
  type GuestBuildStore,
} from '../../infrastructure/storage/guestBuildStore';
import { useDataset } from './DatasetProvider';

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

export type BuildDraftContextValue = {
  draft: CharacterProfile;
  updateDraft(patch: Partial<CharacterProfile>): void;
  replaceDraft(profile: CharacterProfile): void;
  saveNamedBuild(name: string): Promise<void>;
  resetDraft(): Promise<void>;
  isHydrated: boolean;
  storageError: string | null;
};

type BuildDraftProviderProps = PropsWithChildren<{
  store?: GuestBuildStore;
}>;

const BuildDraftContext = createContext<BuildDraftContextValue | null>(null);

export function BuildDraftProvider({
  children,
  store = defaultStore,
}: BuildDraftProviderProps) {
  const { snapshot } = useDataset();
  const [draft, setDraft] = useState(() =>
    createEmptyProfile(snapshot.version),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const draftRef = useRef(draft);
  const hydratedRef = useRef(false);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    let active = true;

    void store
      .loadDraft()
      .then((storedDraft) => {
        if (active && storedDraft) setDraft(storedDraft);
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
    if (!isHydrated) return;

    const timeout = window.setTimeout(() => {
      void store.saveDraft(draft).catch((error: unknown) => {
        setStorageError(
          error instanceof Error ? error.message : 'Draft storage failed',
        );
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [draft, isHydrated, store]);

  useEffect(
    () => () => {
      if (hydratedRef.current) void store.saveDraft(draftRef.current);
    },
    [store],
  );

  const updateDraft = useCallback((patch: Partial<CharacterProfile>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const replaceDraft = useCallback((profile: CharacterProfile) => {
    setDraft(profile);
  }, []);

  const saveNamedBuild = useCallback(
    async (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Build name is required');
      await store.saveBuild({
        ...draftRef.current,
        id: crypto.randomUUID(),
        name: trimmedName,
      });
    },
    [store],
  );

  const resetDraft = useCallback(async () => {
    const nextDraft = createEmptyProfile(snapshot.version);
    setDraft(nextDraft);
    await store.saveDraft(nextDraft);
  }, [snapshot.version, store]);

  const value = useMemo<BuildDraftContextValue>(
    () => ({
      draft,
      updateDraft,
      replaceDraft,
      saveNamedBuild,
      resetDraft,
      isHydrated,
      storageError,
    }),
    [
      draft,
      isHydrated,
      replaceDraft,
      resetDraft,
      saveNamedBuild,
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

export function useBuildDraft(): BuildDraftContextValue {
  const value = useContext(BuildDraftContext);
  if (!value) {
    throw new Error('useBuildDraft must be used inside BuildDraftProvider');
  }
  return value;
}
