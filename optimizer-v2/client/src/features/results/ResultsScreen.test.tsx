import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { BuildDraftProvider } from '../../app/providers/BuildDraftProvider';
import { DatasetProvider } from '../../app/providers/DatasetProvider';
import { createAppRoutes } from '../../app/router';
import type { CharacterProfile } from '../../domain/build/model';
import { createGuestBuildStore } from '../../infrastructure/storage/guestBuildStore';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import type { DatasetSnapshot } from '../../domain/dataset/model';

const release = {
  version: 'bootstrap-0',
  formulaSetVersion: 'sbor-stats-v1' as const,
  sourceSummary: 'Bundled fallback',
  publishedAtMicros: 0n,
  lastReviewedAt: '2026-08-29',
};

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'results-build',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  weaponSkill: 5,
  stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
  equipped: {
    'main-hand': 'iron-greatsword',
    armor: 'beginner-armor',
  },
  ownedItemIds: ['steel-greatsword'],
  datasetVersion: 'bootstrap-0',
};

async function renderResults(snapshot?: DatasetSnapshot) {
  const store = createGuestBuildStore({
    databaseName: `results-screen-${crypto.randomUUID()}`,
  });
  await store.saveDraft(profile);
  const router = createMemoryRouter(
    createAppRoutes(<App release={release} source="bundled" />),
    { initialEntries: ['/results'] },
  );

  render(
    <DatasetProvider
      snapshot={snapshot}
      historicalSnapshots={[bootstrapRelease]}
    >
      <BuildDraftProvider store={store}>
        <RouterProvider router={router} />
      </BuildDraftProvider>
    </DatasetProvider>,
  );
  return store;
}

describe('ResultsScreen', () => {
  it('recovers when a saved historical release arrives after the first lookup', async () => {
    const store = createGuestBuildStore({
      databaseName: `results-late-history-${crypto.randomUUID()}`,
    });
    await store.saveDraft(profile);
    const router = createMemoryRouter(
      createAppRoutes(<App release={release} source="bundled" />),
      { initialEntries: ['/results'] },
    );
    const current = {
      ...bootstrapRelease,
      version: '2026.08.29.2',
      equipment: bootstrapRelease.equipment.filter(
        (item) => item.id !== 'steel-greatsword',
      ),
    };
    const tree = (historicalSnapshots: readonly DatasetSnapshot[]) => (
      <DatasetProvider
        snapshot={current}
        historicalSnapshots={historicalSnapshots}
      >
        <BuildDraftProvider store={store}>
          <RouterProvider router={router} />
        </BuildDraftProvider>
      </DatasetProvider>
    );
    const view = render(tree([]));
    expect(
      await screen.findByRole('heading', {
        name: 'Dataset bootstrap-0 is unavailable.',
      }),
    ).toBeVisible();

    view.rerender(tree([bootstrapRelease]));

    expect(await screen.findByText('Equip Steel Greatsword now')).toBeVisible();
  });

  it('renders one prioritized action and the thirty-point plan', async () => {
    await renderResults();

    expect(
      await screen.findByRole('heading', {
        name: 'Your next ten levels, made clear.',
      }),
    ).toBeVisible();
    expect(screen.getAllByTestId('immediate-action')).toHaveLength(1);
    expect(screen.getByText('Equip Steel Greatsword now')).toBeVisible();
    expect(screen.getByText('30 points')).toBeVisible();
    expect(screen.getByText('Level +5')).toBeVisible();
    expect(screen.getByText('Level +10')).toBeVisible();
  });

  it('shows no more than three sourced upgrade targets', async () => {
    await renderResults();
    await screen.findByRole('heading', {
      name: 'Your next ten levels, made clear.',
    });

    const upgradeRegion = screen.getByRole('region', { name: 'Next upgrades' });
    const rows = within(upgradeRegion).getAllByTestId('upgrade-target');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(3);
    for (const link of within(upgradeRegion).getAllByRole('link', {
      name: 'View wiki source',
    })) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    }
  });

  it('keeps reasoning collapsed and provides edit routes', async () => {
    await renderResults();
    await screen.findByRole('heading', {
      name: 'Your next ten levels, made clear.',
    });

    expect(screen.getByText('Why this plan')).toBeVisible();
    expect(
      screen.getByText(/balanced weighting guided/i),
    ).not.toBeVisible();
    expect(screen.getByRole('link', { name: 'Edit Character' })).toHaveAttribute(
      'href',
      '/character',
    );
    expect(screen.getByRole('link', { name: 'Edit Stats' })).toHaveAttribute(
      'href',
      '/stats',
    );
    expect(screen.getByRole('link', { name: 'Edit Equipment' })).toHaveAttribute(
      'href',
      '/equipment',
    );
  });

  it('persists a recalculated dataset only when the player saves the build', async () => {
    const user = userEvent.setup();
    const store = await renderResults({
      ...bootstrapRelease,
      version: '2026.08.29.2',
      publishedAt: '2026-08-29T12:00:00.000Z',
      equipment: bootstrapRelease.equipment.filter(
        (item) => item.id !== 'steel-greatsword',
      ),
    });
    await screen.findByRole('heading', {
      name: 'Your next ten levels, made clear.',
    });

    const button = screen.getByRole('button', {
      name: 'Recalculate with dataset 2026.08.29.2',
    });
    expect(screen.getByText('Equip Steel Greatsword now')).toBeVisible();
    await user.click(button);

    expect(button).not.toBeInTheDocument();
    expect(screen.queryByText('Equip Steel Greatsword now')).not.toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    await waitFor(async () => {
      expect((await store.loadDraft())?.datasetVersion).toBe('bootstrap-0');
    });

    await user.click(screen.getByRole('button', { name: 'Save Build' }));
    await user.type(screen.getByLabelText('Build Name'), 'Recalculated Route');
    const saveForm = screen.getByLabelText('Build Name').closest('form')!;
    await user.click(within(saveForm).getByRole('button', { name: 'Save Build' }));
    await waitFor(async () => {
      const saved = (await store.listBuilds()).find((result) => result.ok);
      expect(saved?.value.profile.datasetVersion).toBe('2026.08.29.2');
    });
  });
});
