import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import type { DatasetImpactCandidate } from '../../domain/datasetImpact/candidates';
import type { DatasetImpactReport } from '../../domain/datasetImpact/report';
import {
  DatasetUpdatesContext,
  type DatasetUpdatesState,
} from '../../app/providers/DatasetUpdatesContext';
import { DatasetUpdatesScreen } from './DatasetUpdatesScreen';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'saved-a',
  name: 'Frontline route',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
  equipped: { 'main-hand': 'iron-greatsword', armor: 'beginner-armor' },
  ownedItemIds: [],
  datasetVersion: '2026.08.30.1',
};

const pinned = {
  version: '2026.08.30.1',
  publishedAt: '2026-08-30T00:00:00.000Z',
  lastReviewedAt: '2026-08-30',
  formulaSetVersion: 'sbor-stats-v2' as const,
  strategyPolicyVersion: 'sbor-policy-v2' as const,
  contentFingerprint: 'dataset-pinned',
  availability: 'cached' as const,
};
const target = {
  ...pinned,
  version: '2026.09.01.1',
  publishedAt: '2026-09-01T00:00:00.000Z',
  lastReviewedAt: '2026-09-01',
  contentFingerprint: 'dataset-target',
  availability: 'live' as const,
};

const report: DatasetImpactReport = {
  contractVersion: 1,
  buildId: profile.id,
  inputFingerprint: 'build-input-a',
  impactKeyFingerprint: 'impact-a',
  reportFingerprint: 'impact-report-a',
  pinned,
  target,
  facts: [{
    id: 'acquisition:combat-armor:cost',
    entity: 'acquisition',
    entityId: 'combat-armor:acquisition:0',
    field: 'cost',
    change: 'changed',
    before: 3_360,
    after: 3_600,
    beforeSourceUrl: 'https://sword-blox-online-rebirth.fandom.com/wiki/Combat_Armor?oldid=100',
    afterSourceUrl: 'https://sword-blox-online-rebirth.fandom.com/wiki/Combat_Armor?oldid=200',
    beforeSourceRevision: '100',
    afterSourceRevision: '200',
  }],
  omittedFactChangeCount: 4,
  plan: {
    status: 'changed',
    changes: [{
      id: 'plan:upgradeTargets',
      field: 'upgradeTargets',
      before: '["Combat Armor"]',
      after: '["Steel Armor"]',
    }],
    changedLevelRows: [9, 10],
    shopping: {
      beforeKnownTotal: 3_360,
      afterKnownTotal: 3_600,
      beforeUnknownCount: 0,
      afterUnknownCount: 1,
      currency: 'Col',
    },
  },
  trail: [
    {
      fromVersion: '2026.08.30.1',
      toVersion: '2026.08.31.1',
      status: 'available',
      factChanges: [],
      plan: null,
    },
    {
      fromVersion: '2026.08.31.1',
      toVersion: '2026.09.01.1',
      status: 'gap',
      factChanges: [],
      plan: null,
    },
  ],
  unknowns: ['Intermediate release 2026.08.31.1 is unavailable.'],
};

function candidate(
  id: string,
  source: DatasetImpactCandidate['source'],
  overrides: Partial<DatasetImpactCandidate> = {},
): DatasetImpactCandidate {
  return {
    id,
    profile: { ...profile, id, name: `${source} ${id}` },
    source,
    kind: 'build',
    savedKind: 'build',
    headRevisionId: `${id}-head`,
    pinned,
    target,
    inputFingerprint: `input-${id}`,
    impactKeyFingerprint: `impact-${id}`,
    status: 'unreviewed',
    ...overrides,
  };
}

function state(overrides: Partial<DatasetUpdatesState> = {}): DatasetUpdatesState {
  return {
    candidates: [
      candidate('active-a', 'active', { kind: 'active-draft' }),
      candidate('saved-a', 'local'),
      candidate('mirror-a', 'local+cloud'),
      candidate('preset-a', 'local', {
        kind: 'personal-preset',
        savedKind: 'personal-preset',
      }),
      candidate('archive-a', 'cloud', {
        archivedAt: '2026-09-01T00:00:00.000Z',
      }),
    ],
    unreviewedCount: 5,
    isHydrated: true,
    storageError: null,
    loadReport: vi.fn(async (id) => ({
      status: 'ready' as const,
      report: { ...report, buildId: id },
    })),
    loadReleaseStepPlan: vi.fn(async () => null),
    loadPreview: vi.fn(async (_report, endpoint) => ({
      datasetVersion:
        endpoint === 'pinned' ? pinned.version : target.version,
      immediateAction: { kind: 'keep-current' as const, summary: 'Keep current gear' },
      statPlan: { spendNow: { points: 0 } },
      upgradeTargets: [],
      warnings: [],
      explanation: [],
    } as never)),
    keepPinned: vi.fn(async () => undefined),
    applyUpdate: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
    ...overrides,
  };
}

