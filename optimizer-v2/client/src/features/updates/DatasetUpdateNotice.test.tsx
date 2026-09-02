import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DatasetUpdateNotice } from './DatasetUpdateNotice';

describe('DatasetUpdateNotice', () => {
  it.each([
    [1, 'Verified data update affects 1 build'],
    [3, 'Verified data update affects 3 builds'],
  ])('announces an actionable nonmodal count for %i build(s)', (count, copy) => {
    render(
      <MemoryRouter>
        <DatasetUpdateNotice count={count} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(copy);
    expect(screen.getByRole('link', { name: 'Review changes' })).toHaveAttribute(
      'href',
      '/updates',
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
