import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SaveBuildDialog, type SaveBuildRequest } from './SaveBuildDialog';

function Harness({ onSave = vi.fn() }: { onSave?: (request: SaveBuildRequest) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open save</button>
      <SaveBuildDialog
        open={open}
        defaultName="Frontline Build"
        cloudAvailable
        onSave={(request) => {
          onSave(request);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

describe('SaveBuildDialog', () => {
  it('validates one focused save flow with explicit mode and destination', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    const trigger = screen.getByRole('button', { name: 'Open save' });
    await user.click(trigger);

    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(1);
    await user.clear(screen.getByLabelText('Build Name'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Build name is required');
    await user.type(screen.getByLabelText('Build Name'), 'Cloud Copy');
    await user.click(screen.getByRole('radio', { name: 'Save as duplicate' }));
    await user.click(screen.getByRole('radio', { name: 'Cloud sync' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      name: 'Cloud Copy',
      mode: 'duplicate',
      destination: 'cloud',
    });
  });

  it('restores focus to the trigger after cancel', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open save' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(trigger).toHaveFocus();
  });
});
