import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { BuildDraftProvider } from '../../app/providers/BuildDraftProvider';
import { DatasetProvider } from '../../app/providers/DatasetProvider';
import { createAppRoutes } from '../../app/router';
import type { CharacterProfile } from '../../domain/build/model';
import { createGuestBuildStore } from '../../infrastructure/storage/guestBuildStore';

const release = {
  version: 'bootstrap-0',
  formulaSetVersion: 'sbor-stats-v1' as const,
  sourceSummary: 'Bundled fallback',
  publishedAtMicros: 0n,
  lastReviewedAt: '2026-08-29',
};

function savedDraft(): CharacterProfile {
  return {
    schemaVersion: 2,
    id: 'saved-draft',
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    weaponSkill: 5,
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion: 'bootstrap-0',
  };
}

async function renderRoute(
  path: string,
  options: { saved?: CharacterProfile } = {},
) {
  const store = createGuestBuildStore({
    databaseName: `planner-route-${crypto.randomUUID()}`,
  });
  if (options.saved) await store.saveDraft(options.saved);
  const router = createMemoryRouter(
    createAppRoutes(<App release={release} source="fallback" />),
    { initialEntries: [path] },
  );

  render(
    <DatasetProvider>
      <BuildDraftProvider store={store}>
        <RouterProvider router={router} />
      </BuildDraftProvider>
    </DatasetProvider>,
  );

  return { router, store };
}

describe('planner routes', () => {
  it('shows Resume Build only when an active draft was restored', async () => {
    await renderRoute('/');
    expect(await screen.findByRole('button', { name: 'Create Build' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Resume Build' })).not.toBeInTheDocument();

    await renderRoute('/', { saved: savedDraft() });
    expect(await screen.findByRole('button', { name: 'Resume Build' })).toBeVisible();
  });

  it('keeps Character inputs focused on the first setup decision', async () => {
    await renderRoute('/character');

    expect(
      await screen.findByRole('heading', {
        name: 'Tell us where your adventurer stands.',
      }),
    ).toBeVisible();
    for (const weapon of [
      'Two-Handed',
      'One-Handed',
      'Rapier',
      'Dagger',
      'Dual Wield',
      'Melee',
    ]) {
      expect(screen.getByRole('radio', { name: weapon })).toBeVisible();
    }
    expect(screen.getByLabelText('Optimization Goal')).toHaveValue('balanced');
    expect(screen.getByText('Improve accuracy')).toBeVisible();
    expect(screen.getByLabelText('Weapon Skill')).not.toBeVisible();
  });

  it('shows all five invested stats and advisory point feedback', async () => {
    await renderRoute('/stats');

    expect(await screen.findByRole('heading', { name: 'Stats' })).toBeVisible();
    for (const stat of ['STR', 'DEF', 'AGI', 'VIT', 'LUK']) {
      expect(screen.getByLabelText(stat)).toBeVisible();
    }
    expect(screen.getByText('Expected 3 · Entered 0 · Difference 3')).toBeVisible();
  });

  it('filters equipment to the selected weapon path and exposes required slots', async () => {
    await renderRoute('/equipment');

    expect(await screen.findByRole('heading', { name: 'Equipment' })).toBeVisible();
    expect(screen.getByLabelText('Main-hand weapon')).toBeVisible();
    expect(screen.getByLabelText('Armor')).toBeVisible();
    expect(screen.getByRole('option', { name: 'Iron Greatsword' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Iron Rapier' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Off-hand weapon')).not.toBeInTheDocument();
  });

  it('redirects an incomplete direct Results visit to Equipment', async () => {
    const { router } = await renderRoute('/results');

    expect(await screen.findByRole('heading', { name: 'Equipment' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/equipment');
  });

  it('moves focus to the next screen heading after Continue', async () => {
    const user = userEvent.setup();
    await renderRoute('/character');
    await screen.findByRole('heading', {
      name: 'Tell us where your adventurer stands.',
    });

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const statsHeading = await screen.findByRole('heading', { name: 'Stats' });
    await waitFor(() => expect(statsHeading).toHaveFocus());
  });

  it('focuses the first missing required equipment control', async () => {
    const user = userEvent.setup();
    await renderRoute('/equipment');
    await screen.findByRole('heading', { name: 'Equipment' });

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByLabelText('Main-hand weapon')).toHaveFocus();
    expect(screen.getByText('Choose your main-hand weapon.')).toBeVisible();
  });
});
