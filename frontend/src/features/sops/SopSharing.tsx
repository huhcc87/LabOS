import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../context/AuthContext';
import { errText } from '../../lib/errors';

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const PERMS = { view: 'Can view', view_download: 'Can view and download' } as const;

/** Owner side: share one SOP with a collaborator on LabOS, set permission + how to cite, see and revoke shares. */
export function ShareSopPanel({ sop, onClose }: { sop: { _id: Id<'sops'>; title: string; version: string }; onClose: () => void }) {
  const { token } = useAuth();
  const shares = useQuery(api.sopSharing.sharesOf, token ? { token, sop_id: sop._id } : 'skip');
  const share = useMutation(api.sopSharing.share);
  const revoke = useMutation(api.sopSharing.revoke);
  const [email, setEmail] = useState('');
  const [perm, setPerm] = useState<keyof typeof PERMS>('view');
  const [citation, setCitation] = useState(`${sop.title} (v${sop.version}). Developed by [your lab name]. Shared via LabOS, ${new Date().getFullYear()}. [DOI or paper, if published]`);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!token) return;
    if (!email.trim()) return toast.error('Enter your collaborator’s LabOS email.');
    setBusy(true);
    try {
      const r = await share({ token, sop_id: sop._id, email, permission: perm, citation, note: note || undefined });
      toast.success(`Shared with ${r.to} (${r.lab})`);
      setEmail(''); setNote('');
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  return (
    <div className="card" role="region" aria-label={`Share ${sop.title}`} style={{ padding: 16, margin: '0 14px 12px', borderLeft: '4px solid var(--accent)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <strong>Share “{sop.title}” with a collaborator on LabOS</strong>
        <button className="btn btn-sm btn-secondary" onClick={onClose}>Close</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Collaborator’s LabOS email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@university.edu" style={{ ...input, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Permission
          <select value={perm} onChange={(e) => setPerm(e.target.value as keyof typeof PERMS)} style={{ ...input, marginTop: 4 }}>
            {Object.entries(PERMS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginTop: 10 }}>How they must cite it (shown to them every time)
        <textarea value={citation} onChange={(e) => setCitation(e.target.value)} rows={2} style={{ ...input, marginTop: 4, resize: 'vertical' }} />
      </label>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginTop: 10 }}>Note (optional)
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please don’t redistribute before publication" style={{ ...input, marginTop: 4 }} />
      </label>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0' }}>
        Their whole lab can see it, at the permission you choose. They get a notification. You can revoke access any time.
      </p>
      <button className="btn btn-primary btn-sm" onClick={send} disabled={busy}>{busy ? 'Sharing…' : 'Share'}</button>

      <h4 style={{ fontSize: 13, margin: '16px 0 6px' }}>Shared with</h4>
      {!shares ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
        : shares.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not shared with anyone yet.</div>
        : shares.map((s) => (
          <div key={s._id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, padding: '6px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <span style={{ flex: 1 }}><strong>{s.to_name}</strong> · {s.to_lab} · {PERMS[s.permission]} · since {new Date(s.created_at).toLocaleDateString()}</span>
            <button className="btn btn-sm btn-secondary" onClick={async () => {
              if (!confirm(`Stop sharing with ${s.to_lab}?`)) return;
              try { await revoke({ token: token!, share_id: s._id }); toast.success('Access revoked'); } catch (e) { toast.error(errText(e)); }
            }}>Revoke</button>
          </div>
        ))}
    </div>
  );
}

/** Receiving side: SOPs and protocols other labs shared with us, with the citation they asked for. */
export function SharedWithUs() {
  const { token } = useAuth();
  const rows = useQuery(api.sopSharing.sharedWithUs, token ? { token } : 'skip');
  if (!rows || rows.length === 0) return null;
  return (
    <section aria-label="Shared with our lab" className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
      <h3 style={{ margin: 0, padding: '10px 14px', fontSize: 14, background: 'var(--surface2)' }}>
        Shared with our lab <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({rows.length})</span>
      </h3>
      {rows.map((s) => (
        <div key={s._id} style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 600 }}>{s.title} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>v{s.version}</span></div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>From {s.from_lab} · shared by {s.shared_by} · {new Date(s.shared_at).toLocaleDateString()} · {PERMS[s.permission]}</div>
            </div>
            {s.url && <a className="btn btn-secondary btn-sm" href={s.url} target="_blank" rel="noreferrer">Open / download</a>}
          </div>
          {s.note && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 4 }}>“{s.note}”</div>}
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.08)', fontSize: 12 }}>
            <strong>Cite as:</strong> {s.citation}
            <button className="btn btn-sm btn-secondary" style={{ marginLeft: 8 }} onClick={() => { navigator.clipboard?.writeText(s.citation); toast.success('Citation copied'); }}>Copy</button>
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Use and cite as above in any protocol, paper or report that relies on it. Don’t pass it on outside your lab without the owner’s permission.</div>
          </div>
          {s.content && <details style={{ marginTop: 6, fontSize: 13 }}><summary style={{ cursor: 'pointer' }}>Read the SOP text</summary><div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{s.content}</div></details>}
        </div>
      ))}
    </section>
  );
}
