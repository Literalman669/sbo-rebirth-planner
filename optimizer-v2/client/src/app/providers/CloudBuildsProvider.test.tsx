import { act, render } from '@testing-library/react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import { CloudBuildsProvider } from './CloudBuildsProvider';
import { BuildDraftContext } from './BuildDraftContext';
import { PlannerStateContext } from './PlannerStateContext';

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
  legacyPendingCount: 0,
  claimLegacyPending: vi.fn(async () => undefined),
  savePlanProgress: vi.fn(async () => 'cloud' as const),
  savePreferences: vi.fn(async () => 'cloud' as const),
  cloudPlanProgress: [] as Array<{
    schemaVersion: 1;
    buildId: string;
    completedActionIds: string[];
    dismissedRecommendationIds: string[];
  }>,
  cloudPreferences: null as null | {
    schemaVersion: 1;
    mode: 'beginner' | 'detailed';
    density: 'comfortable' | 'compact';
    showAllLevels: boolean;
    compactWeaponPathsAfterFirstUse: boolean;
  },
}));

vi.mock('../../infrastructure/cloud/useCloudBuilds', () => ({
  useCloudBuilds: () => ({
    repository: {
      save: cloud.save,
      importGuestBuilds: vi.fn(),
      retryPending: vi.fn(),
      restore: vi.fn(),
      delete: vi.fn(),
      savePlanProgress: cloud.savePlanProgress,
      savePreferences: cloud.savePreferences,
      retryPendingPlannerState: vi.fn(),
      rename: vi.fn(),
      archive: vi.fn(),
    },
    cloudBuilds: cloud.cloudBuilds,
    archivedCloudBuilds: [],
    cloudPlanProgress: cloud.cloudPlanProgress,
    cloudPreferences: cloud.cloudPreferences,
    isAuthenticated: true,
    isReady: true,
    needsGuestImport: cloud.needsGuestImport,
    pendingCount: 0,
    pendingPlannerStateCount: 0,
    legacyPendingCount: cloud.legacyPendingCount,
    claimLegacyPending: cloud.claimLegacyPending,
    refreshPending: cloud.refreshPending,
  }),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  cloud.needsGuestImport = false;
  cloud.cloudBuilds = [];
  cloud.legacyPendingCount = 0;
  cloud.cloudPlanProgress = [];
  cloud.cloudPreferences = null;
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
          persistenceStatus: 'saved-local',
          canUndo: false,
          undoLastChange: vi.fn(),
          setCloudPersistenceStatus: vi.fn(),
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
          persistenceStatus: 'saved-local',
          canUndo: false,
          undoLastChange: vi.fn(),
          setCloudPersistenceStatus: vi.fn(),
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
          persistenceStatus: 'saved-local',
          canUndo: false,
          undoLastChange: vi.fn(),
          setCloudPersistenceStatus: vi.fn(),
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

  it('asks before assigning a legacy pending revision to the signed-in account', async () => {
    const user = userEvent.setup();
    cloud.legacyPendingCount = 1;
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
          persistenceStatus: 'saved-local',
          canUndo: false,
          undoLastChange: vi.fn(),
          setCloudPersistenceStatus: vi.fn(),
        }}
      >
        <CloudBuildsProvider>
          <p>Planner</p>
        </CloudBuildsProvider>
      </BuildDraftContext.Provider>,
    );

    expect(screen.getByText(/older pending cloud revision/i)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Assign to this account' }));
    expect(cloud.claimLegacyPending).toHaveBeenCalledOnce();
  });

  it('syncs planner preferences and active-build progress without duplicating draft saves', async () => {
    vi.useFakeTimers();
    cloud.cloudBuilds = [{ profile, headRevisionId: 'revision-0' }];
    const setCloudPersistenceStatus = vi.fn();
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
          persistenceStatus: 'saved-local',
          canUndo: false,
          undoLastChange: vi.fn(),
          setCloudPersistenceStatus,
        }}
      >
        <PlannerStateContext.Provider
          value={{
            preferences: {
              schemaVersion: 1,
              mode: 'beginner',
              density: 'comfortable',
              showAllLevels: false,
              compactWeaponPathsAfterFirstUse: false,
            },
            updatePreferences: vi.fn(),
            progress: {
              schemaVersion: 1,
              buildId: profile.id,
              completedActionIds: ['level-21'],
              dismissedRecommendationIds: [],
            },
            updateProgress: vi.fn(),
            resetProgress: vi.fn(),
            isHydrated: true,
            storageError: null,
          }}
        >
          <CloudBuildsProvider>
            <p>Planner</p>
          </CloudBuildsProvider>
        </PlannerStateContext.Provider>
      </BuildDraftContext.Provider>,
    );

    await act(async () => vi.advanceTimersByTimeAsync(751));

    expect(cloud.save).toHaveBeenCalledOnce();
    expect(cloud.savePlanProgress).toHaveBeenCalledOnce();
    expect(cloud.savePreferences).toHaveBeenCalledOnce();
    expect(setCloudPersistenceStatus).toHaveBeenCalledWith('synced');
  });

  it('applies a newly received cloud preference and progress snapshot once', () => {
    cloud.cloudBuilds = [{ profile, headRevisionId: 'revision-0' }];
    cloud.cloudPreferences = {
      schemaVersion: 1,
      mode: 'detailed',
      density: 'compact',
      showAllLevels: true,
      compactWeaponPathsAfterFirstUse: true,
    };
    cloud.cloudPlanProgress = [
      {
        schemaVersion: 1,
        buildId: profile.id,
        completedActionIds: ['level-22'],
        dismissedRecommendationIds: [],
      },
    ];
    const updatePreferences = vi.fn();
    const updateProgress = vi.fn();
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
          persistenceStatus: 'saved-local',
          canUndo: false,
          undoLastChange: vi.fn(),
          setCloudPersistenceStatus: vi.fn(),
        }}
      >
        <PlannerStateContext.Provider
          value={{
            preferences: {
              schemaVersion: 1,
              mode: 'beginner',
              density: 'comfortable',
              showAllLevels: false,
              compactWeaponPathsAfterFirstUse: false,
            },
            updatePreferences,
            progress: {
              schemaVersion: 1,
              buildId: profile.id,
              completedActionIds: [],
              dismissedRecommendationIds: [],
            },
            updateProgress,
            resetProgress: vi.fn(),
            isHydrated: true,
            storageError: null,
          }}
        >
          <CloudBuildsProvider>
            <p>Planner</p>
          </CloudBuildsProvider>
        </PlannerStateContext.Provider>
      </BuildDraftContext.Provider>,
    );

    expect(updatePreferences).toHaveBeenCalledWith(cloud.cloudPreferences);
    expect(updateProgress).toHaveBeenCalledWith(cloud.cloudPlanProgress[0]);
  });
});
