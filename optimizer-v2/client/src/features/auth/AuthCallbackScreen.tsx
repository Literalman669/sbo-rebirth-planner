import { Link, Navigate } from 'react-router-dom';
import { useAuthSession } from '../../app/providers/AuthContext';

export function AuthCallbackScreen() {
  const session = useAuthSession();

  if (session.status === 'authenticated') {
    return <Navigate to="/" replace />;
  }
  if (session.status === 'error') {
    return (
      <main className="auth-callback panel-frame">
        <h2>Sign-in could not be completed</h2>
        <p>{session.errorMessage ?? 'The identity provider returned an error.'}</p>
        <Link className="primary-action" to="/">
          Continue as guest
        </Link>
      </main>
    );
  }
  if (session.status === 'guest') {
    return (
      <main className="auth-callback panel-frame">
        <h2>Sign-in was not completed</h2>
        <Link className="primary-action" to="/">
          Continue as guest
        </Link>
      </main>
    );
  }

  return (
    <main className="auth-callback panel-frame" aria-live="polite">
      <h2>Completing sign in…</h2>
      <p>Returning you to your build archive.</p>
    </main>
  );
}
