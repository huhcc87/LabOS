import { useState, useEffect } from 'react';
import { API_BASE_URL as API } from '../lib/api';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
});

type CapaStatus = 'open' | 'in_progress' | 'pending_verification' | 'closed' | 'cancelled';
type CapaSeverity = 'critical' | 'major' | 'minor' | 'observation';

interface Capa {
  id: number;
  title: string;
  description: string;
  root_cause: string;
  corrective_action: string;
  preventive_action: string;
  source: string;
  reference_id: string;
  severity: CapaSeverity;
  status: CapaStatus;
  assigned_to: number | null;
  created_by: number | null;
  due_date: string;
  closed_at: string | null;
  verification_notes: string;
  created_at: string;
  updated_at: string;
}

const STATUS_META: Record<CapaStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: '#ef4444' },
  in_progress: { label: 'In Progress', color: '#f59e0b' },
  pending_verification: { label: 'Pending Verification', color: '#6366f1' },
  closed: { label: 'Closed', color: '#22c55e' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
};

const SEVERITY_META: Record<CapaSeverity, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#ef4444' },
  major: { label: 'Major', color: '#f59e0b' },
  minor: { label: 'Minor', color: '#6366f1' },
  observation: { label: 'Observation', color: '#22c55e' },
};

const SOURCES = ['audit', 'incident', 'complaint', 'self-inspection', 'deviation', 'customer-feedback', 'other'];
const STATUSES: CapaStatus[] = ['open', 'in_progress', 'pending_verification', 'closed', 'cancelled'];
const SEVERITIES: CapaSeverity[] = ['critical', 'major', 'minor', 'observation'];

const EMPTY_FORM = {
  title: '', description: '', root_cause: '', corrective_action: '',
  preventive_action: '', source: '', reference_id: '', severity: 'minor' as CapaSeverity,
  assigned_to: '' as string | number, due_date: '',
};

