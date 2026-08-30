import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from './AuthContext';
import { AuthSessionContext } from './AuthContext';
import { CloudDataProvider } from './CloudDataProvider';
import { useCloudData } from './CloudDataContext';

const spacetime = vi.hoisted(() => ({
  useTable: vi.fn(
    (_table: unknown): readonly [readonly unknown[], boolean] => [[], true],
  ),
}));

vi.mock('spacetimedb/react', () => ({
  SpacetimeDBProvider: ({ children }: { children: React.ReactNode }) => children,
  useTable: spacetime.useTable,
}));

vi.mock('../../infrastructure/spacetime/connection', () => ({
  createConnectionBuilder: vi.fn(() => ({ kind: 'connection-builder' })),
}));

const noop = async () => undefined;

function Probe() {
  const cloud = useCloudData();
  return (
    <p>
      {cloud.isAuthenticated ? 'authenticated' : 'guest'} ·{' '}
      {cloud.isReady ? 'ready' : 'waiting'} · {cloud.builds.length} builds ·{' '}
      {cloud.planProgress.length} progress ·{' '}
      {cloud.preferences?.density ?? 'no preferences'}
    </p>
  );
}

function renderCloud(session: AuthSession) {
  return render(
    <AuthSessionContext.Provider value={session}>
      <CloudDataProvider>
        <Probe />
      </CloudDataProvider>
    </AuthSessionContext.Provider>,
  );
}

beforeEach(() => spacetime.useTable.mockClear());

describe('CloudDataProvider', () => {
  it('does not subscribe to private views for guests', () => {
    renderCloud({ status: 'guest', signIn: noop, signOut: noop });

    expect(
      screen.getByText('guest · ready · 0 builds · 0 progress · no preferences'),
    ).toBeVisible();
    expect(spacetime.useTable).not.toHaveBeenCalled();
  });

  it('subscribes to all identity-filtered views after authentication', () => {
    renderCloud({
      status: 'authenticated',
      idToken: 'signed-id-token',
      signIn: noop,
      signOut: noop,
    });

    expect(
      screen.getByText(
        'authenticated · ready · 0 builds · 0 progress · no preferences',
      ),
    ).toBeVisible();
    expect(spacetime.useTable).toHaveBeenCalledTimes(7);
  });

  it('validates subscribed progress and preferences before exposing them', () => {
    spacetime.useTable
      .mockImplementationOnce(() => [[], true])
      .mockImplementationOnce(() => [[], true])
      .mockImplementationOnce(() => [[], true])
      .mockImplementationOnce(() => [[], true])
      .mockImplementationOnce(() => [[], true])
      .mockImplementationOnce(() => [
        [
          {
            buildId: 'build-a',
            progressJson: JSON.stringify({
              schemaVersion: 1,
              buildId: 'build-a',
              completedActionIds: [],
              dismissedRecommendationIds: [],
            }),
          },
        ],
        true,
      ])
      .mockImplementationOnce(() => [
        [
          {
            preferencesJson: JSON.stringify({
              schemaVersion: 1,
              mode: 'detailed',
              density: 'compact',
              showAllLevels: true,
              compactWeaponPathsAfterFirstUse: true,
            }),
          },
        ],
        true,
      ]);

    renderCloud({
      status: 'authenticated',
      idToken: 'signed-id-token',
      signIn: noop,
      signOut: noop,
    });

    expect(
      screen.getByText('authenticated · ready · 0 builds · 1 progress · compact'),
    ).toBeVisible();
  });
});
