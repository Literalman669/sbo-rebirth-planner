import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../../domain/build/model';
import type { SavedBuildKind } from '../../domain/build/record';
import { buildDatasetReleaseIndex } from '../../domain/datasetImpact/releaseIndex';
import {
  buildImpactKeyFingerprint,
  fingerprintBuildInputs,
} from '../../domain/datasetImpact/fingerprint';
import { optimizeBuild } from '../../domain/optimizer/optimizeBuild';
import type { BuildRepository } from '../../infrastructure/cloud/buildRepository';
import type { DatasetReviewStore } from '../../infrastructure/storage/datasetReviewStore';
import { BuildDraftContext, type BuildDraftContextValue } from './BuildDraftContext';
import { CloudBuildsContext } from './CloudBuildsContext';
import { DatasetProvider } from './DatasetProvider';
import { DatasetUpdatesProvider } from './DatasetUpdatesProvider';
import { useDatasetUpdates } from './DatasetUpdatesContext';

const pinned = {
  ...structuredClone(fallbackRelease),
  version: '2026.08.30.1',
  publishedAt: '2026-08-30T00:00:00.000Z',
  lastReviewedAt: '2026-08-30',
};
const target = {
  ...structuredClone(fallbackRelease),
  version: '2026.09.01.1',
  publishedAt: '2026-09-01T00:00:00.000Z',
  lastReviewedAt: '2026-09-01',
};
const [pinnedDescriptor, targetDescriptor] = buildDatasetReleaseIndex([
  { snapshot: pinned, availability: 'cached' },
  { snapshot: target, availability: 'live' },
]);

function profile(id: string, name = id): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name,
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped: {
      'main-hand': 'iron-greatsword',
      armor: 'beginner-armor',
    },
    ownedItemIds: [],
    datasetVersion: pinned.version,
  };
}

function localRecord(
  value: CharacterProfile,
  kind: SavedBuildKind = 'build',
  archivedAt?: string,
) {
  return {
    ok: true as const,
    value: {
      profile: value,
      kind,
      headRevisionId: `${value.id}-local-head`,
      createdAt: '2026-08-30T10:00:00.000Z',
      updatedAt: '2026-08-31T10:00:00.000Z',
      ...(archivedAt ? { archivedAt } : {}),
    },
  };
}

function cloudRecord(
  value: CharacterProfile,
  kind: SavedBuildKind = 'build',
  archivedAt?: string,
) {
  return {
    profile: value,
    kind,
    headRevisionId: `${value.id}-cloud-head`,
    ...(archivedAt ? { archivedAt } : {}),
    history: [{
      revisionId: `${value.id}-cloud-head`,
      createdAt: '2026-08-31T09:00:00.000Z',
      datasetVersion: value.datasetVersion,
      profile: value,
      kind,
    }],
  };
}

function receipt(value: CharacterProfile, reviewedAt: string) {
  const inputFingerprint = fingerprintBuildInputs(value);
  return {
    schemaVersion: 1 as const,
    buildId: value.id,
    inputFingerprint,
    pinnedDatasetVersion: pinned.version,
    targetDatasetVersion: target.version,
    impactKeyFingerprint: buildImpactKeyFingerprint({
      inputFingerprint,
      pinned: pinnedDescriptor!,
      target: targetDescriptor!,
    }),
    reportFingerprint: `report-${value.id}`,
    status: 'reviewed' as const,
    reviewedAt,
  };
}

function draftValue(
  active: CharacterProfile,
  savedBuilds: BuildDraftContextValue['savedBuilds'],
  overrides: Partial<BuildDraftContextValue> = {},
): BuildDraftContextValue {
  return {
    draft: active,
    updateDraft: vi.fn(),
    replaceDraft: vi.fn(),
    saveNamedBuild: vi.fn(),
    saveBuild: vi.fn(),
    renameSavedBuild: vi.fn(),
    duplicateSavedBuild: vi.fn(),
    setBuildArchived: vi.fn(),
    savePersonalPreset: vi.fn(),
    loadSavedBuildHistory: vi.fn(),
    restoreSavedBuildRevision: vi.fn(),
    exportSavedBuildRecords: vi.fn(),
    importSavedBuildPlan: vi.fn(),
    quarantinedRecords: [],
    exportQuarantinedRecord: vi.fn(),
    deleteQuarantinedRecord: vi.fn(),
    resetDraft: vi.fn(),
    isHydrated: true,
    hasActiveDraft: true,
    storageError: null,
    savedBuilds,
    loadSavedBuild: vi.fn(),
    deleteSavedBuild: vi.fn(),
    refreshSavedBuilds: vi.fn(),
    persistenceStatus: 'saved-local',
    canUndo: false,
    undoLastChange: vi.fn(),
    setCloudPersistenceStatus: vi.fn(),
    ...overrides,
  };
}

