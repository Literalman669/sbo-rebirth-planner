import { describe, expect, it } from 'vitest';
import {
  clearAuthCallbackParameters,
  createAuthSettings,
} from './authConfig';

describe('createAuthSettings', () => {
  it('uses Authorization Code with PKCE-compatible public browser settings', () => {
    const settings = createAuthSettings('public-client-id');

    expect(settings).toMatchObject({
      authority: 'https://auth.spacetimedb.com/oidc',
      client_id: 'public-client-id',
      response_type: 'code',
      scope: 'openid profile',
      automaticSilentRenew: true,
    });
    expect(settings.redirect_uri).toBe('http://localhost:3000/auth/callback');
    expect(settings.post_logout_redirect_uri).toBe('http://localhost:3000/');
    expect(settings.scope).not.toContain('email');
    expect(settings).not.toHaveProperty('client_secret');
  });

  it('rejects an empty client ID', () => {
    expect(() => createAuthSettings('')).toThrow(
      'VITE_SPACETIMEAUTH_CLIENT_ID is required to enable sign-in',
    );
  });

  it('removes processed OIDC query parameters without leaving the callback route', () => {
    window.history.pushState({}, '', '/auth/callback?code=abc&state=xyz');

    clearAuthCallbackParameters();

    expect(window.location.pathname).toBe('/auth/callback');
    expect(window.location.search).toBe('');
  });
});
