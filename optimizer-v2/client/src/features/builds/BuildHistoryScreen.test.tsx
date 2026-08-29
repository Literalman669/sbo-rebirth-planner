import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import type { CloudBuildRecord } from '../../infrastructure/cloud/buildRepository';
import { BuildHistoryView } from './BuildHistoryScreen';

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
  history: [
    {
      revisionId: 'revision-1',
      createdAt: '2026-08-29T10:00:00.000Z',
      datasetVersion: 'bootstrap-0',
      profile: profile(20),
    },
    {
      revisionId: 'revision-2',
      createdAt: '2026-08-29T11:00:00.000Z',
      datasetVersion: 'bootstrap-0',
      profile: profile(21),
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
});
