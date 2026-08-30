import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StatControl } from './StatControl';

function Harness() {
  const [value, setValue] = useState(0);
  const [locked, setLocked] = useState(false);
  return (
    <StatControl
      stat="str"
      label="STR"
      description="Raises verified attack metrics."
      value={value}
      maxValue={12}
      locked={locked}
      onChange={setValue}
      onToggleLock={() => setLocked((current) => !current)}
    />
  );
}

describe('StatControl', () => {
  it('supports increment, max, decrement, direct entry, and lock controls', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Add 5 STR' }));
    expect(screen.getByLabelText('STR')).toHaveValue(5);
    await user.click(screen.getByRole('button', { name: 'Add 1 STR' }));
    expect(screen.getByLabelText('STR')).toHaveValue(6);
    await user.click(screen.getByRole('button', { name: 'Set STR to max' }));
    expect(screen.getByLabelText('STR')).toHaveValue(12);
    await user.click(screen.getByRole('button', { name: 'Remove 1 STR' }));
    expect(screen.getByLabelText('STR')).toHaveValue(11);
    await user.clear(screen.getByLabelText('STR'));
    await user.type(screen.getByLabelText('STR'), '4');
    expect(screen.getByLabelText('STR')).toHaveValue(4);
    await user.click(screen.getByRole('button', { name: 'Lock STR' }));
    expect(screen.getByRole('button', { name: 'Unlock STR' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
