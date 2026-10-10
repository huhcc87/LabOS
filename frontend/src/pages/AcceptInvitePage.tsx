import { useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import { AuthBrand } from '../components/AuthBrand';
import '../styles/auth.css';

interface Props {
  invite: string;
  onDone: () => void;
}

const errText = (e: unknown) =>
  (e as { data?: string })?.data ?? (e instanceof Error ? e.message : 'Something went wrong');

/** Opened from an invite or password-reset link: choose a password, then get signed in. */
export default function AcceptInvitePage({ invite, onDone }: Props) {
  const info = useQuery(api.invites.lookup, { invite });
  const accept = useAction(api.invites.accept);
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isReset = info?.kind === 'reset';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setBusy(true);
    setError('');
    try {
      const { email } = await accept({ invite, password });
      await login(email, password);
      onDone();
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <AuthBrand />
      <div className="auth-card">
        {info === undefined ? (
          <p className="auth-sub" role="status"><span className="auth-spinner" />Checking your link…</p>
        ) : info === null ? (
          <>
            <h1 className="auth-title">Link not valid</h1>
            <p className="auth-sub">This link is invalid, expired or already used. Ask your PI for a new invite, or use “Forgot password” on the sign-in page.</p>
            <button className="auth-btn" onClick={onDone}>Go to sign in</button>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <h1 className="auth-title">{isReset ? 'Choose a new password' : 'Join LabOS'}</h1>
            <p className="auth-sub">
              {isReset ? 'For ' : <>Welcome, <strong>{info.full_name}</strong>. Set a password for </>}
              <strong>{info.email}</strong>{isReset ? '.' : ' — you\'ll sign in with this email.'}
            </p>
            <div className="auth-field">
              <label className="auth-label" htmlFor="pw">Password</label>
              <input id="pw" type="password" className="auth-input" autoComplete="new-password" autoFocus
                value={password} onChange={e => setPassword(e.target.value)} />
              <div className="auth-hint">At least 8 characters, including a number.</div>
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="pw2">Confirm password</label>
              <input id="pw2" type="password" className="auth-input" autoComplete="new-password"
                value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <p className="auth-error" role="alert" style={{ marginBottom: 12 }}>{error}</p>}
            <button type="submit" className="auth-btn" disabled={busy || !password || !confirm}>
              {busy ? <><span className="auth-spinner" />Saving…</> : isReset ? 'Save and sign in' : 'Set password and sign in'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
