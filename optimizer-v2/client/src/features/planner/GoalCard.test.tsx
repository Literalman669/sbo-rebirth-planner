import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GoalCard, GOAL_PRESENTATION } from './GoalCard';

describe('GoalCard', () => {
  it('keeps native radio semantics and explains only modeled mobility metrics', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(
      <GoalCard
        goal="mobility"
        selected={false}
        onSelect={select}
      />,
    );

    const radio = screen.getByRole('radio', { name: 'Mobility' });
    await user.click(radio);

    expect(select).toHaveBeenCalledWith('mobility');
    expect(
      screen.getByText(/emphasizes movement speed and stamina/i),
    ).toBeVisible();
    expect(GOAL_PRESENTATION.mobility.metrics).toEqual([
      'Stamina',
      'Walk speed',
      'Sprint speed',
    ]);
  });
});
