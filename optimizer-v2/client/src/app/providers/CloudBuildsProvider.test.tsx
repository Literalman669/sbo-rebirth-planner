import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import { CloudBuildsProvider } from './CloudBuildsProvider';
import { BuildDraftContext } from './BuildDraftContext';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'active-build',
  level: 20,
  maxFloor: 3,
  weaponPath: 'two-handed',
  goal: 'balanced',
  stats: { str: 20, def: 10, agi: 12, vit: 8, luk: 5 },
  equipped: {},
  ownedItemIds: [],
  datasetVersion: 'bootstrap-0',
};

const cloud = vi.hoisted(() => ({
  save: vi.fn(async () => ({
    revisionId: 'revision-1',
    location: 'cloud' as const,
  })),
  refreshPending: vi.fn(async () => undefined),
  needsGuestImport: false,
  cloudBuilds: [] as Array<{ profile: CharacterProfile; headRevisionId: string }>,
}));

vi.mock('../../infrastructure/cloud/useCloudBuilds', () => ({
  useCloudBuilds: () => ({
    repository: {
      save: cloud.save,
      importGuestBuilds: vi.fn(),
      retryPending: vi.fn(),
      restore: vi.fn(),
      delete: vi.fn(),
    },
    cloudBuilds: cloud.cloudBuilds,
    isAuthenticated: true,
    isReady: true,
    needsGuestImport: cloud.needsGuestImport,
    pendingCount: 0,
    refreshPending: cloud.refreshPending,
  }),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  cloud.needsGuestImport = false;
  cloud.cloudBuilds = [];
});

describe('CloudBuildsProvider', () => {
  it('sends a hydrated active draft through the revision repository after debounce', async () => {
    vi.useFakeTimers();
    cloud.cloudBuilds = [{ profile, headRevisionId: 'revision-0' }];
    render(
      <BuildDraftContext.Provider
        value={{
          draft: profile,
          updateDraft: vi.fn(),
          replaceDraft: vi.fn(),
          saveNamedBuild: vi.fn(),
          resetDraft: vi.fn(),
          isHydrated: true,
          hasActiveDraft: true,
          storageError: null,
          savedBuilds: [],
          loadSavedBuild: vi.fn(),
          deleteSavedBuild: vi.fn(),
        }}
      >
        <CloudBuildsProvider>
          <p>Planner</p>
        </CloudBuildsProvider>
      </BuildDraftContext.Provider>,
    );

    await act(async () => vi.advanceTimersByTimeAsync(751));

    expect(cloud.save).toHaveBeenCalledWith(profile);
    expect(cloud.refreshPending).toHaveBeenCalledOnce();
  });

  it('does not upload an active guest draft that was not enrolled for cloud sync', async () => {
    vi.useFakeTimers();
    render(
      <BuildDraftContext.Provider
        value={{
          draft: profile,
          updateDraft: vi.fn(),
          replaceDraft: vi.fn(),
          saveNamedBuild: vi.fn(),
          resetDraft: vi.fn(),
          isHydrated: true,
          hasActiveDraft: true,
          storageError: null,
          savedBuilds: [],
          loadSavedBuild: vi.fn(),
          deleteSavedBuild: vi.fn(),
        }}
      >
        <CloudBuildsProvider>
          <p>Planner</p>
        </CloudBuildsProvider>
      </BuildDraftContext.Provider>,
    );

    await act(async () => vi.advanceTimersByTimeAsync(1_000));

    expect(cloud.save).not.toHaveBeenCalled();
  });

  it('pauses active-draft sync until the guest import decision is complete', async () => {
    vi.useFakeTimers();
    cloud.needsGuestImport = true;
    render(
      <BuildDraftContext.Provider
        value={{
          draft: profile,
          updateDraft: vi.fn(),
          replaceDraft: vi.fn(),
          saveNamedBuild: vi.fn(),
          resetDraft: vi.fn(),
          isHydrated: true,
          hasActiveDraft: true,
          storageError: null,
          savedBuilds: [],
          loadSavedBuild: vi.fn(),
          deleteSavedBuild: vi.fn(),
        }}
      >
        <CloudBuildsProvider>
          <p>Planner</p>
        </CloudBuildsProvider>
      </BuildDraftContext.Provider>,
    );

    await act(async () => vi.advanceTimersByTimeAsync(1_000));

    expect(cloud.save).not.toHaveBeenCalled();
  });
});
