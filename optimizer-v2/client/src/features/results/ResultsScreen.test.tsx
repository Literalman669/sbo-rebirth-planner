import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
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
}

describe('ResultsScreen', () => {
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

  it('offers recalculation without silently mutating the saved dataset version', async () => {
    const user = userEvent.setup();
    await renderResults({
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
    expect(profile.datasetVersion).toBe('bootstrap-0');
  });
});
