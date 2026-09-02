import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProgressHistoryEvent } from '../../domain/progress/model';
import { JourneyHistory } from './JourneyHistory';
import { ProgressContextHeader } from './ProgressContextHeader';

const events: ProgressHistoryEvent[] = [
  {
    id: 'history-equipment',
    actionKey: 'equipment:armor:combat-armor',
    category: 'equipment-upgrade',
    label: 'Buy Combat Armor',
    outcome: 'completed',
    source: 'manual',
    planFingerprint: 'plan-a',
    datasetVersion: '2026.08.30.1',
    occurredAt: '2026-09-01T12:00:00.000Z',
  },
  {
    id: 'history-floor',
    actionKey: 'floor:unlock:3',
    category: 'floor-milestone',
    label: 'Unlock Floor 3',
    outcome: 'skipped',
    source: 'legacy',
    planFingerprint: 'plan-a',
  },
  {
    id: 'history-stats',
    actionKey: 'spend-stats:level:9',
    category: 'stat-allocation',
    label: 'Allocate Level 9 points',
    outcome: 'reopened',
    source: 'manual',
    planFingerprint: 'plan-a',
    occurredAt: '2026-09-01T13:00:00.000Z',
  },
];

describe('progress dashboard components', () => {
  it('counts completion only for tasks in the current plan', () => {
    render(
      <ProgressContextHeader
        profile={{
          schemaVersion: 2,
          id: 'progress-build',
          level: 8,
          maxFloor: 2,
          weaponPath: 'two-handed',
          goal: 'balanced',
          stats: { str: 10, def: 5, agi: 3, vit: 3, luk: 3 },
          equipped: {},
          ownedItemIds: [],
          datasetVersion: '2026.08.30.1',
        }}
        source="Active draft"
        progress={{
          schemaVersion: 2,
          buildId: 'progress-build',
          objectives: [
            {
              actionKey: 'current-task',
              category: 'stat-allocation',
              status: 'completed',
              source: 'manual',
              planFingerprint: 'current-plan',
            },
            {
              actionKey: 'old-task',
              category: 'equipment-upgrade',
              status: 'completed',
              source: 'manual',
              planFingerprint: 'old-plan',
            },
          ],
          history: [],
        }}
        taskActionKeys={['current-task']}
      />,
    );

    expect(screen.getByText('1/1 · 100%')).toBeVisible();
    expect(screen.queryByText('2/1 · 100%')).not.toBeInTheDocument();
  });

  it('filters and groups journey history and confirms before reset', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn(async () => undefined);
    render(
      <JourneyHistory
        events={events}
        onReopen={vi.fn()}
        onReset={onReset}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Show journey history' }));
    expect(screen.getByRole('heading', { name: '2026-09-01' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Before progress history' })).toBeVisible();

    await user.selectOptions(screen.getByLabelText('History result'), 'completed');
    expect(screen.getByText('Buy Combat Armor completed')).toBeVisible();
    expect(screen.queryByText('Unlock Floor 3 skipped')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('History result'), 'all');
    await user.selectOptions(screen.getByLabelText('History category'), 'floor-milestone');
    expect(screen.getByText('Unlock Floor 3 skipped')).toBeVisible();
    expect(screen.queryByText('Buy Combat Armor completed')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset progress' }));
    expect(screen.getByRole('alertdialog', { name: 'Reset progress?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel reset' }));
    expect(onReset).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Reset progress' }));
    await user.click(screen.getByRole('button', { name: 'Reset permanently' }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
