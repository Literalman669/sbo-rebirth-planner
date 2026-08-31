import 'fake-indexeddb/auto';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { BuildDraftProvider } from '../../app/providers/BuildDraftProvider';
import { DatasetProvider } from '../../app/providers/DatasetProvider';
import { InventoryProvider } from '../../app/providers/InventoryProvider';
import { createAppRoutes } from '../../app/router';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../../domain/build/model';
import type { InventoryState } from '../../domain/inventory/state';
import { createGuestBuildStore } from '../../infrastructure/storage/guestBuildStore';
import { createInventoryStore } from '../../infrastructure/storage/inventoryStore';

const release = {
  version: fallbackRelease.version,
  formulaSetVersion: fallbackRelease.formulaSetVersion,
  sourceSummary: fallbackRelease.sourceSummary,
  publishedAtMicros: 0n,
  lastReviewedAt: fallbackRelease.lastReviewedAt,
};

function profile(): CharacterProfile {
  return {
    schemaVersion: 2,
    id: 'inventory-screen-build',
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
    ownedItemIds: [],
    datasetVersion: fallbackRelease.version,
  };
}

function inventory(
  patch: Partial<InventoryState> = {},
): InventoryState {
  return {
    schemaVersion: 1,
    ownedItemIds: [],
    favoriteItemIds: [],
    comparisonItemIds: [],
    notes: {},
    ...patch,
  };
}

async function renderInventory(
  initial = inventory(),
  path = '/inventory',
) {
  const buildStore = createGuestBuildStore({
    databaseName: `inventory-screen-build-${crypto.randomUUID()}`,
  });
  const inventoryStore = createInventoryStore({
    databaseName: `inventory-screen-state-${crypto.randomUUID()}`,
  });
  await buildStore.saveDraft(profile());
  await inventoryStore.save(initial);
  const router = createMemoryRouter(
    createAppRoutes(<App release={release} source="bundled" />),
    { initialEntries: [path] },
  );
  render(
    <DatasetProvider snapshot={fallbackRelease}>
      <BuildDraftProvider store={buildStore}>
        <InventoryProvider store={inventoryStore}>
          <RouterProvider router={router} />
        </InventoryProvider>
      </BuildDraftProvider>
    </DatasetProvider>,
  );
  return { router, buildStore, inventoryStore };
}

