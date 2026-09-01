import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import type { CloudBuildRecord } from '../../infrastructure/cloud/buildRepository';
import { BuildHistoryView } from './BuildHistoryScreen';
import { BuildHistoryScreen } from './BuildHistoryScreen';
import { BuildDraftProvider } from '../../app/providers/BuildDraftProvider';
import { DatasetProvider } from '../../app/providers/DatasetProvider';
import { createGuestBuildStore } from '../../infrastructure/storage/guestBuildStore';

function profile(level: number): CharacterProfile {
  return {
    schemaVersion: 2,
    id: 'build-a',
    name: 'Cloud Route',
    level,
    maxFloor: 3,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 20, def: 10, agi: 12, vit: 8, luk: 5 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion: 'bootstrap-0',
  };
}

const record: CloudBuildRecord = {
  headRevisionId: 'revision-2',
  profile: profile(21),
  kind: 'build',
  history: [
    {
      revisionId: 'revision-1',
      createdAt: '2026-08-29T10:00:00.000Z',
      datasetVersion: 'bootstrap-0',
      profile: profile(20),
      kind: 'build',
    },
    {
      revisionId: 'revision-2',
      createdAt: '2026-08-29T11:00:00.000Z',
      datasetVersion: 'bootstrap-0',
      profile: profile(21),
      kind: 'build',
    },
  ],
};

describe('BuildHistoryView', () => {
  it('shows every revision and confirms before restore', async () => {
    const onRestore = vi.fn(async () => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<BuildHistoryView record={record} onRestore={onRestore} />);

    expect(screen.getByText('Level 20 · bootstrap-0')).toBeVisible();
    expect(screen.getByText('Level 21 · bootstrap-0')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Restore revision revision-1' }),
    );

    expect(onRestore).toHaveBeenCalledWith('revision-1');
  });

  it('loads and restores local immutable history without requiring sign-in', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const store = createGuestBuildStore({
      databaseName: `local-history-screen-${crypto.randomUUID()}`,
    });
    await store.saveBuild(profile(20), { revisionId: 'local-revision-1' });
    await store.saveBuild(profile(21), { revisionId: 'local-revision-2' });
    render(
      <DatasetProvider>
        <BuildDraftProvider store={store}>
          <MemoryRouter initialEntries={['/builds/build-a/history']}>
            <Routes>
              <Route path="builds/:buildId/history" element={<BuildHistoryScreen />} />
              <Route path="character" element={<p>Character route</p>} />
            </Routes>
          </MemoryRouter>
        </BuildDraftProvider>
      </DatasetProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Cloud Route history' }),
    ).toBeVisible();
    expect(screen.getByText('Level 20 · bootstrap-0')).toBeVisible();
    expect(screen.getByText('Level 21 · bootstrap-0')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Restore revision local-revision-1' }),
    );

    expect(await screen.findByText('Character route')).toBeVisible();
    await waitFor(async () => {
      expect(
        (await store.listBuilds()).find(
          (row) => row.ok && row.value.profile.id === 'build-a',
        ),
      ).toMatchObject({ ok: true, value: { profile: { level: 20 } } });
      await expect(store.listBuildHistory('build-a')).resolves.toHaveLength(3);
    });
  });
});
