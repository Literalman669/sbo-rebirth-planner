import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { BuildDraftProvider } from '../../app/providers/BuildDraftProvider';
import {
  DatasetContext,
  DatasetProvider,
  type DatasetContextValue,
} from '../../app/providers/DatasetProvider';
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
  options: {
    saved?: CharacterProfile;
    named?: CharacterProfile[];
    snapshot?: DatasetSnapshot;
    testOnlySnapshot?: DatasetSnapshot;
    historicalSnapshots?: readonly DatasetSnapshot[];
  } = {},
) {
  const store = createGuestBuildStore({
    databaseName: `planner-route-${crypto.randomUUID()}`,
  });
  if (options.saved) await store.saveDraft(options.saved);
  for (const namedBuild of options.named ?? []) {
    await store.saveBuild(namedBuild);
  }
  const router = createMemoryRouter(
    createAppRoutes(<App release={release} source="bundled" />),
    { initialEntries: [path] },
  );

  const planner = (
    <BuildDraftProvider store={store}>
      <RouterProvider router={router} />
    </BuildDraftProvider>
  );
  const testOnlyDataset: DatasetContextValue | undefined =
    options.testOnlySnapshot
      ? {
          snapshot: options.testOnlySnapshot,
          source: 'bundled',
          getSnapshot: async (version) =>
            version === options.testOnlySnapshot?.version
              ? options.testOnlySnapshot
              : null,
        }
      : undefined;

  const view = render(
    testOnlyDataset ? (
      <DatasetContext.Provider value={testOnlyDataset}>
        {planner}
      </DatasetContext.Provider>
    ) : (
      <DatasetProvider
        snapshot={options.snapshot}
        historicalSnapshots={options.historicalSnapshots}
      >
        {planner}
      </DatasetProvider>
    ),
  );

  return { router, store, unmount: view.unmount };
}

