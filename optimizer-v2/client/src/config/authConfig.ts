import { WebStorageStateStore, type UserManagerSettings } from 'oidc-client-ts';

export function clearAuthCallbackParameters(): void {
  window.history.replaceState({}, document.title, window.location.pathname);
}

export function createAuthSettings(clientId: string): UserManagerSettings {
  if (!clientId) {
    throw new Error(
      'VITE_SPACETIMEAUTH_CLIENT_ID is required to enable sign-in',
    );
  }
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  return {
    authority: 'https://auth.spacetimedb.com/oidc',
    client_id: clientId,
    redirect_uri: new URL('auth/callback', base).toString(),
    post_logout_redirect_uri: base.toString(),
    response_type: 'code',
    scope: 'openid profile',
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  };
}
