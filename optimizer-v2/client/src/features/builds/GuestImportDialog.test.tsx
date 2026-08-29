import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import { GuestImportDialog } from './GuestImportDialog';

function profile(id: string, name: string): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name,
    level: 20,
    maxFloor: 3,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 20, def: 10, agi: 12, vit: 8, luk: 5 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion: 'bootstrap-0',
  };
}

describe('GuestImportDialog', () => {
  it('imports only the builds the player leaves selected', async () => {
    const onImport = vi.fn(async () => undefined);
    render(
      <GuestImportDialog
        builds={[
          profile('selected', 'Selected Route'),
          profile('local-only', 'Keep Local'),
        ]}
        onImport={onImport}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Keep Local' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import selected' }));

    expect(onImport).toHaveBeenCalledWith(['selected']);
  });
});
