import { render, screen } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createAppRoutes } from './router';
import { DatasetUpdatesContext } from './providers/DatasetUpdatesContext';

describe('App', () => {
  it('identifies the new optimizer without rendering the legacy dashboard', () => {
    render(
      <MemoryRouter>
        <App
          release={{
            version: 'bootstrap-0',
            formulaSetVersion: 'sbor-stats-v1',
            sourceSummary: 'Bundled fallback',
            publishedAtMicros: 0n,
            lastReviewedAt: '2026-08-29',
          }}
          source="bundled"
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'SBO:Rebirth Build Optimizer' }),
    ).toBeVisible();
    expect(
      screen.getByText('Dataset bootstrap-0 · bundled · verified 2026-08-29'),
    ).toBeVisible();
    expect(screen.queryByText('Bosses')).not.toBeInTheDocument();
  });

  it('loads the dataset updates workspace through its direct route', async () => {
    const root = (
      <App
        release={{
          version: '2026.09.01.1',
          formulaSetVersion: 'sbor-stats-v2',
          sourceSummary: 'Verified release',
          publishedAtMicros: 0n,
          lastReviewedAt: '2026-09-01',
        }}
        source="live"
      />
    );
    const router = createMemoryRouter(createAppRoutes(root), {
      initialEntries: ['/updates'],
    });
    render(
      <DatasetUpdatesContext.Provider value={{
        candidates: [],
        unreviewedCount: 0,
        isHydrated: true,
        storageError: null,
        loadReport: vi.fn(),
        loadReleaseStepPlan: vi.fn(),
        loadPreview: vi.fn(),
        keepPinned: vi.fn(),
        applyUpdate: vi.fn(),
        refresh: vi.fn(),
      }}>
        <RouterProvider router={router} />
      </DatasetUpdatesContext.Provider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Dataset Updates' }),
    ).toBeVisible();
    expect(screen.getByText(/No owned builds need review/i)).toBeVisible();
  });
});
