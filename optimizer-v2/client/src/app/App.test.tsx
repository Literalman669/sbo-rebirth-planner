import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('identifies the new optimizer without rendering the legacy dashboard', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'SBO:Rebirth Build Optimizer' }),
    ).toBeVisible();
    expect(screen.queryByText('Bosses')).not.toBeInTheDocument();
  });
});
