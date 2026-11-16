import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import { errText } from '../lib/errors';
import EmojiIcon from './EmojiIcon';

/** Shown in place of a hub the user can see but not open: ask the PI / admin for it. Approval happens in their account. */
export default function LockedHub({ hub, piName, onHome }: { hub: string; piName: string | null; onHome: () => void }) {
  const { token } = useAuth();
  const requests = useQuery(api.piAccess.myRequests, token ? { token } : 'skip');
  const request = useMutation(api.piAccess.requestAccess);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const last = requests?.find(r => r.hub === hub);
  const pending = last?.status === 'pending';

  const send = async () => {
    if (!token) return;
    setBusy(true);
    try { await request({ token, hub, note }); setNote(''); toast.success('Request sent'); }
    catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ maxWidth: 520, margin: '60px auto', padding: 32, textAlign: 'center' }}>
      <div style={{ marginBottom: 12, color: 'var(--text-muted)' }}><EmojiIcon glyph="🔒" size={36} /></div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{hub} is locked for your account</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        You can see everything in LabOS, but {piName ? `your PI (${piName})` : 'your PI or lab admin'} chooses what you can open. Ask for access and they will be notified.
      </p>
      {pending ? (
        <div role="status" style={{ padding: 12, borderRadius: 8, background: 'rgba(245,158,11,0.14)', fontSize: 13, marginBottom: 16 }}>⏳ Request sent. You will be notified when it is answered.</div>
      ) : (
        <>
          {last?.status === 'declined' && <div role="status" style={{ fontSize: 13, color: 'var(--bad-text)', marginBottom: 8 }}>Your last request was declined. You can ask again.</div>}
          <textarea aria-label="Why do you need this?" placeholder="Why do you need it? (optional)" value={note} onChange={e => setNote(e.target.value)} maxLength={300} rows={2}
            style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', marginBottom: 12 }} />
          <button className="btn btn-primary" disabled={busy} onClick={send} style={{ marginBottom: 12, width: '100%' }}>{busy ? 'Sending…' : `Request access to ${hub}`}</button>
        </>
      )}
      <button className="btn btn-secondary" onClick={onHome}>Go to Dashboard</button>
    </div>
  );
}
