import {
  useCallback,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  AuthProvider as OidcAuthProvider,
  useAuth,
} from 'react-oidc-context';
import { appEnv } from '../../config/env';
import {
  clearAuthCallbackParameters,
  createAuthSettings,
} from '../../config/authConfig';
import {
  AuthSessionContext,
  type AuthSession,
  type AuthStatus,
} from './AuthContext';

const guestSession: AuthSession = {
  status: 'guest',
  signInUnavailableReason: 'Authentication is not configured',
  signIn: async () => undefined,
  signOut: async () => undefined,
};

type AuthProviderProps = PropsWithChildren<{
  clientId?: string | null;
  testToken?: string | null;
}>;

const testAuthStorageKey = 'sbo-rebirth-test-authenticated';

function LocalTestAuthProvider({
  children,
  token,
}: PropsWithChildren<{ token: string }>) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => window.localStorage.getItem(testAuthStorageKey) === 'true',
  );
  const session = useMemo<AuthSession>(
    () => ({
      status: isAuthenticated ? 'authenticated' : 'guest',
      preferredUsername: isAuthenticated ? 'Local Test Player' : undefined,
      idToken: isAuthenticated ? token : undefined,
      signIn: async () => {
        window.localStorage.setItem(testAuthStorageKey, 'true');
        setIsAuthenticated(true);
      },
      signOut: async () => {
        window.localStorage.removeItem(testAuthStorageKey);
        setIsAuthenticated(false);
      },
    }),
    [isAuthenticated, token],
  );

  return (
    <AuthSessionContext.Provider value={session}>
      {children}
    </AuthSessionContext.Provider>
  );
}

function ConfiguredSession({ children }: PropsWithChildren) {
  const auth = useAuth();
  const signIn = useCallback(async () => {
    await auth.signinRedirect();
  }, [auth.signinRedirect]);
  const signOut = useCallback(async () => {
    await auth.removeUser();
  }, [auth.removeUser]);

  const preferredUsername =
    typeof auth.user?.profile.preferred_username === 'string'
      ? auth.user.profile.preferred_username
      : undefined;
  let status: AuthStatus = 'guest';
  if (auth.isLoading) status = 'loading';
  else if (auth.error) status = 'error';
  else if (auth.isAuthenticated) status = 'authenticated';

  const session = useMemo<AuthSession>(
    () => ({
      status,
      preferredUsername,
      idToken: auth.user?.id_token,
      errorMessage: auth.error?.message,
      signIn,
      signOut,
    }),
    [
      auth.error?.message,
      auth.user?.id_token,
      preferredUsername,
      signIn,
      signOut,
      status,
    ],
  );

  return (
    <AuthSessionContext.Provider value={session}>
      {children}
    </AuthSessionContext.Provider>
  );
}

function ConfiguredAuthProvider({
  children,
  clientId,
}: PropsWithChildren<{ clientId: string }>) {
  const settings = useMemo(() => createAuthSettings(clientId), [clientId]);

  return (
    <OidcAuthProvider
      {...settings}
      onSigninCallback={clearAuthCallbackParameters}
    >
      <ConfiguredSession>{children}</ConfiguredSession>
    </OidcAuthProvider>
  );
}

export function AuthProvider({
  children,
  clientId = appEnv.spacetimeAuthClientId,
  testToken = appEnv.testAuthToken,
}: AuthProviderProps) {
  if (testToken) {
    return (
      <LocalTestAuthProvider token={testToken}>
        {children}
      </LocalTestAuthProvider>
    );
  }
  if (!clientId) {
    return (
      <AuthSessionContext.Provider value={guestSession}>
        {children}
      </AuthSessionContext.Provider>
    );
  }

  return (
    <ConfiguredAuthProvider clientId={clientId}>
      {children}
    </ConfiguredAuthProvider>
  );
}
