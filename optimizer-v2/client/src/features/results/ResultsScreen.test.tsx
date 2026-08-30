import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { BuildDraftProvider } from '../../app/providers/BuildDraftProvider';
import { PlannerStateProvider } from '../../app/providers/PlannerStateProvider';
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

async function renderResults(
  snapshot?: DatasetSnapshot,
  draft: CharacterProfile = profile,
) {
  const store = createGuestBuildStore({
    databaseName: `results-screen-${crypto.randomUUID()}`,
  });
  await store.saveDraft(draft);
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
        <PlannerStateProvider store={store}>
          <RouterProvider router={router} />
        </PlannerStateProvider>
      </BuildDraftProvider>
    </DatasetProvider>,
  );
  return store;
}

describe('ResultsScreen', () => {
  it('persists checklist completion, expands levels, and reconciles to a chosen level', async () => {
    const user = userEvent.setup();
    const store = await renderResults();
    await screen.findByRole('heading', {
      name: 'Your next ten levels, made clear.',
    });

    expect(screen.getByRole('heading', { name: 'Action checklist' })).toBeVisible();
    const completion = screen.getByRole('checkbox', {
      name: /Complete Equip Steel Greatsword/i,
    });
    await user.click(completion);
    await waitFor(async () => {
      expect(await store.loadPlanProgress(profile.id)).toMatchObject({
        completedActionIds: ['equipment:main-hand:steel-greatsword'],
      });
    });

    await user.click(screen.getByRole('button', { name: 'Show all ten levels' }));
    expect(screen.getByText('Level 18')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Advance to Level 10' }));
    await waitFor(async () => {
      expect((await store.loadDraft())?.level).toBe(10);
    });
  });
  it.each([
    [
      'overspent stats',
      { ...profile, stats: { str: 15, def: 0, agi: 3, vit: 7, luk: 0 } },
      'Invested stats exceed the available point budget by 1.',
    ],
    [
      'insufficient stat capacity',
      {
        ...profile,
        level: 834,
        stats: { str: 500, def: 500, agi: 500, vit: 500, luk: 500 },
      },
      'Current unspent points and the next ten levels require 32 open stat slots, but only 0 remain.',
    ],
  ])('shows unavailable without advice for %s', async (_case, draft, explanation) => {
    await renderResults(undefined, draft);

    expect(
      await screen.findByRole('heading', { name: 'Optimization unavailable' }),
    ).toBeVisible();
    expect(screen.getByText(explanation)).toBeVisible();
    expect(screen.queryByTestId('immediate-action')).not.toBeInTheDocument();
    expect(screen.queryByText('30 points')).not.toBeInTheDocument();
  });

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
        (item) =>
          item.id !== 'steel-greatsword' && item.id !== 'iron-greatsword',
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
    expect(
      screen.getByText(
        'This plan recalculates from your current inputs. Saved builds do not change unless you save again.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Equip Steel Greatsword now')).toBeVisible();
    expect(screen.getByText('30 future points')).toBeVisible();
    const table = screen.getByRole('table', { name: 'Next ten levels' });
    expect(within(table).getAllByRole('rowheader')).toHaveLength(3);
    expect(within(table).getByRole('rowheader', { name: 'Level 9' })).toBeVisible();
    expect(within(table).queryByRole('rowheader', { name: 'Level 18' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all ten levels' })).toBeVisible();
    expect(
      screen.getByText(
        'Add this level is new spending for that level; totals are your stats after spending.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('Level +5')).not.toBeInTheDocument();
  });

  it('allocates a new character’s three current points before Levels 2 through 11', async () => {
    const user = userEvent.setup();
    await renderResults(undefined, {
      ...profile,
      level: 1,
      maxFloor: 1,
      weaponPath: 'melee',
      weaponSkill: 1,
      stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
      equipped: {
        'main-hand': 'fists',
        armor: 'beginner-armor',
      },
      ownedItemIds: [],
    });

    const spendNow = await screen.findByRole('region', { name: 'Spend now' });
    expect(within(spendNow).getByText('3 points available now')).toBeVisible();
    const table = screen.getByRole('table', { name: 'Next ten levels' });
    expect(within(table).getByRole('rowheader', { name: 'Level 2' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Show all ten levels' }));
    expect(within(table).getByRole('rowheader', { name: 'Level 11' })).toBeVisible();
  });

  it('does not show an unchanged after-spending comparison when no points are unspent', async () => {
    await renderResults();

    const spendNow = await screen.findByRole('region', { name: 'Spend now' });
    expect(
      within(spendNow).getByText(
        'All 24 earned points are invested. Your next allocation begins at Level 9.',
      ),
    ).toBeVisible();
    expect(within(spendNow).queryByText('After spending')).not.toBeInTheDocument();
  });

  it('turns unspent points into an action and labels unknown-skill targets for confirmation', async () => {
    await renderResults(undefined, {
      ...profile,
      weaponSkill: undefined,
      stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
    });

    const spendNow = await screen.findByRole('region', { name: 'Spend now' });
    expect(within(spendNow).getByText('24 points available now')).toBeVisible();
    expect(screen.queryByText(/plan precision as reduced/i)).not.toBeInTheDocument();
    expect(
      screen.getByText('Requires Weapon Skill 5; confirm in game'),
    ).toBeVisible();
  });

  it('renders combined future level and unknown skill requirements literally', async () => {
    const steelGreatsword = bootstrapRelease.equipment.find(
      (item) => item.id === 'steel-greatsword',
    )!;
    const futureItem = {
      ...steelGreatsword,
      id: 'future-steel-greatsword',
      name: 'Future Steel Greatsword',
      attack: steelGreatsword.attack + 20,
      levelRequirement: 15,
      skillRequirement: 10,
    };

    await renderResults(
      { ...bootstrapRelease, equipment: [...bootstrapRelease.equipment, futureItem] },
      {
        ...profile,
        weaponSkill: undefined,
        stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
      },
    );

    expect(
      await screen.findByText(
        'Requires Level 15 · Requires Weapon Skill 10; confirm in game',
      ),
    ).toBeVisible();
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
      name: 'View item wiki page',
    })) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    }
    expect(within(rows[0]!).getByText('Price')).toBeVisible();
  });

  it('shows a verified price and the exact item page when catalog evidence provides them', async () => {
    const fieldsWarrior = bootstrapRelease.catalog.find(
      (item) => item.id === 'fields-warrior',
    )!;
    const pricedCatalog = bootstrapRelease.catalog.map((item) =>
      item.id === fieldsWarrior.id
        ? {
            ...item,
            sourceUrl:
              'https://swordbloxonlinerebirth.fandom.com/wiki/Fields_Warrior',
            acquisitions: item.acquisitions.map((acquisition) => ({
              ...acquisition,
              cost: 1440,
              currency: 'Col',
              sourceUrl:
                'https://swordbloxonlinerebirth.fandom.com/wiki/Fields_Warrior',
            })),
          }
        : item,
    );

    await renderResults({ ...bootstrapRelease, catalog: pricedCatalog });

    const fieldsRow = (await screen.findByText('Fields Warrior')).closest(
      '[data-testid="upgrade-target"]',
    ) as HTMLElement;
    expect(within(fieldsRow).getByText('1,440 Col')).toBeVisible();
    expect(within(fieldsRow).getByRole('link', { name: 'View item wiki page' })).toHaveAttribute(
      'href',
      'https://swordbloxonlinerebirth.fandom.com/wiki/Fields_Warrior',
    );
  });

  it('loads a named local build directly from the results screen', async () => {
    const user = userEvent.setup();
    const store = createGuestBuildStore({
      databaseName: `results-load-${crypto.randomUUID()}`,
    });
    const named = {
      ...profile,
      id: 'saved-melee-route',
      name: 'Saved Melee Route',
      level: 5,
      weaponPath: 'melee' as const,
      weaponSkill: 1,
      stats: { str: 5, def: 5, agi: 2, vit: 2, luk: 1 },
      equipped: { 'main-hand': 'fists', armor: 'beginner-armor' },
    };
    await store.saveDraft(profile);
    await store.saveBuild(named);
    const router = createMemoryRouter(
      createAppRoutes(<App release={release} source="bundled" />),
      { initialEntries: ['/results'] },
    );
    render(
      <DatasetProvider historicalSnapshots={[bootstrapRelease]}>
        <BuildDraftProvider store={store}>
          <RouterProvider router={router} />
        </BuildDraftProvider>
      </DatasetProvider>,
    );

    await screen.findByRole('heading', { name: 'Your next ten levels, made clear.' });
    await user.click(screen.getByRole('button', { name: 'Load Build' }));
    await user.click(screen.getByRole('button', { name: 'Load Saved Melee Route' }));

    expect(router.state.location.pathname).toBe('/character');
    expect(await screen.findByLabelText('Current Level')).toHaveValue(5);
    expect(screen.getByRole('radio', { name: 'Melee' })).toBeChecked();
  });

  it('keeps reasoning collapsed and provides edit routes', async () => {
    await renderResults();
    await screen.findByRole('heading', {
      name: 'Your next ten levels, made clear.',
    });

    expect(screen.getByText('Why this plan')).toBeVisible();
    expect(
      screen.getByText(
        /strategy policy sbor-policy-v1 applied balanced priorities/i,
      ),
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
