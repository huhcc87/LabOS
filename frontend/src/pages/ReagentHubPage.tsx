import { useState, useEffect } from 'react';
import axios from 'axios';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExpiryItem {
  id: number;
  name: string;
  category: string;
  lot_number: string;
  expires_on: string;
  quantity: number;
  unit: string;
  storage_location: string;
  hazard_class: string;
  cas_number: string;
}

interface ExpiryAlerts {
  expired: ExpiryItem[];
  critical: ExpiryItem[];
  warning: ExpiryItem[];
  upcoming: ExpiryItem[];
  total_expiring: number;
}

interface SDSItem {
  id: number;
  name: string;
  cas_number: string;
  hazard_class: string;
  sds_url: string;
  msds_available: boolean;
  storage_temp: string;
  storage_location: string;
}

interface SDSStatus {
  with_sds: SDSItem[];
  without_sds: SDSItem[];
  compliance_pct: number;
}

interface DisposalLog {
  id: number;
  reagent_name: string;
  lot_number: string;
  quantity_disposed: string;
  disposal_method: string;
  hazard_class: string;
  reason: string;
  disposed_by: number | null;
  notes: string;
  disposed_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeaders() {
  const t = localStorage.getItem('access_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr);
  return Math.round((exp.getTime() - today.getTime()) / 86400000);
}

function ExpiryBadge({ dateStr }: { dateStr: string }) {
  const d = daysUntil(dateStr);
  let bg = '#22c55e20', color = '#22c55e', label = `${d}d`;
  if (d < 0) { bg = '#ef444420'; color = '#ef4444'; label = 'EXPIRED'; }
  else if (d <= 30) { bg = '#ef444420'; color = '#ef4444'; label = `${d}d`; }
  else if (d <= 60) { bg = '#f59e0b20'; color = '#f59e0b'; label = `${d}d`; }
  return (
    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color }}>
      {label}
    </span>
  );
}

const HAZARD_COLORS: Record<string, string> = {
  Flammable: '#f59e0b', Corrosive: '#ef4444', Toxic: '#8b5cf6',
  Oxidizer: '#06b6d4', Biohazard: '#ec4899', Irritant: '#f97316',
};