describe('planner routes', () => {
  it('shows Resume Build only when an active draft was restored', async () => {
    await renderRoute('/');
    expect(await screen.findByRole('button', { name: 'Create Build' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Resume Build' })).not.toBeInTheDocument();

    await renderRoute('/', { saved: savedDraft() });
    expect(await screen.findByRole('button', { name: 'Resume Build' })).toBeVisible();
  });

  it('loads and deletes named builds from Home through the provider', async () => {
    const user = userEvent.setup();
    const namedBuild = { ...savedDraft(), id: 'named-build', name: 'Floor 2 Route' };
    await renderRoute('/', { named: [namedBuild] });

    expect(await screen.findByText('Floor 2 Route')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Load Floor 2 Route' }));
    expect(
      await screen.findByRole('heading', {
        name: 'Tell us where your adventurer stands.',
      }),
    ).toBeVisible();
    expect(screen.getByLabelText('Current Level')).toHaveValue(8);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Delete Floor 2 Route' }));
    await waitFor(() =>
      expect(screen.queryByText('Floor 2 Route')).not.toBeInTheDocument(),
    );
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
    expect(screen.getByText('Available 3 · Invested 0 · Unspent 3')).toBeVisible();
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

  it('validates historical equipment only after its exact dataset resolves', async () => {
    const historicalDraft = {
      ...savedDraft(),
      datasetVersion: bootstrapRelease.version,
      equipped: {},
    };
    const { router } = await renderRoute('/results', {
      saved: historicalDraft,
      historicalSnapshots: [bootstrapRelease],
    });

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

  it('blocks Character Continue and focuses an invalid level', async () => {
    const user = userEvent.setup();
    const { router } = await renderRoute('/character', { saved: savedDraft() });
    const level = await screen.findByLabelText('Current Level');
    await waitFor(() => expect(level).toHaveValue(8));

    await user.clear(level);
    await user.type(level, '0');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(router.state.location.pathname).toBe('/character');
    expect(level).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a whole-number level from 1 to 10000.',
    );
  });

  it('blocks Character Continue and focuses an invalid floor', async () => {
    const user = userEvent.setup();
    const { router } = await renderRoute('/character');
    const floor = await screen.findByLabelText('Highest Unlocked Floor');

    await user.clear(floor);
    await user.type(floor, '20');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(router.state.location.pathname).toBe('/character');
    expect(floor).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a whole-number floor from 1 to 19.',
    );
  });

  it.each(['-1', '1.5', 'not-a-number', '10001'])(
    'keeps the prior Weapon Skill after invalid final text %s',
    async (invalidValue) => {
      const user = userEvent.setup();
      const { router, store, unmount } = await renderRoute('/character', {
        saved: savedDraft(),
      });
      await screen.findByRole('heading', {
        name: 'Tell us where your adventurer stands.',
      });
      await user.click(screen.getByText('Improve accuracy'));
      const weaponSkill = screen.getByLabelText('Weapon Skill');

      expect(weaponSkill).toHaveValue('5');
      await user.clear(weaponSkill);
      await user.type(weaponSkill, invalidValue);
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(router.state.location.pathname).toBe('/character');
      expect(weaponSkill).toHaveFocus();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Weapon Skill must be a whole number from 0 to 10000, or left blank.',
      );
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      unmount();
      await waitFor(async () => {
        expect((await store.loadDraft())?.weaponSkill).toBe(5);
      });
    },
  );

  it('keeps valid Weapon Skill text local until Continue', async () => {
    const user = userEvent.setup();
    const { store, unmount } = await renderRoute('/character', {
      saved: savedDraft(),
    });
    await screen.findByRole('heading', {
      name: 'Tell us where your adventurer stands.',
    });
    await user.click(screen.getByText('Improve accuracy'));
    const weaponSkill = screen.getByLabelText('Weapon Skill');

    await user.clear(weaponSkill);
    await user.type(weaponSkill, '1000');
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    unmount();

    await waitFor(async () => {
      expect((await store.loadDraft())?.weaponSkill).toBe(5);
    });
  });

  it.each([
    ['', undefined],
    ['   ', undefined],
    ['0', 0],
    ['10000', 10000],
  ] as const)(
    'commits optional Weapon Skill value %j only on Continue',
    async (value, expected) => {
      const user = userEvent.setup();
      const { router, store, unmount } = await renderRoute('/character', {
        saved: savedDraft(),
      });
      await screen.findByRole('heading', {
        name: 'Tell us where your adventurer stands.',
      });
      await user.click(screen.getByText('Improve accuracy'));
      const weaponSkill = screen.getByLabelText('Weapon Skill');

      await user.clear(weaponSkill);
      if (value) await user.type(weaponSkill, value);
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(router.state.location.pathname).toBe('/stats');
      unmount();
      await waitFor(async () => {
        expect((await store.loadDraft())?.weaponSkill).toBe(expected);
      });
    },
  );

  it('blocks Stats Continue for each out-of-range or fractional stat', async () => {
    for (const invalidValue of ['-1', '1.5', '501']) {
      const user = userEvent.setup();
      const { router } = await renderRoute('/stats');
      const strength = await screen.findByLabelText('STR');

      await user.clear(strength);
      await user.type(strength, invalidValue);
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(router.state.location.pathname).toBe('/stats');
      expect(strength).toHaveFocus();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'STR must be a whole number from 0 to 500.',
      );
      cleanup();
    }
  });

  it('blocks Stats Continue when a stat input is cleared', async () => {
    const user = userEvent.setup();
    const { router } = await renderRoute('/stats');
    const strength = await screen.findByLabelText('STR');

    await user.clear(strength);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(router.state.location.pathname).toBe('/stats');
    expect(strength).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'STR must be a whole number from 0 to 500.',
    );
  });

  it('blocks Stats Continue when invested points exceed the budget', async () => {
    const user = userEvent.setup();
    const { router } = await renderRoute('/stats');
    const strength = await screen.findByLabelText('STR');

    await user.clear(strength);
    await user.type(strength, '4');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(router.state.location.pathname).toBe('/stats');
    expect(strength).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invested stats exceed the available point budget by 1.',
    );
  });

  it('blocks Stats Continue when fewer than thirty stat slots remain', async () => {
    const user = userEvent.setup();
    const { router } = await renderRoute('/stats', {
      saved: {
        ...savedDraft(),
        level: 834,
        stats: { str: 500, def: 500, agi: 500, vit: 500, luk: 500 },
      },
    });

    await screen.findByRole('heading', { name: 'Stats' });
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(router.state.location.pathname).toBe('/stats');
    expect(screen.getByLabelText('STR')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Current unspent points and the next ten levels require 32 open stat slots, but only 0 remain.',
    );
  });

  it('allows an under-budget profile and promises an actionable allocation', async () => {
    const user = userEvent.setup();
    const { router } = await renderRoute('/stats');

    expect(
      await screen.findByText(
        '3 points remain unspent. Results will tell you exactly where to put them.',
      ),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(router.state.location.pathname).toBe('/equipment');
  });

  it('uses the verified provider point rate for budget feedback', async () => {
    const fourPointSnapshot = {
      ...bootstrapRelease,
      version: 'four-points-per-level',
      pointsPerLevel: 4,
    } as unknown as DatasetSnapshot;

    await renderRoute('/stats', { testOnlySnapshot: fourPointSnapshot });

    expect(
      await screen.findByText('Available 4 · Invested 0 · Unspent 4'),
    ).toBeVisible();
    expect(
      screen.getByText(
        '4 points remain unspent. Results will tell you exactly where to put them.',
      ),
    ).toBeVisible();
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
