import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { createAppRoutes } from '../../app/router';
import { BuildDraftProvider } from '../../app/providers/BuildDraftProvider';
import { CloudBuildsContext } from '../../app/providers/CloudBuildsContext';
import { DatasetProvider } from '../../app/providers/DatasetProvider';
import { PlannerStateProvider } from '../../app/providers/PlannerStateProvider';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../../domain/build/model';
import type { DatasetSnapshot } from '../../domain/dataset/model';
import type { PlanProgress } from '../../domain/progress/model';
import type { CloudBuildsState } from '../../infrastructure/cloud/useCloudBuilds';
import { createGuestBuildStore } from '../../infrastructure/storage/guestBuildStore';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'active-progress-build',
  name: 'Frontline Progress',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
  equipped: { 'main-hand': 'iron-greatsword', armor: 'fields-warrior' },
  ownedItemIds: [],
  datasetVersion: fallbackRelease.version,
};

async function renderProgress(
  path = '/progress',
  options: {
    savedDatasetVersion?: string;
    historicalSnapshots?: readonly DatasetSnapshot[];
    cloudState?: CloudBuildsState;
    initialProgress?: PlanProgress;
  } = {},
) {
  const store = createGuestBuildStore({
    databaseName: `progress-screen-${crypto.randomUUID()}`,
  });
  await store.saveDraft(profile);
  await store.saveBuild({
    ...profile,
    id: 'saved-progress-build',
    name: 'Saved Progress',
    level: 9,
    datasetVersion: options.savedDatasetVersion ?? fallbackRelease.version,
  });
  if (options.initialProgress) await store.savePlanProgress(options.initialProgress);
  const router = createMemoryRouter(
    createAppRoutes(
      <App
        release={{
          version: fallbackRelease.version,
          formulaSetVersion: fallbackRelease.formulaSetVersion,
          sourceSummary: 'Verified release',
          publishedAtMicros: 0n,
          lastReviewedAt: fallbackRelease.lastReviewedAt,
        }}
        source="bundled"
      />,
    ),
    { initialEntries: [path] },
  );
  const app = (
    <DatasetProvider
      snapshot={fallbackRelease}
      historicalSnapshots={options.historicalSnapshots}
    >
      <BuildDraftProvider store={store}>
        <PlannerStateProvider store={store}>
          <RouterProvider router={router} />
        </PlannerStateProvider>
      </BuildDraftProvider>
    </DatasetProvider>
  );
  render(
    options.cloudState
      ? <CloudBuildsContext.Provider value={options.cloudState}>{app}</CloudBuildsContext.Provider>
      : app,
  );
  return { store, router };
}