function repository(overrides: Partial<BuildRepository> = {}) {
  return {
    save: vi.fn(),
    importGuestBuilds: vi.fn(),
    importBuildRecords: vi.fn(),
    retryPending: vi.fn(),
    retryPendingPlannerState: vi.fn(),
    retryAllPending: vi.fn(),
    savePlanProgress: vi.fn(),
    resetPlanProgress: vi.fn(),
    savePreferences: vi.fn(),
    saveInventory: vi.fn(),
    saveDatasetReview: vi.fn(async () => 'cloud' as const),
    deleteDatasetReview: vi.fn(),
    applyDatasetVersionUpdate: vi.fn(),
    applyDatasetUpdate: vi.fn(),
    rename: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as unknown as BuildRepository;
}

function testWrapper(options: {
  active?: CharacterProfile;
  saved?: BuildDraftContextValue['savedBuilds'];
  cloudActive?: ReturnType<typeof cloudRecord>[];
  cloudArchived?: ReturnType<typeof cloudRecord>[];
  cloudReceipts?: ReturnType<typeof receipt>[];
  localReceipts?: ReturnType<typeof receipt>[];
  draftOverrides?: Partial<BuildDraftContextValue>;
  repository?: BuildRepository;
  optimize?: typeof optimizeBuild;
}) {
  const active = options.active ?? profile('active', 'Active route');
  const localReceipts = [...(options.localReceipts ?? [])];
  const receiptStore: DatasetReviewStore = {
    list: vi.fn(async () => [...localReceipts]),
    load: vi.fn(async (buildId) =>
      localReceipts.find((candidate) => candidate.buildId === buildId) ?? null,
    ),
    save: vi.fn(async (next) => {
      const index = localReceipts.findIndex((candidate) =>
        candidate.buildId === next.buildId,
      );
      if (index >= 0) localReceipts[index] = next;
      else localReceipts.push(next);
    }),
    delete: vi.fn(async (buildId) => {
      const index = localReceipts.findIndex((candidate) =>
        candidate.buildId === buildId,
      );
      if (index >= 0) localReceipts.splice(index, 1);
    }),
  };
  const draft = draftValue(
    active,
    options.saved ?? [],
    options.draftOverrides,
  );
  const cloudRepository = options.repository ?? repository();

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <DatasetProvider snapshot={target} historicalSnapshots={[pinned]}>
        <BuildDraftContext.Provider value={draft}>
          <CloudBuildsContext.Provider value={{
            repository: cloudRepository,
            cloudBuilds: options.cloudActive ?? [],
            archivedCloudBuilds: options.cloudArchived ?? [],
            cloudPlanProgress: [],
            cloudPreferences: null,
            cloudInventory: null,
            cloudDatasetReviews: options.cloudReceipts ?? [],
            isAuthenticated: true,
            isReady: true,
            needsGuestImport: false,
            pendingCount: 0,
            pendingPlannerStateCount: 0,
            legacyPendingCount: 0,
            refreshPending: vi.fn(),
            claimLegacyPending: vi.fn(),
            createShare: vi.fn(),
            revokeShare: vi.fn(),
          }}>
            <DatasetUpdatesProvider
              receiptStore={receiptStore}
              optimize={options.optimize}
              now={() => '2026-09-02T10:00:00.000Z'}
            >
              {children}
            </DatasetUpdatesProvider>
          </CloudBuildsContext.Provider>
        </BuildDraftContext.Provider>
      </DatasetProvider>
    );
  }
  return { Wrapper, draft, receiptStore, cloudRepository };
}

