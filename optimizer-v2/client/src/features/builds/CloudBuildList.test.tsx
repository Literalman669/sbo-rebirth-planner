import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import type { CloudBuildRecord } from '../../infrastructure/cloud/buildRepository';
import { CloudBuildList } from './CloudBuildList';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'build-a',
  name: 'Cloud Route',
  level: 20,
  maxFloor: 3,
  weaponPath: 'two-handed',
  goal: 'balanced',
  stats: { str: 20, def: 10, agi: 12, vit: 8, luk: 5 },
  equipped: {},
  ownedItemIds: [],
  datasetVersion: 'bootstrap-0',
};

const record: CloudBuildRecord = {
  headRevisionId: 'revision-1',
  profile,
  kind: 'build',
  history: [
    {
      revisionId: 'revision-1',
      createdAt: '2026-08-29T10:00:00.000Z',
      datasetVersion: 'bootstrap-0',
      profile,
      kind: 'build',
    },
  ],
};

describe('CloudBuildList', () => {
  it('exposes the full cloud lifecycle for a cloud build', async () => {
    const user = userEvent.setup();
    const onLoad = vi.fn();
    const onHistory = vi.fn();
    const onDelete = vi.fn();
    const onRename = vi.fn();
    const onDuplicate = vi.fn();
    const onArchive = vi.fn();
    const onShare = vi.fn();
    render(
      <CloudBuildList
        builds={[record]}
        onLoad={onLoad}
        onHistory={onHistory}
        onDelete={onDelete}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onArchive={onArchive}
        onExport={vi.fn()}
        onShare={onShare}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load Cloud Route' }));
    fireEvent.click(screen.getByRole('button', { name: 'History for Cloud Route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Cloud Route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive Cloud Route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Share Cloud Route' }));
    await user.click(screen.getByRole('button', { name: 'Rename Cloud Route' }));
    await user.clear(screen.getByLabelText('Rename Cloud Route'));
    await user.type(screen.getByLabelText('Rename Cloud Route'), 'Renamed Cloud Route');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Cloud Route' }));

    expect(onLoad).toHaveBeenCalledWith(profile);
    expect(onHistory).toHaveBeenCalledWith('build-a');
    expect(onDuplicate).toHaveBeenCalledWith(profile);
    expect(onArchive).toHaveBeenCalledWith('build-a', true);
    expect(onShare).toHaveBeenCalledWith('build-a');
    expect(onRename).toHaveBeenCalledWith('build-a', 'Renamed Cloud Route');
    expect(onDelete).toHaveBeenCalledWith('build-a');
  });
});