describe('ProgressScreen', () => {
  it('opens the active build progress from its dedicated route', async () => {
    await renderProgress();

    expect(
      await screen.findByRole('heading', { name: 'Progress' }),
    ).toBeVisible();
    expect(
      within(screen.getByRole('region', { name: 'Progress build context' }))
        .getByText('Frontline Progress'),
    ).toBeVisible();
    expect(screen.getByRole('region', { name: 'Next move' })).toBeVisible();
  });

  it('inspects a saved build from the query without replacing the active draft', async () => {
    const { store } = await renderProgress(
      '/progress?build=saved-progress-build&source=local',
    );

    expect(
      within(await screen.findByRole('region', { name: 'Progress build context' }))
        .getByText('Saved Progress'),
    ).toBeVisible();
    expect(screen.getByLabelText('View progress for')).toHaveValue(
      'local:saved-progress-build',
    );
    expect((await store.loadDraft())?.id).toBe('active-progress-build');
  });

  it('refuses to calculate a saved build when its exact pinned dataset is unavailable', async () => {
    await renderProgress(
      '/progress?build=saved-progress-build&source=local',
      { savedDatasetVersion: 'historical-progress-v1' },
    );

    expect(
      await screen.findByRole('heading', { name: 'Pinned dataset unavailable' }),
    ).toBeVisible();
    expect(screen.getByText('historical-progress-v1')).toBeVisible();
    expect(screen.queryByRole('region', { name: "Today's route" })).not.toBeInTheDocument();
  });

  it('syncs progress changes for a saved cloud build', async () => {
    const user = userEvent.setup();
    const savePlanProgress = vi.fn(
      async (_progress: PlanProgress) => 'cloud' as const,
    );
    const resetPlanProgress = vi.fn(async (_buildId: string) => 'cloud' as const);
    const cloudState = {
      repository: {
        save: vi.fn(),
        importGuestBuilds: vi.fn(),
        importBuildRecords: vi.fn(),
        retryPending: vi.fn(),
        retryPendingPlannerState: vi.fn(),
        savePlanProgress,
        resetPlanProgress,
        savePreferences: vi.fn(),
        saveInventory: vi.fn(),
        rename: vi.fn(),
        archive: vi.fn(),
        restore: vi.fn(),
        delete: vi.fn(),
      },
      cloudBuilds: [{
        headRevisionId: 'cloud-progress-revision',
        profile: { ...profile, id: 'saved-progress-build', name: 'Saved Progress', level: 9 },
        kind: 'build',
        history: [{
          revisionId: 'cloud-progress-revision',
          createdAt: '2026-09-01T12:00:00.000Z',
          datasetVersion: fallbackRelease.version,
          profile: { ...profile, id: 'saved-progress-build', name: 'Saved Progress', level: 9 },
          kind: 'build',
        }],
      }],
      archivedCloudBuilds: [],
      cloudPlanProgress: [],
      cloudPreferences: null,
      cloudInventory: null,
      isAuthenticated: true,
      isReady: true,
      needsGuestImport: false,
      pendingCount: 0,
      pendingPlannerStateCount: 0,
      legacyPendingCount: 0,
      refreshPending: vi.fn(async () => undefined),
      claimLegacyPending: vi.fn(async () => undefined),
      createShare: vi.fn(),
      revokeShare: vi.fn(),
    } as unknown as CloudBuildsState;
    await renderProgress(
      '/progress?build=saved-progress-build&source=cloud',
      { cloudState },
    );
    await screen.findByRole('heading', { name: 'Progress' });
    savePlanProgress.mockClear();

    await user.click(screen.getByRole('button', { name: 'Show all tasks' }));
    await user.click(screen.getByRole('button', { name: 'Complete Unlock Floor 3' }));

    await waitFor(() => expect(savePlanProgress).toHaveBeenCalled());
    expect(savePlanProgress.mock.calls.at(-1)?.[0]).toMatchObject({
      buildId: 'saved-progress-build',
      objectives: expect.arrayContaining([
        expect.objectContaining({ actionKey: 'floor:unlock:3', status: 'completed' }),
      ]),
    });
    await user.click(screen.getByRole('button', { name: 'Reset progress' }));
    await user.click(screen.getByRole('button', { name: 'Reset permanently' }));
    await waitFor(() => expect(resetPlanProgress).toHaveBeenCalledWith('saved-progress-build'));
  });

  it('keeps capped progress recoverable instead of crashing reconciliation', async () => {
    const user = userEvent.setup();
    const occurredAt = '2026-09-01T12:00:00.000Z';
    const initialProgress: PlanProgress = {
      schemaVersion: 2,
      buildId: profile.id,
      objectives: Array.from({ length: 200 }, (_, index) => ({
        actionKey: `manual:capped:${index}`,
        category: 'manual-objective',
        status: 'pending',
        source: 'manual',
        planFingerprint: 'capped-plan',
        updatedAt: occurredAt,
      })),
      history: Array.from({ length: 1_000 }, (_, index) => ({
        id: `capped-event-${index}`,
        actionKey: `manual:history:${index}`,
        category: 'manual-objective',
        label: `History ${index}`,
        outcome: 'completed',
        source: 'manual',
        planFingerprint: 'capped-plan',
        occurredAt,
      })),
      currentPlanFingerprint: 'capped-plan',
    };
    await renderProgress('/progress', { initialProgress });

    expect(
      await screen.findByRole('heading', { name: 'Progress limit reached' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Export build backup' })).toHaveAttribute(
      'href',
      '/builds',
    );
    await user.click(screen.getByRole('button', { name: 'Reset progress' }));
    await user.click(screen.getByRole('button', { name: 'Reset permanently' }));
    expect(await screen.findByRole('heading', { name: 'Progress' })).toBeVisible();
  });

  it('tracks Col and manual progress through the focused dashboard sections', async () => {
    const user = userEvent.setup();
    const { store } = await renderProgress();
    await screen.findByRole('heading', { name: 'Progress' });

    expect(screen.getByRole('region', { name: "Today's route" })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Shopping plan' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Current floor' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Journey history' })).toBeVisible();

    await user.clear(screen.getByLabelText('Current Col'));
    await user.type(screen.getByLabelText('Current Col'), '10000');
    await user.click(screen.getByRole('button', { name: 'Save Col balance' }));
    await user.click(screen.getByRole('button', { name: 'Show all tasks' }));
    await user.type(
      screen.getByLabelText('Notes for Unlock Floor 3'),
      'Clear with the guild',
    );
    await user.click(
      screen.getByRole('button', { name: 'Save note for Unlock Floor 3' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Complete Unlock Floor 3' }),
    );
    await user.click(screen.getByRole('button', { name: 'Show journey history' }));

    expect(screen.getByText(/Affordable now|Need .* more Col/)).toBeVisible();
    expect(screen.getByText('Unlock Floor 3 completed')).toBeVisible();
    expect(screen.getByText('Clear with the guild')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Reopen Unlock Floor 3' }),
    );
    expect(await screen.findByText('Unlock Floor 3 reopened')).toBeVisible();
    await waitFor(async () => {
      const stored = await store.loadPlanProgress(profile.id);
      expect(stored?.wallet?.balance).toBe(10_000);
      expect(stored?.objectives).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actionKey: 'floor:unlock:3',
            status: 'pending',
          }),
        ]),
      );
      expect(stored?.history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actionKey: 'floor:unlock:3',
            outcome: 'completed',
            source: 'manual',
          }),
          expect.objectContaining({
            actionKey: 'floor:unlock:3',
            outcome: 'reopened',
            source: 'manual',
          }),
        ]),
      );
    });
  });
});
