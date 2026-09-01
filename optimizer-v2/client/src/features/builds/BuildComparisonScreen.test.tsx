import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { BuildDraftProvider } from '../../app/providers/BuildDraftProvider';
import { DatasetProvider } from '../../app/providers/DatasetProvider';
import { createAppRoutes } from '../../app/router';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../../domain/build/model';
import { createGuestBuildStore } from '../../infrastructure/storage/guestBuildStore';

function profile(
  id: string,
  name: string,
  stats: CharacterProfile['stats'],
  overrides: Partial<CharacterProfile> = {},
): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name,
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats,
    equipped: {
      'main-hand': 'iron-greatsword',
      armor: 'fields-warrior',
    },
    ownedItemIds: [],
    datasetVersion: fallbackRelease.version,
    ...overrides,
  };
}

const left = profile('left-build', 'Strength Route', {
  str: 14,
  def: 0,
  agi: 3,
  vit: 7,
  luk: 0,
});
const right = profile('right-build', 'Defense Route', {
  str: 10,
  def: 4,
  agi: 3,
  vit: 7,
  luk: 0,
});

async function renderComparison(
  path = '/builds/compare',
  builds: CharacterProfile[] = [left, right],
) {
  const store = createGuestBuildStore({
    databaseName: `build-comparison-${crypto.randomUUID()}`,
  });
  for (const build of builds) await store.saveBuild(build);
  const router = createMemoryRouter(
    createAppRoutes(
      <App
        release={{
          version: fallbackRelease.version,
          formulaSetVersion: fallbackRelease.formulaSetVersion,
          sourceSummary: fallbackRelease.sourceSummary,
          publishedAtMicros: 0n,
          lastReviewedAt: fallbackRelease.lastReviewedAt,
        }}
        source="bundled"
      />,
    ),
    { initialEntries: [path] },
  );
  render(
    <DatasetProvider
      snapshot={fallbackRelease}
      historicalSnapshots={[bootstrapRelease]}
    >
      <BuildDraftProvider store={store}>
        <RouterProvider router={router} />
      </BuildDraftProvider>
    </DatasetProvider>,
  );
  return { router, store };
}

describe('BuildComparisonScreen', () => {
  it('selects exactly two builds in the URL and renders explicit metric leaders', async () => {
    const user = userEvent.setup();
    const { router } = await renderComparison();
    expect(
      await screen.findByRole('heading', { name: 'Compare Builds' }),
    ).toBeVisible();

    await user.selectOptions(screen.getByLabelText('First build'), left.id);
    await user.selectOptions(screen.getByLabelText('Second build'), right.id);

    expect(router.state.location.pathname).toBe('/builds/compare');
    expect(router.state.location.search).toBe(
      '?left=left-build&right=right-build',
    );
    expect(await screen.findByRole('row', { name: /STR/ })).toHaveTextContent(
      'Higher verified value: First build',
    );
    expect(
      screen.getByRole('row', { name: /Damage per hit/ }),
    ).toHaveTextContent('3.17');
    expect(screen.queryByText(/overall winner/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open Iron Greatsword Wiki' }),
    ).toHaveAttribute(
      'href',
      'https://swordbloxonlinerebirth.fandom.com/wiki/Iron%20Greatsword',
    );
  });

  it('previews historical builds on current data without mutating either saved record', async () => {
    const user = userEvent.setup();
    const historical = profile(
      'historical-build',
      'Historical Route',
      { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
      {
        datasetVersion: bootstrapRelease.version,
        equipped: {
          'main-hand': 'iron-greatsword',
          armor: 'combat-armor',
        },
      },
    );
    const historicalRight = {
      ...right,
      id: 'historical-right',
      name: 'Historical Defense',
      datasetVersion: bootstrapRelease.version,
    };
    const { router, store } = await renderComparison(
      '/builds/compare?left=historical-build&right=historical-right',
      [historical, historicalRight],
    );

    expect(
      await screen.findByText(
        `Equipment is incomplete for dataset ${bootstrapRelease.version}.`,
      ),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', {
        name: `Preview both with dataset ${fallbackRelease.version}`,
      }),
    );
    expect(
      await screen.findByRole('button', {
        name: 'Create draft from Historical Route preview',
      }),
    ).toBeEnabled();
    const storedBefore = (await store.listBuilds()).find(
      (row) => row.ok && row.value.profile.id === historical.id,
    );
    expect(storedBefore).toMatchObject({
      ok: true,
      value: { profile: { datasetVersion: bootstrapRelease.version } },
    });

    await user.click(
      screen.getByRole('button', {
        name: 'Create draft from Historical Route preview',
      }),
    );
    expect(router.state.location.pathname).toBe('/character');
    expect(await screen.findByLabelText('Current Level')).toHaveValue(8);
    await waitFor(async () => {
      const active = await store.loadDraft();
      expect(active?.id).not.toBe(historical.id);
      expect(active?.datasetVersion).toBe(fallbackRelease.version);
    });
    const storedAfter = (await store.listBuilds()).find(
      (row) => row.ok && row.value.profile.id === historical.id,
    );
    expect(storedAfter).toMatchObject({
      ok: true,
      value: { profile: { datasetVersion: bootstrapRelease.version } },
    });
  });

  it('keeps stored stat evidence visible when a historical dataset is unavailable', async () => {
    const missing = { ...left, id: 'missing-dataset', datasetVersion: 'missing-1' };
    await renderComparison(
      '/builds/compare?left=missing-dataset&right=right-build',
      [missing, right],
    );

    expect(
      await screen.findByText('Dataset missing-1 is unavailable.'),
    ).toBeVisible();
    expect(screen.getByRole('row', { name: /STR/ })).toHaveTextContent('14');
    expect(screen.getByRole('row', { name: /Damage per hit/ })).toHaveTextContent(
      'Missing verified data',
    );
  });

  it('redirects the documented legacy route while preserving selections', async () => {
    const { router } = await renderComparison(
      '/compare/builds?left=left-build&right=right-build',
    );

    await screen.findByRole('heading', { name: 'Compare Builds' });
    expect(router.state.location.pathname).toBe('/builds/compare');
    expect(router.state.location.search).toBe(
      '?left=left-build&right=right-build',
    );
  });
});
