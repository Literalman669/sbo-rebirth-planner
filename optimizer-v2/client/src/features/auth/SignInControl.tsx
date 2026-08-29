import { useAuthSession } from '../../app/providers/AuthContext';

export function SignInControl() {
  const session = useAuthSession();

  if (session.status === 'authenticated') {
    return (
      <div className="auth-control">
        <span>{session.preferredUsername ?? 'Signed in'}</span>
        <button type="button" onClick={() => void session.signOut()}>
          Sign out
        </button>
      </div>
    );
  }
  if (session.status === 'error') {
    return (
      <div className="auth-control auth-control--error">
        <span>Sign-in failed; guest mode is still available.</span>
        <button type="button" onClick={() => void session.signIn()}>
          Retry sign in
        </button>
      </div>
    );
  }
  if (session.status === 'loading') {
    return (
      <button className="auth-button" type="button" disabled>
        Signing in…
      </button>
    );
  }

  return (
    <button
      className="auth-button"
      type="button"
      disabled={Boolean(session.signInUnavailableReason)}
      title={session.signInUnavailableReason}
      onClick={() => void session.signIn()}
    >
      Sign in
    </button>
  );
}