describe('DatasetUpdatesProvider', () => {
  it('counts 250 candidates without optimizing and computes one cached report twice only', async () => {
    const optimize = vi.fn(optimizeBuild);
    const saved = Array.from({ length: 250 }, (_, index) =>
      localRecord(profile(`stress-${String(index).padStart(3, '0')}`)),
    );
    const { Wrapper } = testWrapper({
      saved,
      draftOverrides: { hasActiveDraft: false },
      optimize,
    });
    const { result } = renderHook(() => useDatasetUpdates(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.candidates).toHaveLength(250));
    expect(result.current.unreviewedCount).toBe(250);
    expect(optimize).not.toHaveBeenCalled();

    await result.current.loadReport('stress-249');
    expect(optimize).toHaveBeenCalledTimes(2);
    await result.current.loadReport('stress-249');
    expect(optimize).toHaveBeenCalledTimes(2);
  });

  it('does not share a build-specific report across identical build inputs', async () => {
    const first = profile('identical-a', 'Identical A');
    const second = profile('identical-b', 'Identical B');
    const optimize = vi.fn(optimizeBuild);
    const { Wrapper } = testWrapper({
      saved: [localRecord(first), localRecord(second)],
      draftOverrides: { hasActiveDraft: false },
      optimize,
    });
    const { result } = renderHook(() => useDatasetUpdates(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    await expect(result.current.loadReport('identical-a')).resolves.toMatchObject({
      status: 'ready',
      report: { buildId: 'identical-a' },
    });
    await expect(result.current.loadReport('identical-b')).resolves.toMatchObject({
      status: 'ready',
      report: { buildId: 'identical-b' },
    });
    expect(optimize).toHaveBeenCalledTimes(4);
  });

  it('hydrates every owned source once, merges receipts, and does no eager optimization', async () => {
    const saved = profile('saved', 'Saved route');
    const preset = profile('preset', 'Preset route');
    const cloudOnly = profile('cloud', 'Cloud route');
    const optimize = vi.fn(optimizeBuild);
    const { Wrapper, draft } = testWrapper({
      saved: [
        localRecord(saved),
        localRecord(
          preset,
          'personal-preset',
          '2026-09-01T00:00:00.000Z',
        ),
      ],
      cloudActive: [cloudRecord(saved), cloudRecord(cloudOnly)],
      cloudReceipts: [receipt(saved, '2026-09-02T09:00:00.000Z')],
      localReceipts: [
        receipt(saved, '2026-09-01T09:00:00.000Z'),
        receipt(preset, '2026-09-02T08:00:00.000Z'),
      ],
      optimize,
    });

    const { result } = renderHook(() => useDatasetUpdates(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.candidates.map((candidate) => ({
      id: candidate.id,
      source: candidate.source,
      status: candidate.status,
    }))).toEqual([
      { id: 'active', source: 'active', status: 'unreviewed' },
      { id: 'cloud', source: 'cloud', status: 'unreviewed' },
      { id: 'preset', source: 'local', status: 'reviewed-pinned' },
      { id: 'saved', source: 'local+cloud', status: 'reviewed-pinned' },
    ]);
    expect(result.current.unreviewedCount).toBe(2);
    expect(optimize).not.toHaveBeenCalled();
    expect(draft.replaceDraft).not.toHaveBeenCalled();

    await expect(result.current.loadReport('active')).resolves.toMatchObject({
      status: 'ready',
      report: { buildId: 'active' },
    });
    expect(optimize).toHaveBeenCalledTimes(2);
    const loaded = await result.current.loadReport('active');
    if (loaded.status !== 'ready') throw new Error('report did not load');
    await expect(result.current.loadReleaseStepPlan(loaded.report, 0))
      .resolves.toMatchObject({ status: 'unchanged' });
    await result.current.loadReleaseStepPlan(loaded.report, 0);
    expect(optimize).toHaveBeenCalledTimes(4);
    await expect(result.current.loadPreview(loaded.report, 'current'))
      .resolves.toMatchObject({ datasetVersion: target.version });
    await result.current.loadPreview(loaded.report, 'current');
    expect(optimize).toHaveBeenCalledTimes(5);
    expect(draft.replaceDraft).not.toHaveBeenCalled();
  });

  it('keeps a blocked build visible when its pinned snapshot is unavailable', async () => {
    const active = { ...profile('missing'), datasetVersion: 'missing-release' };
    const optimize = vi.fn(optimizeBuild);
    const { Wrapper } = testWrapper({ active, optimize });
    const { result } = renderHook(() => useDatasetUpdates(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.candidates[0]).toMatchObject({
      id: 'missing',
      status: 'blocked',
    });
    await expect(result.current.loadReport('missing')).resolves.toEqual({
      status: 'blocked',
      reason: 'Pinned dataset missing-release is unavailable.',
    });
    expect(optimize).not.toHaveBeenCalled();
  });

  it('keeps a build pinned without mutating its draft and updates the notice count', async () => {
    const { Wrapper, draft, receiptStore } = testWrapper({});
    const { result } = renderHook(() => useDatasetUpdates(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    const loaded = await result.current.loadReport('active');
    if (loaded.status !== 'ready') throw new Error('report did not load');

    await result.current.keepPinned(loaded.report);

    await waitFor(() => expect(result.current.unreviewedCount).toBe(0));
    expect(receiptStore.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reviewed', buildId: 'active' }),
    );
    expect(draft.replaceDraft).not.toHaveBeenCalled();
  });

  it('revalidates and replaces an active draft only after a committed update', async () => {
    const active = profile('active');
    const updated = { ...active, datasetVersion: target.version };
    const cloudRepository = repository({
      applyDatasetUpdate: vi.fn(async () => ({
        profile: updated,
        revisionId: 'dataset-update-revision',
        location: 'local' as const,
      })),
    });
    const { Wrapper, draft } = testWrapper({ active, repository: cloudRepository });
    const { result } = renderHook(() => useDatasetUpdates(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    const loaded = await result.current.loadReport('active');
    if (loaded.status !== 'ready') throw new Error('report did not load');

    await result.current.applyUpdate(loaded.report);

    expect(cloudRepository.applyDatasetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: active,
        expectedInputFingerprint: loaded.report.inputFingerprint,
        targetDatasetVersion: target.version,
      }),
      { source: 'active' },
    );
    expect(draft.replaceDraft).toHaveBeenCalledWith(updated);
    expect(draft.refreshSavedBuilds).toHaveBeenCalledOnce();
  });
});
