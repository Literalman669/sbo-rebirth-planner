import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import { createGuestBuildStore } from '../../infrastructure/storage/guestBuildStore';
import { BuildDraftProvider } from '../../app/providers/BuildDraftProvider';
import { DatasetProvider } from '../../app/providers/DatasetProvider';
import { App } from '../../app/App';
import { PlannerFrame } from '../planner/PlannerFrame';
import { StickyPlannerActions } from './StickyPlannerActions';
import { DatasetUpdatesContext } from '../../app/providers/DatasetUpdatesContext';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'shell-build',
  name: 'Frontline Route',
  level: 10,
  maxFloor: 2,
  weaponPath: 'melee',
  goal: 'balanced',
  stats: { str: 10, def: 10, agi: 5, vit: 5, luk: 0 },
  equipped: {
    'main-hand': 'fists',
    armor: 'beginner-armor',
  },
  ownedItemIds: [],
  datasetVersion: '2026.08.30.1',
};

async function renderRoute(path: string) {
  const store = createGuestBuildStore({
    databaseName: `shell-${crypto.randomUUID()}`,
  });
  await store.saveDraft(profile);
  render(
    <MemoryRouter initialEntries={[path]}>
      <DatasetProvider>
        <BuildDraftProvider store={store}>
          <Routes>
            <Route
              path="/"
              element={
                <App
                  release={{
                    version: '2026.08.30.1',
                    formulaSetVersion: 'sbor-stats-v2',
                    sourceSummary: 'Verified release',
                    publishedAtMicros: 0n,
                    lastReviewedAt: '2026-08-30',
                  }}
                  source="live"
                />
              }
            >
              <Route
                path="inventory"
                element={
                  <h2 data-screen-heading tabIndex={-1}>
                    Inventory workspace
                  </h2>
                }
              />
              <Route element={<PlannerFrame />}>
                <Route path="stats" element={<h2>Stats workspace</h2>} />
                <Route
                  path="equipment"
                  element={<h2>Equipment workspace</h2>}
                />
              </Route>
            </Route>
          </Routes>
        </BuildDraftProvider>
      </DatasetProvider>
    </MemoryRouter>,
  );
}

describe('product shell', () => {
  it('shows one global dataset-update notice without adding a primary-nav item', () => {
    render(
      <MemoryRouter>
        <DatasetUpdatesContext.Provider value={{
          candidates: [],
          unreviewedCount: 3,
          isHydrated: true,
          storageError: null,
          loadReport: vi.fn(),
          keepPinned: vi.fn(),
          applyUpdate: vi.fn(),
          refresh: vi.fn(),
        }}>
          <Routes>
            <Route
              path="/"
              element={
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
              }
            >
              <Route index element={<h2>Home workspace</h2>} />
            </Route>
          </Routes>
        </DatasetUpdatesContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Verified data update affects 3 builds',
    );
    expect(screen.getByRole('link', { name: 'Review changes' })).toHaveAttribute(
      'href',
      '/updates',
    );
    expect(
      screen.getByRole('navigation', { name: 'Primary' }),
    ).not.toContainElement(screen.getByRole('link', { name: 'Review changes' }));
  });

  it('shows a global recovery notice for local storage failures', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={
              <App
                release={{
                  version: '2026.08.30.1',
                  formulaSetVersion: 'sbor-stats-v2',
                  sourceSummary: 'Verified release',
                  publishedAtMicros: 0n,
                  lastReviewedAt: '2026-08-30',
                }}
                source="bundled"
                storageWarning="Close other SBO planner tabs, then reload this page."
              />
            }
          >
            <Route index element={<h2>Home workspace</h2>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Close other SBO planner tabs, then reload this page.',
    );
    expect(
      screen.getByRole('button', { name: 'Reload app' }),
    ).toBeVisible();
  });

  it('separates global navigation from planner progress', async () => {
    await renderRoute('/stats');

    expect(
      await screen.findByRole('navigation', { name: 'Primary' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Progress' }),
    ).toHaveAttribute('href', '/progress');
    expect(
      screen.getByRole('navigation', { name: 'Planner progress' }),
    ).toBeVisible();
  });

  it('shows profile context and local save status on every planner step', async () => {
    await renderRoute('/equipment');

    expect(
      await screen.findByText('Level 10 · Floor 2 · Melee · Balanced'),
    ).toBeVisible();
    expect(await screen.findByText('Saved locally')).toBeVisible();
    expect(screen.getByText('Frontline Route')).toBeVisible();
  });

  it('resets document scroll when leaving the planner for another workspace', async () => {
    const user = userEvent.setup();
    await renderRoute('/stats');
    await screen.findByText('Stats workspace');
    document.documentElement.scrollTop = 450;
    document.body.scrollTop = 450;

    await user.click(screen.getByRole('link', { name: 'Inventory' }));
    await screen.findByText('Inventory workspace');

    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
  });

  it('renders reusable planner actions with a disabled next action', async () => {
    const user = userEvent.setup();
    const back = vi.fn();
    const next = vi.fn();
    render(
      <StickyPlannerActions
        back={{ label: 'Back', onClick: back }}
        next={{ label: 'Continue', onClick: next }}
        nextDisabled
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(back).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });
});
