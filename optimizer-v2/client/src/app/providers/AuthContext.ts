import { createContext, useContext } from 'react';

export type AuthStatus = 'guest' | 'loading' | 'authenticated' | 'error';

export interface AuthSession {
  status: AuthStatus;
  subject?: string;
  preferredUsername?: string;
  idToken?: string;
  errorMessage?: string;
  signInUnavailableReason?: string;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

export const AuthSessionContext = createContext<AuthSession | null>(null);

export function useAuthSession(): AuthSession {
  const session = useContext(AuthSessionContext);
  if (!session) {
    throw new Error('useAuthSession must be used inside AuthProvider');
  }
  return session;
}
