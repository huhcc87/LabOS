import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../context/AuthContext';
import { errText } from '../../lib/errors';

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 3 };
const STATUS: Record<string, { text: string; color: string; bg: string }> = {
  reported: { text: 'Reported: waiting for PI/admin', color: '#b45309', bg: 'rgba(245,158,11,0.14)' },
  in_progress: { text: 'Being repaired', color: '#1d4ed8', bg: 'rgba(59,130,246,0.14)' },
  completed: { text: 'Fixed', color: '#15803d', bg: 'rgba(34,197,94,0.14)' },
};
const INSTRUMENT_STATE: Record<string, string> = { active: 'Active', available: 'Active', not_used: 'Not used', maintenance: 'Under repair' };
const stamp = (ms: number) => new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Instrument problems: anyone reports (with a note), PI/admin are notified and handle the repair. */
export default function MaintenancePanel() {
  const { token } = useAuth();
  const data = useQuery(api.maintenanceFlow.overview, token ? { token } : 'skip');
  const report = useMutation(api.maintenanceFlow.report);
  const setStatus = useMutation(api.maintenanceFlow.setStatus);
  const remove = useMutation(api.maintenanceFlow.remove);

  const [form, setForm] = useState<{ instrument: string; type: string; note: string; notWorking: boolean } | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); } catch (e) { toast.error(errText(e)); } };

  const send = async () => {
    if (!token || !form) return;
    if (!form.instrument) return toast.error('Choose the instrument.');
    if (!form.note.trim()) return toast.error('Write a short note about the problem.');
    setBusy(true);
    try {
      await report({ token, instrument_id: form.instrument as Id<'instruments'>, maintenance_type: form.type, note: form.note, not_working: form.notWorking });
      toast.success('Sent to the PI and admins.');
      setForm(null);
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const finish = (id: Id<'maintenance'>) => {
    const note = prompt('What was done? (optional, the reporter sees it)');
    if (note === null) return;
    act(() => setStatus({ token: token!, id, status: 'completed', note }), 'Marked fixed. The instrument is back in service.');
  };

  if (!data) return <div style={{ color: 'var(--text-muted)' }}>Loading…</div>;
  const shown = data.issues.filter((i) => filter === 'all' || i.status !== 'completed');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as 'open' | 'all')} style={{ ...input, width: 'auto' }}>
          <option value="open">Open problems</option>
          <option value="all">All reports</option>
        </select>
        <button className="btn btn-primary" onClick={() => setForm({ instrument: '', type: 'repair', note: '', notWorking: true })}>🔧 Report a problem</button>
      </div>

      {form && (
        <div className="card" role="region" aria-label="Report a problem" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={lbl} htmlFor="mt-inst">Instrument</label>
              <select id="mt-inst" value={form.instrument} onChange={(e) => setForm({ ...form, instrument: e.target.value })} style={input}>
                <option value="">Select an instrument…</option>
                {data.instruments.map((i) => <option key={i._id} value={i._id}>{i.name}{i.location ? ` (${i.location})` : ''} — {INSTRUMENT_STATE[i.status] ?? i.status}</option>)}
              </select>
              {data.instruments.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>No instruments yet. Add one in Instruments &amp; Booking first.</div>}
            </div>
            <div>
              <label style={lbl} htmlFor="mt-type">What is needed</label>
              <select id="mt-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={input}>
                <option value="repair">Repair</option><option value="service">Service / maintenance</option><option value="calibration">Calibration</option>
              </select>
            </div>
          </div>
          <label style={lbl} htmlFor="mt-note">Note: what is wrong?</label>
          <textarea id="mt-note" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Lid will not close, error E4 on the screen" style={{ ...input, marginBottom: 10 }} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
            <input type="checkbox" checked={form.notWorking} onChange={(e) => setForm({ ...form, notWorking: e.target.checked })} />
            It is not working: mark it "Under repair" everywhere in the app (it can't be booked) until it is fixed
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send to PI / admin'}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>{data.issues.length === 0 ? 'No problems reported. If an instrument is not working, press "Report a problem".' : 'No open problems.'}</div>
      ) : shown.map((m) => {
        const st = STATUS[m.status] ?? { text: m.status, color: 'var(--text-muted)', bg: 'var(--surface2)' };
        return (
          <div key={m._id} className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700 }}>{m.instrument_name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {m.maintenance_type}{m.not_working ? ' · not working' : ''}</span></div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {[m.location && `Where: ${m.location}`, `Reported ${stamp(m.created_at)} by ${m.reporter}`, m.completed_date && `fixed ${stamp(m.completed_date)}${m.handler ? ` by ${m.handler}` : ''}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg }}>{st.text}</span>
              {data.can_handle && m.status === 'reported' && <button className="btn btn-secondary btn-sm" onClick={() => act(() => setStatus({ token: token!, id: m._id, status: 'in_progress' }), 'Marked as being repaired')}>Start repair</button>}
              {data.can_handle && m.status !== 'completed' && <button className="btn btn-primary btn-sm" onClick={() => finish(m._id)}>✓ Mark fixed</button>}
              {m.can_delete && <button className="btn btn-secondary btn-sm" aria-label={`Delete report for ${m.instrument_name}`} onClick={() => { if (confirm('Delete this report?')) act(() => remove({ token: token!, id: m._id }), 'Deleted'); }}>🗑</button>}
            </div>
            {m.notes && <div style={{ marginTop: 8, fontSize: 13 }}>“{m.notes}”</div>}
            {m.resolution_note && <div style={{ marginTop: 4, fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>Fix note: {m.resolution_note}</div>}
          </div>
        );
      })}
    </div>
  );
}
