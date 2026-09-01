import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import {
  createBuildBackup,
  serializeBuildBackup,
  type BuildImportPlan,
  type PortableBuildRecord,
} from '../../domain/build/portable';
import { BuildBackupDialog } from './BuildBackupDialog';
import { BuildImportDialog } from './BuildImportDialog';

function profile(id = 'build-a'): CharacterProfile {
  return {
    schemaVersion: 2,
    id,
    name: 'Portable Route',
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped: {
      'main-hand': 'iron-greatsword',
      armor: 'fields-warrior',
    },
    ownedItemIds: [],
    datasetVersion: '2026.08.30.1',
  };
}

function record(id = 'build-a'): PortableBuildRecord {
  const current = profile(id);
  return {
    profile: current,
    kind: 'build',
    headRevisionId: `${id}-revision`,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    revisions: [{
      id: `${id}-revision`,
      buildId: id,
      kind: 'build',
      profile: current,
      createdAt: '2026-09-01T10:00:00.000Z',
    }],
  };
}

function backupText() {
  return serializeBuildBackup(
    createBuildBackup({
      scope: 'single',
      exportedAt: '2026-09-01T12:00:00.000Z',
      records: [record()],
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('build portable dialogs', () => {
  it('downloads a strict library backup and labels local-only scope', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:build-backup');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(
      <BuildBackupDialog
        records={[record()]}
        cloudAvailable={false}
        onClose={() => undefined}
      />,
    );

    expect(
      screen.getByText('Cloud builds are unavailable; this backup contains local records only.'),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Download library backup' }),
    );

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]![0];
    expect(await blob.text()).toContain('"format": "sbo-rebirth-build-library"');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:build-backup');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Build library backup downloaded.',
    );
  });

  it('previews a valid file and imports duplicates by default', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn(async (_plan: BuildImportPlan) => 'local' as const);
    render(
      <BuildImportDialog
        existing={new Map([['build-a', { headRevisionId: 'existing-head' }]])}
        onImport={onImport}
        onClose={() => undefined}
      />,
    );
    await user.upload(
      screen.getByLabelText('Choose build backup'),
      new File([backupText()], 'builds.json', { type: 'application/json' }),
    );

    expect(await screen.findByText('1 valid build')).toBeVisible();
    expect(screen.getByText('Portable Route imported')).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Import as duplicates' })).toBeChecked();
    await user.click(
      screen.getByRole('button', { name: 'Import as duplicates' }),
    );

    await waitFor(() => expect(onImport).toHaveBeenCalledOnce());
    expect(onImport.mock.calls[0]![0]).toMatchObject({
      mode: 'duplicate',
      preview: [{ conflict: true, action: 'duplicate' }],
    });
  });

  it('requires a second confirmation before recoverable overwrite', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn(async (_plan: BuildImportPlan) => 'local' as const);
    render(
      <BuildImportDialog
        existing={new Map([['build-a', { headRevisionId: 'existing-head' }]])}
        onImport={onImport}
        onClose={() => undefined}
      />,
    );
    await user.upload(
      screen.getByLabelText('Choose build backup'),
      new File([backupText()], 'builds.json', { type: 'application/json' }),
    );
    await screen.findByText('1 valid build');
    await user.click(
      screen.getByRole('radio', { name: 'Overwrite matching builds' }),
    );
    await user.click(screen.getByRole('button', { name: 'Review overwrite' }));

    expect(onImport).not.toHaveBeenCalled();
    const confirmation = screen.getByRole('alertdialog', {
      name: 'Overwrite 1 matching build?',
    });
    await user.click(
      screen.getByRole('button', { name: 'Confirm recoverable overwrite' }),
    );

    await waitFor(() => expect(onImport).toHaveBeenCalledOnce());
    expect(onImport.mock.calls[0]![0]).toMatchObject({
      mode: 'overwrite',
      records: [{ profile: { id: 'build-a' } }],
      preview: [{ action: 'overwrite' }],
    });
  });

  it('rejects an unsupported file before import', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn(async (_plan: BuildImportPlan) => 'local' as const);
    render(
      <BuildImportDialog
        existing={new Map()}
        onImport={onImport}
        onClose={() => undefined}
      />,
    );
    await user.upload(
      screen.getByLabelText('Choose build backup'),
      new File(
        [JSON.stringify({ format: 'sbo-rebirth-build-library', schemaVersion: 99 })],
        'future.json',
        { type: 'application/json' },
      ),
    );

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Build backup is invalid or unsupported');
    expect(onImport).not.toHaveBeenCalled();
  });
});
