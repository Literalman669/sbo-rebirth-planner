import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from './AuthContext';
import { AuthSessionContext } from './AuthContext';
import { CloudDataProvider } from './CloudDataProvider';
import { useCloudData } from './CloudDataContext';

const spacetime = vi.hoisted(() => ({
  useTable: vi.fn(() => [[], true] as const),
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
      {cloud.isReady ? 'ready' : 'waiting'} · {cloud.builds.length} builds
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

    expect(screen.getByText('guest · ready · 0 builds')).toBeVisible();
    expect(spacetime.useTable).not.toHaveBeenCalled();
  });

  it('subscribes to all identity-filtered views after authentication', () => {
    renderCloud({
      status: 'authenticated',
      idToken: 'signed-id-token',
      signIn: noop,
      signOut: noop,
    });

    expect(screen.getByText('authenticated · ready · 0 builds')).toBeVisible();
    expect(spacetime.useTable).toHaveBeenCalledTimes(5);
  });
});
