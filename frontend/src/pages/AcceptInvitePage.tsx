import { useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';

interface Props {
  invite: string;
  onDone: () => void;
}

const errText = (e: unknown) =>
  (e as { data?: string })?.data ?? (e instanceof Error ? e.message : 'Something went wrong');

/** Opened from an invite link: the invited person sets their own password, then is signed in. */
export default function AcceptInvitePage({ invite, onDone }: Props) {
  const info = useQuery(api.invites.lookup, { invite });
  const accept = useAction(api.invites.accept);
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 28 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⬡</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Join LabOS</h1>

        {info === undefined ? (
          <p style={{ color: 'var(--text-muted)' }}>Checking your invite…</p>
        ) : info === null ? (
          <>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
              This invite link is invalid, expired or already used. Ask your PI to send a new one.
            </p>
            <button className="btn btn-secondary" onClick={onDone}>Go to sign in</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
              Welcome, <strong style={{ color: 'var(--text)' }}>{info.full_name}</strong>. Choose a password for{' '}
              <strong style={{ color: 'var(--text)' }}>{info.email}</strong> — you'll sign in with this email from now on.
            </p>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Password</label>
            <input type="password" className="form-input" autoComplete="new-password" required minLength={8}
              value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Confirm password</label>
            <input type="password" className="form-input" autoComplete="new-password" required minLength={8}
              value={confirm} onChange={e => setConfirm(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>At least 8 characters, including a number.</div>
            {error && <div role="alert" style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Setting up…' : 'Set password & sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
