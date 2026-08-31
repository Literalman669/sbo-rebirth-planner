import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PlanAction } from '../../domain/results/actionChecklist';
import { ActionChecklist } from './ActionChecklist';

const actions: PlanAction[] = Array.from({ length: 5 }, (_, index) => ({
  id: `level-${index + 2}`,
  group: 'next-level',
  kind: 'spend-stats',
  title: `Allocate Level ${index + 2} points`,
  detail: 'STR +1 · AGI +1 · VIT +1',
  level: index + 2,
}));

describe('ActionChecklist', () => {
  it('shows only the next three level actions until the player expands them', async () => {
    const user = userEvent.setup();
    render(
      <ActionChecklist
        actions={actions}
        completedActionIds={new Set()}
        onToggle={vi.fn()}
        onDismiss={vi.fn()}
        onUndo={vi.fn()}
        canUndo={false}
      />,
    );

    expect(screen.getByText('Allocate Level 4 points')).toBeVisible();
    expect(screen.queryByText('Allocate Level 5 points')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show 2 more level actions' }));
    expect(screen.getByText('Allocate Level 6 points')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Show only the next 3 level actions' }));
    expect(screen.queryByText('Allocate Level 6 points')).not.toBeInTheDocument();
  });
});