export default function CapaPage() {
  const [capas, setCapas] = useState<Capa[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [selected, setSelected] = useState<Capa | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<CapaStatus | ''>('');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ per_page: '100' });
    if (filterStatus) params.set('status', filterStatus);
    if (filterSeverity) params.set('severity', filterSeverity);
    const [r1, r2] = await Promise.all([
      fetch(`${API}/capa?${params}`, { headers: authHeaders() }),
      fetch(`${API}/capa/stats/summary`, { headers: authHeaders() }),
    ]);
    if (r1.ok) setCapas((await r1.json()).items ?? []);
    if (r2.ok) setStats(await r2.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterStatus, filterSeverity]);

  const submit = async () => {
    setSaving(true);
    const body = { ...form, assigned_to: form.assigned_to ? Number(form.assigned_to) : null };
    const res = await fetch(`${API}/capa`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
    });
    if (res.ok) { setShowForm(false); setForm({ ...EMPTY_FORM }); load(); }
    setSaving(false);
  };

  const updateCapa = async (id: number, patch: Record<string, any>) => {
    const res = await fetch(`${API}/capa/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setCapas(c => c.map(x => x.id === id ? updated : x));
      if (selected?.id === id) setSelected(updated);
      load();
    }
  };

  const deleteCapa = async (id: number) => {
    if (!confirm('Delete this CAPA record?')) return;
    await fetch(`${API}/capa/${id}`, { method: 'DELETE', headers: authHeaders() });
    setSelected(null);
    load();
  };

  const StatusBadge = ({ s }: { s: CapaStatus }) => (
    <span style={{
      background: STATUS_META[s].color + '22', color: STATUS_META[s].color,
      border: `1px solid ${STATUS_META[s].color}44`,
      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600,
    }}>{STATUS_META[s].label}</span>
  );

  const SevBadge = ({ s }: { s: CapaSeverity }) => (
    <span style={{
      background: SEVERITY_META[s].color + '22', color: SEVERITY_META[s].color,
      border: `1px solid ${SEVERITY_META[s].color}44`,
      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600,
    }}>{SEVERITY_META[s].label}</span>
  );

  const isOverdue = (c: Capa) =>
    c.due_date && c.due_date < new Date().toISOString().slice(0, 10) &&
    !['closed', 'cancelled'].includes(c.status);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>CAPA Management</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Corrective and Preventive Action tracking
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditMode(false); setForm({ ...EMPTY_FORM }); }}>
          + New CAPA
        </button>
      </div>

      {/* Summary cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total', val: stats.total, color: '#6366f1' },
            { label: 'Open', val: stats.by_status?.open ?? 0, color: '#ef4444' },
            { label: 'In Progress', val: stats.by_status?.in_progress ?? 0, color: '#f59e0b' },
            { label: 'Pending Verify', val: stats.by_status?.pending_verification ?? 0, color: '#8b5cf6' },
            { label: 'Closed', val: stats.by_status?.closed ?? 0, color: '#22c55e' },
            { label: 'Overdue', val: stats.overdue ?? 0, color: '#ef4444' },
          ].map(card => (
            <div key={card.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.val}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }}>
          <option value="">All severities</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_META[s].label}</option>)}
        </select>
        {(filterStatus || filterSeverity) && (
          <button onClick={() => { setFilterStatus(''); setFilterSeverity(''); }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Main layout: list + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 16 }}>
        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : capas.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No CAPA records found. Create one to get started.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['ID', 'Title', 'Source', 'Severity', 'Status', 'Due Date', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {capas.map(c => (
                  <tr key={c.id}
                    onClick={() => setSelected(c)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: selected?.id === c.id ? 'var(--bg-hover, rgba(99,102,241,.08))' : undefined,
                    }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>#{c.id}</td>
                    <td style={{ padding: '10px 12px', maxWidth: 240 }}>
                      <div style={{ fontWeight: 500 }}>{c.title}</div>
                      {isOverdue(c) && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>OVERDUE</span>}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{c.source || '—'}</td>
                    <td style={{ padding: '10px 12px' }}><SevBadge s={c.severity} /></td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge s={c.status} /></td>
                    <td style={{ padding: '10px 12px', color: isOverdue(c) ? '#ef4444' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {c.due_date || '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={e => { e.stopPropagation(); deleteCapa(c.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16 }} title="Delete">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card" style={{ padding: 20, overflow: 'auto', maxHeight: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>CAPA #{selected.id}</div>
                <h3 style={{ margin: 0, fontSize: 16 }}>{selected.title}</h3>
              </div>
              <button onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <StatusBadge s={selected.status} />
              <SevBadge s={selected.severity} />
              {isOverdue(selected) && (
                <span style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>OVERDUE</span>
              )}
            </div>

            {/* Quick status update */}
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-surface, rgba(0,0,0,.05))', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>Update Status</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <button key={s}
                    onClick={() => updateCapa(selected.id, { status: s })}
                    style={{
                      padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontWeight: 600,
                      background: selected.status === s ? STATUS_META[s].color : 'none',
                      color: selected.status === s ? '#fff' : STATUS_META[s].color,
                      border: `1px solid ${STATUS_META[s].color}`,
                    }}>
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
            </div>

            {[
              { label: 'Description', val: selected.description },
              { label: 'Root Cause', val: selected.root_cause },
              { label: 'Corrective Action', val: selected.corrective_action },
              { label: 'Preventive Action', val: selected.preventive_action },
              { label: 'Verification Notes', val: selected.verification_notes },
            ].map(({ label, val }) => val ? (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{val}</div>
              </div>
            ) : null)}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8, fontSize: 12 }}>
              {[
                { label: 'Source', val: selected.source },
                { label: 'Reference', val: selected.reference_id },
                { label: 'Due Date', val: selected.due_date },
                { label: 'Closed', val: selected.closed_at ? selected.closed_at.slice(0, 10) : '—' },
                { label: 'Created', val: selected.created_at.slice(0, 10) },
                { label: 'Updated', val: selected.updated_at.slice(0, 10) },
              ].map(({ label, val }) => val ? (
                <div key={label}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
                  <span style={{ textTransform: 'capitalize' }}>{val}</span>
                </div>
              ) : null)}
            </div>

            {/* Inline edit for verification notes */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>ADD VERIFICATION NOTES</div>
              <textarea
                key={selected.id}
                defaultValue={selected.verification_notes}
                rows={3}
                style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', padding: 8, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
                onBlur={e => {
                  if (e.target.value !== selected.verification_notes) {
                    updateCapa(selected.id, { verification_notes: e.target.value });
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Create form modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowForm(false)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 28,
            width: 600, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.4)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>New CAPA Record</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }} />
              </div>

              {[
                { key: 'source', label: 'Source', type: 'select', options: SOURCES },
                { key: 'severity', label: 'Severity', type: 'select', options: SEVERITIES },
                { key: 'reference_id', label: 'Reference ID', type: 'text' },
                { key: 'due_date', label: 'Due Date', type: 'date' },
              ].map(({ key, label, type, options }) => (
                <div key={key}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
                  {type === 'select' ? (
                    <select value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }}>
                      <option value="">— select —</option>
                      {options!.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace(/-/g, ' ')}</option>)}
                    </select>
                  ) : (
                    <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }} />
                  )}
                </div>
              ))}

              {[
                { key: 'description', label: 'Description' },
                { key: 'root_cause', label: 'Root Cause Analysis' },
                { key: 'corrective_action', label: 'Corrective Action' },
                { key: 'preventive_action', label: 'Preventive Action' },
              ].map(({ key, label }) => (
                <div key={key} style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
                  <textarea value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', resize: 'vertical' }} />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowForm(false)}
                style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submit} disabled={saving || !form.title}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: saving || !form.title ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Create CAPA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
