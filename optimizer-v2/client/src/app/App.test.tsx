import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('identifies the new optimizer without rendering the legacy dashboard', () => {
    render(
      <App
        release={{
          version: 'bootstrap-0',
          formulaSetVersion: 'sbor-stats-v1',
          sourceSummary: 'Bundled fallback',
          publishedAtMicros: 0n,
          lastReviewedAt: '2026-08-29',
        }}
        source="fallback"
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'SBO:Rebirth Build Optimizer' }),
    ).toBeVisible();
    expect(screen.getByText('Dataset bootstrap-0 · fallback')).toBeVisible();
    expect(screen.queryByText('Bosses')).not.toBeInTheDocument();
  });
});
