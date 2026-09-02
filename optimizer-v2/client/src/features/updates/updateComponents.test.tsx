import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApplyDatasetUpdateDialog } from './ApplyDatasetUpdateDialog';
import { PlanImpactSection } from './PlanImpactSection';
import { ReleaseTrailSection } from './ReleaseTrailSection';

describe('dataset update report components', () => {
  it('states unchanged and blocked plan outcomes without inventing advice', () => {
    const view = render(
      <PlanImpactSection impact={{
        status: 'unchanged',
        changes: [],
        changedLevelRows: [],
        shopping: {
          beforeKnownTotal: 0,
          afterKnownTotal: 0,
          beforeUnknownCount: 0,
          afterUnknownCount: 0,
        },
      }} />,
    );
    expect(screen.getByText('Plan unchanged.')).toBeVisible();

    view.rerender(
      <PlanImpactSection impact={{
        status: 'blocked',
        pinnedReason: 'Pinned formula unavailable',
        targetReason: 'Current strategy unavailable',
      }} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Pinned plan: Pinned formula unavailable',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Current plan: Current strategy unavailable',
    );
  });

  it('translates structured plan differences into readable actions and allocations', () => {
    render(
      <PlanImpactSection impact={{
        status: 'changed',
        changes: [
          {
            id: 'plan:immediateAction',
            field: 'immediateAction',
            before: '{"kind":"keep-current","summary":"Keep current gear"}',
            after: '{"kind":"obtain-upgrade","summary":"Obtain Steel Armor"}',
          },
          {
            id: 'plan:spendNow',
            field: 'spendNow',
            before: '{"points":0,"added":{"str":0,"def":0,"agi":0,"vit":0,"luk":0}}',
            after: '{"points":3,"added":{"str":2,"def":0,"agi":0,"vit":1,"luk":0}}',
          },
          {
            id: 'plan:warnings',
            field: 'warnings',
            before: '[]',
            after: '["Price missing"]',
          },
        ],
        changedLevelRows: [],
        shopping: {
          beforeKnownTotal: 0,
          afterKnownTotal: 0,
          beforeUnknownCount: 0,
          afterUnknownCount: 1,
        },
      }} />,
    );

    expect(screen.getByText('Obtain Steel Armor')).toBeVisible();
    expect(screen.getByText('3 points · STR +2 · VIT +1')).toBeVisible();
    expect(screen.getByText('Price missing')).toBeVisible();
  });

  it('keeps release details collapsed and explains an intermediate gap', async () => {
    const user = userEvent.setup();
    render(
      <ReleaseTrailSection steps={[{
        fromVersion: '2026.08.30.1',
        toVersion: '2026.08.31.1',
        status: 'gap',
        factChanges: [],
        plan: null,
      }]} />,
    );
    const disclosure = screen.getByText(/2026\.08\.30\.1.*2026\.08\.31\.1/);
    expect(disclosure.closest('details')).not.toHaveAttribute('open');

    await user.click(disclosure);

    expect(disclosure.closest('details')).toHaveAttribute('open');
    expect(screen.getByText(/endpoint report remains valid/i)).toBeVisible();
  });

  it('loads an available release-step plan only when its disclosure opens', async () => {
    const user = userEvent.setup();
    const loadPlan = vi.fn(async () => ({
      status: 'unchanged' as const,
      changes: [] as [],
      changedLevelRows: [],
      shopping: {
        beforeKnownTotal: 0,
        afterKnownTotal: 0,
        beforeUnknownCount: 0,
        afterUnknownCount: 0,
      },
    }));
    render(
      <ReleaseTrailSection
        steps={[{
          fromVersion: '2026.08.30.1',
          toVersion: '2026.08.31.1',
          status: 'available',
          factChanges: [],
          plan: null,
        }]}
        onLoadPlan={loadPlan}
      />,
    );
    expect(loadPlan).not.toHaveBeenCalled();

    await user.click(screen.getByText(/2026\.08\.30\.1.*2026\.08\.31\.1/));

    expect(await screen.findByText('Plan unchanged in this release step.'))
      .toBeVisible();
    expect(loadPlan).toHaveBeenCalledWith(0);
  });

  it('traps focus within confirmation controls and supports Escape', async () => {
    const user = userEvent.setup();
    const cancel = vi.fn();
    render(
      <ApplyDatasetUpdateDialog
        buildName="Frontline route"
        pinnedVersion="2026.08.30.1"
        targetVersion="2026.09.01.1"
        busy={false}
        onConfirm={vi.fn()}
        onCancel={cancel}
      />,
    );
    const confirm = screen.getByRole('button', {
      name: 'Confirm dataset update',
    });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(confirm).toHaveFocus();

    await user.tab();
    expect(cancelButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(cancel).toHaveBeenCalledOnce();
  });
});