function HazardBadge({ cls }: { cls: string }) {
  if (!cls) return null;
  const color = HAZARD_COLORS[cls] || '#64748b';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${color}20`, color }}>
      {cls}
    </span>
  );
}

const DISPOSAL_METHODS = ['Incineration', 'Drain disposal (dilute)', 'EHS pickup', 'Autoclave', 'Sharps container', 'Solid waste', 'Return to supplier', 'Other'];
const DISPOSAL_REASONS = ['Expired', 'Degraded quality', 'Excess inventory', 'Protocol change', 'Contaminated', 'Other'];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReagentHubPage() {
  const [tab, setTab] = useState<'expiry' | 'sds' | 'disposal'>('expiry');
  const [expiry, setExpiry] = useState<ExpiryAlerts | null>(null);
  const [sdsStatus, setSdsStatus] = useState<SDSStatus | null>(null);
  const [disposalLogs, setDisposalLogs] = useState<DisposalLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expiryDays, setExpiryDays] = useState(90);
  const [sdsFilter, setSdsFilter] = useState<'all' | 'missing' | 'present'>('all');

  // Disposal form state
  const [showDisposalForm, setShowDisposalForm] = useState(false);
  const [form, setForm] = useState({
    reagent_name: '', lot_number: '', quantity_disposed: '',
    disposal_method: 'EHS pickup', hazard_class: '', reason: 'Expired', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [tab, expiryDays]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'expiry') {
        const r = await axios.get(`/api/reagents/expiry-alerts?days=${expiryDays}`, { headers: authHeaders() });
        setExpiry(r.data);
      } else if (tab === 'sds') {
        const r = await axios.get('/api/reagents/sds-status', { headers: authHeaders() });
        setSdsStatus(r.data);
      } else {
        const r = await axios.get('/api/reagents/disposal-log?per_page=100', { headers: authHeaders() });
        setDisposalLogs(r.data.items || []);
      }
    } catch {
      // backend might not be running; show empty state
    }
    setLoading(false);
  }

  async function submitDisposal() {
    if (!form.reagent_name || !form.quantity_disposed || !form.disposal_method) return;
    setSubmitting(true);
    try {
      await axios.post('/api/reagents/disposal-log', form, { headers: authHeaders() });
      setForm({ reagent_name: '', lot_number: '', quantity_disposed: '', disposal_method: 'EHS pickup', hazard_class: '', reason: 'Expired', notes: '' });
      setShowDisposalForm(false);
      loadData();
    } catch {
      // handle error
    }
    setSubmitting(false);
  }

  async function deleteLog(id: number) {
    if (!confirm('Delete this disposal record?')) return;
    await axios.delete(`/api/reagents/disposal-log/${id}`, { headers: authHeaders() });
    setDisposalLogs(prev => prev.filter(l => l.id !== id));
  }

  const tabStyle = (t: string) => ({
    padding: '8px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: tab === t ? 'var(--primary, #6366f1)' : 'transparent',
    color: tab === t ? '#fff' : 'var(--text-muted, #64748b)',
    transition: 'all 0.15s',
  } as React.CSSProperties);

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>⚗️ Reagent Safety Hub</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Expiry tracking · SDS compliance · Disposal records</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface-raised, #f8fafc)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        <button style={tabStyle('expiry')} onClick={() => setTab('expiry')}>⏰ Expiry Alerts</button>
        <button style={tabStyle('sds')} onClick={() => setTab('sds')}>📋 SDS Tracker</button>
        <button style={tabStyle('disposal')} onClick={() => setTab('disposal')}>🗑 Disposal Log</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>}

      {/* ── Expiry Alerts Tab ─────────────────────────────────────────────── */}
      {!loading && tab === 'expiry' && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Expired', count: expiry?.expired.length ?? 0, color: '#ef4444', bg: '#ef444415' },
              { label: '0–30 days', count: expiry?.critical.length ?? 0, color: '#ef4444', bg: '#ef444415' },
              { label: '31–60 days', count: expiry?.warning.length ?? 0, color: '#f59e0b', bg: '#f59e0b15' },
              { label: '61–90 days', count: expiry?.upcoming.length ?? 0, color: '#22c55e', bg: '#22c55e15' },
            ].map(c => (
              <div key={c.label} className="card" style={{ background: c.bg, borderColor: c.color + '40', textAlign: 'center', padding: '16px 12px' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.count}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: c.color }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Window selector */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Show expiring within:</span>
            {[30, 60, 90, 180].map(d => (
              <button key={d} onClick={() => setExpiryDays(d)} style={{
                padding: '4px 12px', borderRadius: 6, border: `1px solid ${expiryDays === d ? '#6366f1' : 'var(--border)'}`,
                background: expiryDays === d ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: expiryDays === d ? '#6366f1' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>{d} days</button>
            ))}
          </div>

          {/* Items list */}
          {(['expired', 'critical', 'warning', 'upcoming'] as const).map(tier => {
            const items = expiry?.[tier] ?? [];
            if (items.length === 0) return null;
            const label = { expired: '🔴 Expired', critical: '🟠 Expiring in 0–30 days', warning: '🟡 Expiring in 31–60 days', upcoming: '🟢 Expiring in 61–90 days' }[tier];
            return (
              <div key={tier} className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label} — {items.length} items</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-raised, #f8fafc)', borderBottom: '1px solid var(--border)' }}>
                        {['Name', 'Lot', 'Expires', 'Qty', 'Location', 'Hazard'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.name}<br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.cas_number}</span></td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>{item.lot_number || '—'}</td>
                          <td style={{ padding: '8px 12px' }}><ExpiryBadge dateStr={item.expires_on} /><br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.expires_on}</span></td>
                          <td style={{ padding: '8px 12px' }}>{item.quantity} {item.unit}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{item.storage_location || '—'}</td>
                          <td style={{ padding: '8px 12px' }}><HazardBadge cls={item.hazard_class} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {expiry && expiry.total_expiring === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              ✅ No reagents expiring within {expiryDays} days
            </div>
          )}
        </>
      )}

      {/* ── SDS Tracker Tab ───────────────────────────────────────────────── */}
      {!loading && tab === 'sds' && sdsStatus && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div className="card" style={{ textAlign: 'center', padding: '16px 12px', background: '#22c55e15', borderColor: '#22c55e40' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e' }}>{sdsStatus.compliance_pct}%</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>SDS Compliance</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '16px 12px', background: '#6366f115', borderColor: '#6366f140' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#6366f1' }}>{sdsStatus.with_sds.length}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6366f1' }}>SDS Available</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '16px 12px', background: '#ef444415', borderColor: '#ef444440' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>{sdsStatus.without_sds.length}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>SDS Missing</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {(['all', 'missing', 'present'] as const).map(f => (
              <button key={f} onClick={() => setSdsFilter(f)} style={{
                padding: '4px 12px', borderRadius: 6, border: `1px solid ${sdsFilter === f ? '#6366f1' : 'var(--border)'}`,
                background: sdsFilter === f ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: sdsFilter === f ? '#6366f1' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>{f === 'all' ? 'All' : f === 'missing' ? '⚠ Missing SDS' : '✅ Has SDS'}</button>
            ))}
          </div>

          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'CAS Number', 'Hazard Class', 'Storage', 'SDS Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...(sdsFilter !== 'missing' ? sdsStatus.with_sds : []), ...(sdsFilter !== 'present' ? sdsStatus.without_sds : [])].map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{item.cas_number || '—'}</td>
                    <td style={{ padding: '8px 12px' }}><HazardBadge cls={item.hazard_class} /></td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{item.storage_temp || '—'} · {item.storage_location || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {item.sds_url ? (
                        <a href={item.sds_url} target="_blank" rel="noreferrer" style={{ color: '#6366f1', fontSize: 12, fontWeight: 600 }}>📄 View SDS</a>
                      ) : item.msds_available ? (
                        <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>✅ On file</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>⚠ Missing</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Disposal Log Tab ──────────────────────────────────────────────── */}
      {!loading && tab === 'disposal' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowDisposalForm(true)} style={{
              padding: '8px 18px', background: '#6366f1', color: '#fff', border: 'none',
              borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>+ Log Disposal</button>
          </div>

          {/* Disposal form */}
          {showDisposalForm && (
            <div className="card" style={{ marginBottom: 20, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-muted)', textTransform: 'uppercase' }}>🗑 New Disposal Record</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {[
                  { key: 'reagent_name', label: 'Reagent Name *', type: 'text', placeholder: 'e.g. Ethanol 95%' },
                  { key: 'lot_number', label: 'Lot Number', type: 'text', placeholder: 'ABC123' },
                  { key: 'quantity_disposed', label: 'Quantity Disposed *', type: 'text', placeholder: '500 mL' },
                  { key: 'hazard_class', label: 'Hazard Class', type: 'text', placeholder: 'Flammable' },
                  { key: 'notes', label: 'Notes', type: 'text', placeholder: 'Additional details' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input
                      type={f.type} placeholder={f.placeholder}
                      value={(form as any)[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)' }}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Disposal Method *</label>
                  <select value={form.disposal_method} onChange={e => setForm(p => ({ ...p, disposal_method: e.target.value }))}
                    style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, width: '100%', background: 'var(--bg)', color: 'var(--text)' }}>
                    {DISPOSAL_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Reason</label>
                  <select value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                    style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, width: '100%', background: 'var(--bg)', color: 'var(--text)' }}>
                    {DISPOSAL_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowDisposalForm(false)} style={{ padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 7, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button onClick={submitDisposal} disabled={submitting || !form.reagent_name || !form.quantity_disposed}
                  style={{ padding: '7px 18px', background: submitting ? '#94a3b8' : '#6366f1', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {submitting ? 'Saving…' : 'Save Record'}
                </button>
              </div>
            </div>
          )}

          {/* Log table */}
          {disposalLogs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No disposal records yet. Click "+ Log Disposal" to add one.
            </div>
          ) : (
            <div className="card">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                    {['Reagent', 'Lot', 'Qty Disposed', 'Method', 'Reason', 'Hazard', 'Date', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {disposalLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{log.reagent_name}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{log.lot_number || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{log.quantity_disposed}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{log.disposal_method}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{log.reason}</td>
                      <td style={{ padding: '8px 12px' }}><HazardBadge cls={log.hazard_class} /></td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.disposed_at).toLocaleDateString()}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <button onClick={() => deleteLog(log.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
