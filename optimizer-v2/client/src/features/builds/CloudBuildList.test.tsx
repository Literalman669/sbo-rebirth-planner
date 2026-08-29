import { fireEvent, render, screen } from '@testing-library/react';
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
  history: [
    {
      revisionId: 'revision-1',
      createdAt: '2026-08-29T10:00:00.000Z',
      datasetVersion: 'bootstrap-0',
      profile,
    },
  ],
};

describe('CloudBuildList', () => {
  it('exposes load, history, and delete actions for a cloud build', () => {
    const onLoad = vi.fn();
    const onHistory = vi.fn();
    const onDelete = vi.fn();
    render(
      <CloudBuildList
        builds={[record]}
        onLoad={onLoad}
        onHistory={onHistory}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load Cloud Route' }));
    fireEvent.click(screen.getByRole('button', { name: 'History for Cloud Route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Cloud Route' }));

    expect(onLoad).toHaveBeenCalledWith(profile);
    expect(onHistory).toHaveBeenCalledWith('build-a');
    expect(onDelete).toHaveBeenCalledWith('build-a');
  });
});
