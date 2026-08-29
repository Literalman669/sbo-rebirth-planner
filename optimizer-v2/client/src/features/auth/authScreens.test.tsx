import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterProfile } from '../../domain/build/model';
import { createGuestBuildStore } from '../../infrastructure/storage/guestBuildStore';
import { AuthProvider } from '../../app/providers/AuthProvider';
import { useAuthSession } from '../../app/providers/AuthContext';
import { AuthCallbackScreen } from './AuthCallbackScreen';
import { SignInControl } from './SignInControl';

const oidc = vi.hoisted(() => ({
  current: {
    isLoading: false,
    isAuthenticated: false,
    error: undefined as Error | undefined,
    user: null as null | {
      id_token: string;
      profile: { sub: string; preferred_username?: string };
    },
    signinRedirect: vi.fn(async () => undefined),
    removeUser: vi.fn(async () => undefined),
  },
}));

vi.mock('react-oidc-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => oidc.current,
}));

function profile(): CharacterProfile {
  return {
    schemaVersion: 2,
    id: 'local-build',
    name: 'Local Build',
    level: 12,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 20, def: 4, agi: 4, vit: 8, luk: 0 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion: 'bootstrap-0',
  };
}

function SessionProbe() {
  const session = useAuthSession();
  return (
    <p>
      {session.status} · {session.signInUnavailableReason ?? 'sign-in ready'}
    </p>
  );
}

function SubjectProbe() {
  return <p>Subject: {useAuthSession().subject ?? 'none'}</p>;
}

beforeEach(() => {
  oidc.current.isLoading = false;
  oidc.current.isAuthenticated = false;
  oidc.current.error = undefined;
  oidc.current.user = null;
  oidc.current.signinRedirect.mockClear();
  oidc.current.removeUser.mockClear();
});

describe('optional authentication', () => {
  it('keeps the complete guest session available without a client ID', () => {
    render(
      <AuthProvider clientId={null}>
        <SessionProbe />
      </AuthProvider>,
    );

    expect(
      screen.getByText('guest · Authentication is not configured'),
    ).toBeVisible();
  });

  it('allows the fixed local test adapter to switch guest mode on demand', () => {
    render(
      <AuthProvider clientId={null} testToken="local-test-token">
        <SessionProbe />
        <SignInControl />
      </AuthProvider>,
    );

    expect(screen.getByText('guest · sign-in ready')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('authenticated · sign-in ready')).toBeVisible();
  });

  it('starts the configured redirect flow from the sign-in control', () => {
    render(
      <AuthProvider clientId="public-client-id">
        <SignInControl />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(oidc.current.signinRedirect).toHaveBeenCalledOnce();
  });

  it('exposes the stable OIDC subject for account-scoped local sync state', () => {
    oidc.current.isAuthenticated = true;
    oidc.current.user = {
      id_token: 'test-id-token',
      profile: { sub: 'oidc-account-42', preferred_username: 'Kirito' },
    };

    render(
      <AuthProvider clientId="public-client-id">
        <SubjectProbe />
      </AuthProvider>,
    );

    expect(screen.getByText('Subject: oidc-account-42')).toBeVisible();
  });

  it('shows callback progress and returns Home after authentication', () => {
    oidc.current.isLoading = true;
    const renderTree = () => (
      <AuthProvider clientId="public-client-id">
        <MemoryRouter initialEntries={['/auth/callback']}>
          <Routes>
            <Route path="/" element={<p>Home route</p>} />
            <Route path="/auth/callback" element={<AuthCallbackScreen />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
    const view = render(renderTree());
    expect(screen.getByText('Completing sign in…')).toBeVisible();

    oidc.current.isLoading = false;
    oidc.current.isAuthenticated = true;
    oidc.current.user = {
      id_token: 'test-id-token',
      profile: { sub: 'callback-account', preferred_username: 'Kirito' },
    };
    view.rerender(renderTree());

    expect(screen.getByText('Home route')).toBeVisible();
  });

  it('reports an auth error without deleting local builds', async () => {
    const store = createGuestBuildStore({
      databaseName: `auth-error-${crypto.randomUUID()}`,
    });
    await store.saveBuild(profile());
    oidc.current.error = new Error('Provider unavailable');

    render(
      <AuthProvider clientId="public-client-id">
        <SignInControl />
      </AuthProvider>,
    );

    expect(screen.getByText('Sign-in failed; guest mode is still available.')).toBeVisible();
    const builds = await store.listBuilds();
    expect(builds.find((result) => result.ok)?.value.profile.name).toBe(
      'Local Build',
    );
  });

  it('signs out without deleting local builds', async () => {
    const store = createGuestBuildStore({
      databaseName: `auth-signout-${crypto.randomUUID()}`,
    });
    await store.saveBuild(profile());
    oidc.current.isAuthenticated = true;
    oidc.current.user = {
      id_token: 'test-id-token',
      profile: { sub: 'signout-account', preferred_username: 'Asuna' },
    };

    render(
      <AuthProvider clientId="public-client-id">
        <SignInControl />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(oidc.current.removeUser).toHaveBeenCalledOnce();
    const builds = await store.listBuilds();
    expect(builds.find((result) => result.ok)?.value.profile.id).toBe(
      'local-build',
    );
  });
});