describe('Inventory workspace', () => {
  it('renders the verified catalog incrementally and enables global navigation', async () => {
    const user = userEvent.setup();
    await renderInventory();

    expect(
      await screen.findByRole('heading', { name: 'Inventory' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute(
      'href',
      '/inventory',
    );
    const list = screen.getByRole('list', { name: 'Inventory items' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(100);
    await user.click(screen.getByRole('button', { name: 'Show more items' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(200);
  });

  it('owns, favorites, compares, notes, and equips through explicit actions', async () => {
    const user = userEvent.setup();
    const { buildStore, inventoryStore } = await renderInventory();
    await screen.findByRole('heading', { name: 'Inventory' });

    await user.type(
      screen.getByRole('searchbox', { name: 'Search verified equipment' }),
      'Steel Greatsword',
    );
    await user.click(
      await screen.findByRole('button', { name: 'Inspect Steel Greatsword' }),
    );
    const details = screen.getByRole('complementary', {
      name: 'Steel Greatsword inventory details',
    });
    await user.click(
      within(details).getByRole('button', {
        name: 'Mark Steel Greatsword owned',
      }),
    );
    await user.click(
      within(details).getByRole('button', {
        name: 'Favorite Steel Greatsword',
      }),
    );
    await user.click(
      within(details).getByRole('button', {
        name: 'Add Steel Greatsword to comparison',
      }),
    );
    await user.type(
      within(details).getByRole('textbox', {
        name: 'Personal note for Steel Greatsword',
      }),
      'Next weapon target',
    );
    await user.click(
      within(details).getByRole('button', { name: 'Equip Steel Greatsword' }),
    );

    await waitFor(async () => {
      expect(await inventoryStore.load()).toEqual(
        inventory({
          ownedItemIds: ['steel-greatsword'],
          favoriteItemIds: ['steel-greatsword'],
          comparisonItemIds: ['steel-greatsword'],
          notes: { 'steel-greatsword': 'Next weapon target' },
        }),
      );
      expect((await buildStore.loadDraft())?.equipped['main-hand']).toBe(
        'steel-greatsword',
      );
    });
    expect(screen.getByRole('status')).toHaveTextContent(/1 item selected/i);
  });

  it('explains an empty filter result and unresolved saved IDs', async () => {
    const user = userEvent.setup();
    await renderInventory(
      inventory({
        ownedItemIds: ['removed-item'],
        favoriteItemIds: ['missing-favorite'],
      }),
    );
    await screen.findByRole('heading', { name: 'Inventory' });

    expect(screen.getByText(/2 saved inventory IDs are unavailable/i)).toBeVisible();
    await user.type(
      screen.getByRole('searchbox', { name: 'Search verified equipment' }),
      'item-that-does-not-exist',
    );
    expect(
      await screen.findByText(
        'No verified equipment matches the current search and filters.',
      ),
    ).toBeVisible();
  });

  it('compares selected equipment and equips a verified candidate', async () => {
    const user = userEvent.setup();
    const { buildStore } = await renderInventory(
      inventory({
        ownedItemIds: ['iron-greatsword'],
        comparisonItemIds: ['iron-greatsword', 'steel-greatsword'],
      }),
      '/compare/equipment',
    );

    expect(
      await screen.findByRole('heading', { name: 'Equipment Comparison' }),
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: 'Iron Greatsword' }),
    ).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: 'Steel Greatsword' }),
    ).toBeVisible();
    expect(screen.getByRole('row', { name: /Price/ })).toHaveTextContent(
      '231 Col',
    );
    expect(
      screen.getByRole('link', { name: 'Open Steel Greatsword Wiki' }),
    ).toHaveAttribute(
      'href',
      'https://swordbloxonlinerebirth.fandom.com/wiki/Steel%20Greatsword',
    );

    await user.click(
      screen.getByRole('button', { name: 'Equip Steel Greatsword' }),
    );
    await waitFor(async () => {
      expect((await buildStore.loadDraft())?.equipped['main-hand']).toBe(
        'steel-greatsword',
      );
    });
  });

  it('exports and merges a validated backup while rejecting corrupt input', async () => {
    const user = userEvent.setup();
    const { inventoryStore } = await renderInventory(
      inventory({ ownedItemIds: ['iron-greatsword'] }),
    );
    await screen.findByRole('heading', { name: 'Inventory' });

    await user.click(
      screen.getByRole('button', { name: 'Manage inventory backups' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Inventory backups' });
    await user.click(
      within(dialog).getByRole('button', { name: 'Export inventory JSON' }),
    );
    const exported = within(dialog).getByRole('textbox', {
      name: 'Exported inventory JSON',
    });
    expect((exported as HTMLTextAreaElement).value).toContain(
      'iron-greatsword',
    );

    const imported = JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-08-31T12:00:00.000Z',
      datasetVersion: fallbackRelease.version,
      inventory: inventory({
        ownedItemIds: ['beginner-armor'],
        favoriteItemIds: ['beginner-armor'],
      }),
    });
    const input = within(dialog).getByRole('textbox', {
      name: 'Paste inventory backup JSON',
    });
    fireEvent.change(input, { target: { value: imported } });
    await user.click(
      within(dialog).getByRole('button', { name: 'Import inventory' }),
    );
    await waitFor(async () => {
      expect(await inventoryStore.load()).toEqual(
        inventory({
          ownedItemIds: ['beginner-armor', 'iron-greatsword'],
          favoriteItemIds: ['beginner-armor'],
        }),
      );
    });

    fireEvent.change(input, { target: { value: '{bad json' } });
    await user.click(
      within(dialog).getByRole('button', { name: 'Import inventory' }),
    );
    expect(
      within(dialog).getByRole('alert'),
    ).toHaveTextContent('Inventory backup is invalid');
  });
});
