import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import { createGuestBuildStore } from '../../infrastructure/storage/guestBuildStore';
import type { GuestBuildStore } from '../../infrastructure/storage/guestBuildStore';
import { BuildDraftProvider } from '../../app/providers/BuildDraftProvider';
import { DatasetProvider } from '../../app/providers/DatasetProvider';
import { BuildsScreen } from './BuildsScreen';

function build(id: string, name: string, path: CharacterProfile['weaponPath']): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name,
    level: 8,
    maxFloor: 2,
    weaponPath: path,
    goal: 'balanced',
    stats: { str: 10, def: 5, agi: 4, vit: 4, luk: 1 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion: 'bootstrap-0',
  };
}

async function renderBuilds() {
  const store = createGuestBuildStore({
    databaseName: `builds-workspace-${crypto.randomUUID()}`,
  });
  await store.saveBuild(build('melee', 'Floor 2 Melee', 'melee'));
  await store.saveBuild(build('rapier', 'Floor 2 Rapier', 'rapier'));
  render(
    <MemoryRouter>
      <DatasetProvider>
        <BuildDraftProvider store={store}>
          <BuildsScreen />
        </BuildDraftProvider>
      </DatasetProvider>
    </MemoryRouter>,
  );
  return store;
}

describe('BuildsScreen', () => {
  it('opens focused import and backup dialogs from the library toolbar', async () => {
    const user = userEvent.setup();
    await renderBuilds();
    await screen.findByRole('heading', { name: 'Your Builds' });

    const importButton = screen.getByRole('button', { name: 'Import builds' });
    await user.click(importButton);
    expect(
      screen.getByRole('dialog', { name: 'Import builds' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(importButton).toHaveFocus();

    const backupButton = screen.getByRole('button', { name: 'Back up library' });
    await user.click(backupButton);
    expect(
      await screen.findByRole('dialog', { name: 'Build backups' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Cloud builds are unavailable; this backup contains local records only.',
      ),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(backupButton).toHaveFocus();
  });

  it('searches, renames, duplicates, and archives local builds', async () => {
    const user = userEvent.setup();
    await renderBuilds();
    await screen.findByRole('heading', { name: 'Your Builds' });

    await user.type(screen.getByRole('searchbox', { name: 'Search builds' }), 'Melee');
    expect(screen.getByText('Floor 2 Melee')).toBeVisible();
    expect(screen.queryByText('Floor 2 Rapier')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Duplicate Floor 2 Melee' }));
    expect(await screen.findByText('Floor 2 Melee copy')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Rename Floor 2 Melee' }));
    await user.clear(screen.getByLabelText('Rename Floor 2 Melee'));
    await user.type(screen.getByLabelText('Rename Floor 2 Melee'), 'Frontline Melee');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Frontline Melee')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Archive Frontline Melee' }));
    expect(await screen.findByText('Build archived.')).toBeVisible();
    expect(screen.queryByText('Frontline Melee')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Build status'), 'archived');
    expect(await screen.findByText('Frontline Melee')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Delete Frontline Melee' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete Frontline Melee?' })).toBeVisible();
    expect(
      screen.getByText(
        'This permanently removes the saved copy and its progress history from this device. Export the build first if you need a recovery file.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Frontline Melee')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Delete Frontline Melee' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(await screen.findByText('Build deleted.')).toBeVisible();
    expect(screen.queryByText('Frontline Melee')).not.toBeInTheDocument();
  });

  it('surfaces quarantined local data so it can be removed deliberately', async () => {
    const user = userEvent.setup();
    const base = createGuestBuildStore({
      databaseName: `builds-recovery-${crypto.randomUUID()}`,
    });
    const deleteQuarantinedRecord = vi.fn(async () => undefined);
    const store: GuestBuildStore = {
      ...base,
      listQuarantinedRecords: async () => [{
        id: 'plan-progress:broken',
        kind: 'plan-progress',
        rawJson: '{broken',
        quarantinedAt: '2026-08-30T12:00:00.000Z',
      }],
      deleteQuarantinedRecord,
    };
    render(
      <MemoryRouter>
        <DatasetProvider>
          <BuildDraftProvider store={store}>
            <BuildsScreen />
          </BuildDraftProvider>
        </DatasetProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Recovered Data' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Delete recovered plan-progress record' }));
    expect(deleteQuarantinedRecord).toHaveBeenCalledWith('plan-progress:broken');
    expect(screen.queryByRole('heading', { name: 'Recovered Data' })).not.toBeInTheDocument();
  });
});
