import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import { createGuestBuildStore } from '../../infrastructure/storage/guestBuildStore';
import { BuildDraftProvider } from './BuildDraftProvider';
import { useBuildDraft } from './BuildDraftContext';
import { DatasetProvider } from './DatasetProvider';
import { usePlannerState } from './PlannerStateContext';
import { PlannerStateProvider } from './PlannerStateProvider';

function profile(id: string, level = 12): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name: `Build ${id}`,
    level,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 20, def: 4, agi: 4, vit: 8, luk: 0 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion: 'bootstrap-0',
  };
}

function Consumer() {
  const { draft, replaceDraft } = useBuildDraft();
  const {
    preferences,
    updatePreferences,
    progress,
    updateProgress,
    isHydrated,
  } = usePlannerState();
  if (!isHydrated) return <p>Loading planner state</p>;
  return (
    <div>
      <p>Draft {draft.id}</p>
      <p>Density {preferences.density}</p>
      <p>
        Completed{' '}
        {progress.objectives
          .filter((objective) => objective.status === 'completed')
          .map((objective) => objective.actionKey)
          .join(',') || 'none'}
      </p>
      <button
        type="button"
        onClick={() => updatePreferences({ density: 'compact' })}
      >
        Use compact density
      </button>
      <button
        type="button"
        onClick={() =>
          updateProgress({
            objectives: [
              {
                actionKey: 'level-13',
                category: 'level-milestone',
                status: 'completed',
                source: 'manual',
                planFingerprint: 'plan-test',
                updatedAt: '2026-09-01T12:00:00.000Z',
              },
            ],
          })
        }
      >
        Complete level 13
      </button>
      <button
        type="button"
        onClick={() => replaceDraft(profile('other-build', 20))}
      >
        Load other build
      </button>
    </div>
  );
}

function renderProviders(
  store: ReturnType<typeof createGuestBuildStore>,
) {
  return render(
    <DatasetProvider>
      <BuildDraftProvider store={store}>
        <PlannerStateProvider store={store}>
          <Consumer />
        </PlannerStateProvider>
      </BuildDraftProvider>
    </DatasetProvider>,
  );
}

describe('PlannerStateProvider', () => {
  it('does not change the draft when only display density changes', async () => {
    const store = createGuestBuildStore({
      databaseName: `planner-state-separation-${crypto.randomUUID()}`,
    });
    await store.saveDraft(profile('active-build'));
    const before = await store.loadDraft();
    renderProviders(store);
    await screen.findByText('Density comfortable');

    fireEvent.click(screen.getByRole('button', { name: 'Use compact density' }));

    expect(await screen.findByText('Density compact')).toBeVisible();
    await waitFor(async () => {
      expect((await store.loadPreferences()).density).toBe('compact');
    });
    expect(await store.loadDraft()).toEqual(before);
  });

  it('loads and persists progress for the active build only', async () => {
    const store = createGuestBuildStore({
      databaseName: `planner-progress-separation-${crypto.randomUUID()}`,
    });
    await store.saveDraft(profile('active-build'));
    await store.savePlanProgress({
      schemaVersion: 2,
      buildId: 'other-build',
      objectives: [
        {
          actionKey: 'level-21',
          category: 'level-milestone',
          status: 'completed',
          source: 'manual',
          planFingerprint: 'plan-test',
          updatedAt: '2026-09-01T12:00:00.000Z',
        },
      ],
      history: [],
    });
    renderProviders(store);
    await screen.findByText('Completed none');

    fireEvent.click(screen.getByRole('button', { name: 'Complete level 13' }));

    await screen.findByText('Completed level-13');
    await waitFor(async () => {
      expect(await store.loadPlanProgress('active-build')).toMatchObject({
        objectives: [{ actionKey: 'level-13', status: 'completed' }],
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load other build' }));
    expect(await screen.findByText('Draft other-build')).toBeVisible();
    expect(await screen.findByText('Completed level-21')).toBeVisible();
  });
});
