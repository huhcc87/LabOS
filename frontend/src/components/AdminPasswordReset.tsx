import { useState } from 'react';
import { useAction } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';

interface Props {
  onDone: (message: string, type: 'success' | 'error') => void;
}

export function AdminPasswordReset({ onDone }: Props) {
  const { token } = useAuth();
  const resetPassword = useAction(api.customAuth.adminResetPassword);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      await resetPassword({ token, target_email: email, new_password: newPassword });
      onDone(`Password reset for ${email}.`, 'success');
      setEmail('');
      setNewPassword('');
    } catch (err) {
      const msg = err instanceof ConvexError && typeof err.data === 'string' ? err.data : 'Password reset failed.';
      onDone(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13 };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div>
        <label style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>User Email</label>
        <input type="email" required style={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@lab.local" />
      </div>
      <div>
        <label style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>New Password</label>
        <input type="password" required minLength={8} style={inp} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters, 1 digit" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Resetting…' : 'Reset Password'}
      </button>
    </form>
  );
}
