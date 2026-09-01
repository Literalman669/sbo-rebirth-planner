import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { BuildDraftProvider } from '../../app/providers/BuildDraftProvider';
import { DatasetProvider } from '../../app/providers/DatasetProvider';
import { createAppRoutes } from '../../app/router';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../../domain/build/model';
import { createGuestBuildStore } from '../../infrastructure/storage/guestBuildStore';

function profile(
  id: string,
  name: string,
  path: CharacterProfile['weaponPath'] = 'melee',
): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name,
    level: 8,
    maxFloor: 2,
    weaponPath: path,
    goal: 'balanced',
    stats: { str: 10, def: 4, agi: 3, vit: 7, luk: 0 },
    equipped: {
      'main-hand': path === 'melee' ? 'fists' : 'iron-greatsword',
      armor: 'fields-warrior',
    },
    ownedItemIds: [],
    datasetVersion: fallbackRelease.version,
  };
}

async function renderPresets(path = '/builds/presets') {
  const store = createGuestBuildStore({
    databaseName: `build-presets-${crypto.randomUUID()}`,
  });
  await store.saveBuild(profile('source-build', 'Source Route'));
  await store.saveBuild(profile('personal-preset', 'Personal Route'), {
    kind: 'personal-preset',
  });
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
    <DatasetProvider snapshot={fallbackRelease}>
      <BuildDraftProvider store={store}>
        <RouterProvider router={router} />
      </BuildDraftProvider>
    </DatasetProvider>,
  );
  return { router, store };
}

describe('BuildPresetsScreen', () => {
  it('separates six curated starts from personal presets and applies a curated baseline', async () => {
    const user = userEvent.setup();
    const { router, store } = await renderPresets();

    expect(
      await screen.findByRole('heading', { name: 'Build Presets' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Verified curated starts' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Your personal presets' }),
    ).toBeVisible();
    expect(screen.getAllByRole('button', { name: /^Use Balanced/ })).toHaveLength(6);
    expect(screen.getByText('Personal Route')).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Use Balanced Melee Start' }),
    );

    expect(router.state.location.pathname).toBe('/character');
    expect(await screen.findByLabelText('Current Level')).toHaveValue(1);
    expect(screen.getByRole('radio', { name: 'Melee' })).toBeChecked();
    await waitFor(async () => {
      const draft = await store.loadDraft();
      expect(draft).toMatchObject({
        level: 1,
        weaponPath: 'melee',
        datasetVersion: fallbackRelease.version,
      });
    });
  });

  it('applies a personal preset as a new draft while preserving the preset record', async () => {
    const user = userEvent.setup();
    const { router, store } = await renderPresets();

    await screen.findByRole('heading', { name: 'Build Presets' });
    await user.click(
      screen.getByRole('button', { name: 'Use Personal Route' }),
    );

    expect(router.state.location.pathname).toBe('/character');
    expect(await screen.findByLabelText('Current Level')).toHaveValue(8);
    await waitFor(async () => {
      const draft = await store.loadDraft();
      expect(draft?.id).not.toBe('personal-preset');
      expect(draft?.name).toBe('Personal Route copy');
    });
    const preset = (await store.listBuilds()).find(
      (row) => row.ok && row.value.profile.id === 'personal-preset',
    );
    expect(preset).toMatchObject({
      ok: true,
      value: {
        kind: 'personal-preset',
        profile: { id: 'personal-preset', name: 'Personal Route' },
      },
    });
  });

  it('creates a personal preset from a normal build in the library', async () => {
    const user = userEvent.setup();
    const { store } = await renderPresets('/builds');
    await screen.findByRole('heading', { name: 'Your Builds' });

    await user.click(
      screen.getByRole('button', { name: 'Save Source Route as preset' }),
    );

    await waitFor(async () => {
      const presets = (await store.listBuilds()).flatMap((row) =>
        row.ok && row.value.kind === 'personal-preset' ? [row.value] : [],
      );
      expect(presets.map((record) => record.profile.name)).toEqual(
        expect.arrayContaining(['Source Route preset', 'Personal Route']),
      );
    });
  });
});