function renderUpdates(path: string, value = state()) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <DatasetUpdatesContext.Provider value={value}>
        <Routes>
          <Route path="updates" element={<DatasetUpdatesScreen />} />
        </Routes>
      </DatasetUpdatesContext.Provider>
    </MemoryRouter>,
  );
  return value;
}

describe('DatasetUpdatesScreen', () => {
  it('opens a direct local build and labels every owned source clearly', async () => {
    const updates = renderUpdates('/updates?build=saved-a&source=local');

    expect(
      await screen.findByRole('heading', { name: 'Dataset Updates' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Review build')).toHaveValue('local:saved-a');
    expect(screen.getByRole('option', { name: /Active draft/ })).toBeVisible();
    expect(screen.getByRole('option', { name: /Local and cloud/ })).toHaveValue(
      'local:mirror-a',
    );
    expect(screen.getByRole('option', { name: /Personal preset/ })).toBeVisible();
    expect(screen.getByRole('option', { name: /Archived/ })).toBeVisible();
    await waitFor(() => expect(updates.loadReport).toHaveBeenCalledWith('saved-a'));
  });

  it('explains a stale direct link and falls back to the first unreviewed build', async () => {
    renderUpdates('/updates?build=gone&source=local');

    expect(await screen.findByText(/linked build is no longer available/i))
      .toBeVisible();
    expect(screen.getByLabelText('Review build')).toHaveValue('local:active-a');
  });

  it('renders loading, blocked, and empty states without mutating a draft', async () => {
    const view = renderUpdates('/updates', state({
      isHydrated: false,
      candidates: [],
    }));
    expect(screen.getByText('Loading owned builds and verified releases…'))
      .toBeVisible();
    view.isHydrated = true;

    const blocked = state({
      candidates: [candidate('blocked-a', 'local', { status: 'blocked' })],
      loadReport: vi.fn(async () => ({
        status: 'blocked' as const,
        reason: 'Pinned dataset is unavailable.',
      })),
    });
    renderUpdates('/updates', blocked);
    expect(await screen.findByText('Pinned dataset is unavailable.')).toBeVisible();

    renderUpdates('/updates', state({ candidates: [], unreviewedCount: 0 }));
    expect(screen.getByText(/No owned builds need review/i)).toBeVisible();
  });

  it('renders verified facts before plan effects and supports every action', async () => {
    const user = userEvent.setup();
    const updates = renderUpdates('/updates?build=saved-a&source=local');
    const facts = await screen.findByRole('heading', {
      name: 'Verified facts changed',
    });
    const plan = screen.getByRole('heading', { name: 'Effect on your plan' });

    expect(
      facts.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText('Combat armor')).toBeVisible();
    expect(screen.getByText('3,360')).toBeVisible();
    expect(screen.getByText('3,600')).toBeVisible();
    expect(screen.getByRole('link', { name: 'After source' })).toHaveAttribute(
      'href',
      report.facts[0]!.afterSourceUrl,
    );
    expect(screen.getByRole('link', { name: 'After source' })).toHaveTextContent(
      'revision 200',
    );
    expect(screen.getByText(/4 other verified changes/i)).toBeVisible();
    expect(screen.getByText(/Levels 9, 10 changed/i)).toBeVisible();
    expect(screen.getByText(/3,360 Col → 3,600 Col/i)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Keep pinned' }));
    expect(updates.keepPinned).toHaveBeenCalledWith(
      expect.objectContaining({ buildId: 'saved-a' }),
    );
    await user.click(screen.getByRole('button', { name: 'Open pinned preview' }));
    expect(await screen.findByRole('heading', { name: 'Pinned planner preview' }))
      .toBeVisible();
    expect(screen.getByText('Keep current gear')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Update this build' }));
    const dialog = screen.getByRole('dialog', { name: 'Update local saved-a' });
    expect(dialog).toHaveTextContent(
      'Only the dataset pin changes. Stats, equipment, inventory, level, and floor stay the same.',
    );
    expect(screen.getByRole('button', { name: 'Confirm dataset update' }))
      .toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Confirm dataset update' }));
    expect(updates.applyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ buildId: 'saved-a' }),
    );
  });

  it('surfaces a stale apply, closes the dialog, and restores trigger focus', async () => {
    const user = userEvent.setup();
    const updates = state({
      applyUpdate: vi.fn(async () => {
        throw new Error('Build or dataset changed. Recalculate report.');
      }),
    });
    renderUpdates('/updates?build=saved-a&source=local', updates);
    const trigger = await screen.findByRole('button', {
      name: 'Update this build',
    });
    await user.click(trigger);
    await user.click(screen.getByRole('button', {
      name: 'Confirm dataset update',
    }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Build or dataset changed. Recalculate report.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

export { candidate, profile, report, state };
