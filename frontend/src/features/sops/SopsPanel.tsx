import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../context/AuthContext';
import { errText } from '../../lib/errors';

const CATEGORIES = ['Safety', 'Quality', 'Operations', 'Equipment'];
const STATUS: Record<string, { text: string; color: string; bg: string }> = {
  pending: { text: 'Waiting for PI approval', color: '#b45309', bg: 'rgba(245,158,11,0.14)' },
  approved: { text: 'Approved', color: '#15803d', bg: 'rgba(34,197,94,0.14)' },
  rejected: { text: 'Rejected', color: '#b91c1c', bg: 'rgba(220,38,38,0.12)' },
};
const size = (n?: number) => (n ? (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : '');

/** SOPs: anyone uploads a file, a PI approves it. One list per category. */
export default function SopsPanel() {
  const { token } = useAuth();
  const data = useQuery(api.sops.overview, token ? { token } : 'skip');
  const makeUrl = useMutation(api.sops.generateUploadUrl);
  const save = useMutation(api.sops.upload);
  const decide = useMutation(api.sops.decide);
  const remove = useMutation(api.sops.remove);

  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [form, setForm] = useState<{ title: string; category: string; version: string; file: File | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const sops = data?.sops ?? [];
  const categories = useMemo(() => [...new Set([...CATEGORIES, ...sops.map((s) => s.category ?? 'Other')])], [sops]);
  const shown = sops.filter((s) => (cat === 'all' || (s.category ?? 'Other') === cat) && s.title.toLowerCase().includes(search.trim().toLowerCase()));

  const submit = async () => {
    if (!token || !form) return;
    if (!form.title.trim()) return toast.error('Enter a title.');
    if (!form.file) return toast.error('Choose a file to upload.');
    setBusy(true);
    try {
      const url = await makeUrl({ token });
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': form.file.type || 'application/octet-stream' }, body: form.file });
      if (!res.ok) throw new Error('Upload failed. Try again.');
      const { storageId } = await res.json();
      await save({ token, title: form.title, category: form.category, version: form.version, storage_id: storageId as Id<'_storage'>, file_name: form.file.name });
      toast.success('Uploaded. A PI needs to approve it.');
      setForm(null);
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); } catch (e) { toast.error(errText(e)); } };
  const reject = (id: Id<'sops'>) => {
    const note = prompt('Why is this rejected? (the uploader sees it)');
    if (note === null) return;
    act(() => decide({ token: token!, id, decision: 'reject', note }), 'Rejected');
  };

  const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input aria-label="Search SOPs" placeholder="Search SOPs…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...input, width: 220 }} />
          <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} style={input}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ title: '', category: CATEGORIES[0], version: '1.0', file: null })}>⬆ Upload SOP</button>
      </div>

      {form && (
        <div className="card" role="region" aria-label="Upload SOP" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <input aria-label="Title" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={input} />
            <select aria-label="Upload category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={input}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input aria-label="Version" placeholder="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} style={input} />
            <input aria-label="SOP file" type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} style={input} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0' }}>PDF, Word or text, up to 25 MB. A PI approves it before it counts as current.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}

      {!data ? <div style={{ color: 'var(--text-muted)' }}>Loading…</div> : shown.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>{sops.length === 0 ? 'No SOPs yet. Upload the first one.' : 'No SOPs match.'}</div>
      ) : categories.filter((c) => shown.some((s) => (s.category ?? 'Other') === c)).map((c) => (
        <section key={c} aria-label={c} className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
          <h3 style={{ margin: 0, padding: '10px 14px', fontSize: 14, background: 'var(--surface2)' }}>{c} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({shown.filter((s) => (s.category ?? 'Other') === c).length})</span></h3>
          {shown.filter((s) => (s.category ?? 'Other') === c).map((s) => {
            const st = STATUS[s.status] ?? { text: s.status, color: 'var(--text-muted)', bg: 'var(--surface2)' };
            return (
              <div key={s._id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 600 }}>{s.title} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>v{s.version}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {[s.file_name && `${s.file_name} ${size(s.file_size)}`, `uploaded by ${s.uploaded_by}`, new Date(s.created_at).toLocaleDateString(), s.approved_by_name && `${s.status === 'rejected' ? 'rejected' : 'approved'} by ${s.approved_by_name}`].filter(Boolean).join(' · ')}
                  </div>
                  {s.decision_note && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>“{s.decision_note}”</div>}
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg }}>{st.text}</span>
                {s.url && <a className="btn btn-secondary btn-sm" href={s.url} target="_blank" rel="noreferrer">Open</a>}
                {data.can_approve && s.status === 'pending' && (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => act(() => decide({ token: token!, id: s._id, decision: 'approve' }), 'Approved')}>✓ Approve</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => reject(s._id)}>✕ Reject</button>
                  </>
                )}
                {s.can_delete && (
                  <button className="btn btn-secondary btn-sm" aria-label={`Delete ${s.title}`} onClick={() => { if (confirm(`Delete "${s.title}"?`)) act(() => remove({ token: token!, id: s._id }), 'Deleted'); }}>🗑 Delete</button>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
