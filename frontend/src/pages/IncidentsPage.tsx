import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { incidentsApi } from '../lib/api';
import type { IncidentReport } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePagedApi } from '../hooks/useApi';
import { formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'];
const STATUS_OPTIONS = ['open', 'under_review', 'resolved', 'closed'];

const SEVERITY_META: Record<string, { color: string; bg: string; icon: string }> = {
  low: { color: '#16a34a', bg: '#dcfce7', icon: '●' },
  medium: { color: '#d97706', bg: '#fef3c7', icon: '●' },
  high: { color: '#ea580c', bg: '#ffedd5', icon: '▲' },
  critical: { color: '#dc2626', bg: '#fee2e2', icon: '🚨' },
};

const STATUS_META: Record<string, { color: string; bg: string }> = {
  open: { color: '#ef4444', bg: '#fee2e2' },
  under_review: { color: '#f59e0b', bg: '#fef3c7' },
  resolved: { color: '#22c55e', bg: '#dcfce7' },
  closed: { color: '#94a3b8', bg: '#f1f5f9' },
};

export default function IncidentsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('staff');
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<IncidentReport>(
    (p, pp, s) => incidentsApi.list(p, pp, s)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IncidentReport | null>(null);
  const [deleting, setDeleting] = useState<IncidentReport | null>(null);
  const [saving, setSaving] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const filtered = items.filter(i => {
    if (severityFilter && i.severity !== severityFilter) return false;
    if (statusFilter && i.status !== statusFilter) return false;
    return true;
  });

  const criticalOpen = items.filter(i => i.severity === 'critical' && i.status === 'open');
  const openCount = items.filter(i => i.status === 'open').length;
  const severityCounts = SEVERITY_OPTIONS.reduce((acc, s) => { acc[s] = items.filter(i => i.severity === s).length; return acc; }, {} as Record<string, number>);
  const statusCounts = STATUS_OPTIONS.reduce((acc, s) => { acc[s] = items.filter(i => i.status === s).length; return acc; }, {} as Record<string, number>);

  function openCreate() { setEditing(null); reset({ title: '', area: '', severity: 'low', description: '', corrective_action: '', status: 'open' }); setModalOpen(true); }
  function openEdit(row: IncidentReport) { setEditing(row); reset({ ...row }); setModalOpen(true); }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      editing ? await incidentsApi.update(editing.id, data) : await incidentsApi.create(data);
      toast.success(editing ? 'Incident updated' : 'Incident reported');
      setModalOpen(false); reload();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setSaving(true);
    try { await incidentsApi.delete(deleting.id); toast.success('Deleted'); setDeleting(null); reload(); }
    catch { toast.error('Delete failed'); } finally { setSaving(false); }
  }

  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const lbl = { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const, display: 'block' as const, marginBottom: 4 };

  const columns: Column<IncidentReport>[] = [
    { key: 'title', header: 'Title', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.title}</span> },
    { key: 'area', header: 'Area' },
    { key: 'severity', header: 'Severity', render: (r) => {
      const m = SEVERITY_META[r.severity] || SEVERITY_META.low;
      return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{m.icon} {r.severity}</span>;
    }},
    { key: 'status', header: 'Status', render: (r) => {
      const m = STATUS_META[r.status] || STATUS_META.open;
      return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{r.status.replace('_', ' ')}</span>;
    }},
    { key: 'reporter_name', header: 'Reported By', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.reporter_name || '—'}</span> },
    { key: 'created_at', header: 'Date', render: (r) => formatDate(r.created_at) },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Incident Reports</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{total} total · {openCount} open</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['cards', 'table'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)} style={{ background: viewMode === m ? 'var(--accent)' : 'transparent', border: 'none', color: viewMode === m ? '#fff' : 'var(--text-muted)', padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: viewMode === m ? 700 : 400 }}>
                  {m === 'cards' ? '⊞ Cards' : '☰ Table'}
                </button>
              ))}
            </div>
            <button onClick={openCreate} style={{ background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ Report Incident</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Critical alert */}
        {criticalOpen.length > 0 && (
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>🚨</span>
            <div style={{ color: '#991b1b', fontSize: 13 }}>
              <strong>{criticalOpen.length} critical incident{criticalOpen.length > 1 ? 's' : ''} require immediate attention:</strong>{' '}
              {criticalOpen.map(i => i.title).join(', ')}
            </div>
          </div>
        )}

        {/* Severity breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {SEVERITY_OPTIONS.map(s => {
            const m = SEVERITY_META[s];
            const active = severityFilter === s;
            return (
              <div key={s} onClick={() => setSeverityFilter(active ? '' : s)} style={{
                background: active ? m.bg : 'var(--surface)', border: `1px solid ${active ? m.color : 'var(--border)'}`,
                borderLeft: `4px solid ${m.color}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: m.color }}>{severityCounts[s] || 0}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{s}</div>
              </div>
            );
          })}
        </div>

        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map(s => {
            const m = STATUS_META[s];
            const active = statusFilter === s;
            return (
              <button key={s} onClick={() => setStatusFilter(active ? '' : s)} style={{
                background: active ? m.bg : 'var(--surface2)', border: `1px solid ${active ? m.color : 'var(--border)'}`,
                borderRadius: 20, color: active ? m.color : 'var(--text-muted)', padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 400,
              }}>
                {s.replace('_', ' ')} <span style={{ fontWeight: 700 }}>{statusCounts[s] || 0}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search incidents..."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          {(severityFilter || statusFilter) && <button onClick={() => { setSeverityFilter(''); setStatusFilter(''); }} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>Clear filters ✕</button>}
        </div>

        {viewMode === 'table' ? (
          <>
            <Table columns={columns} data={filtered} loading={loading} rowKey={(r) => r.id}
              onEdit={canEdit ? openEdit : undefined} onDelete={canEdit ? (r) => setDeleting(r) : undefined} />
            <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {loading ? <div style={{ color: 'var(--text-muted)', padding: 20 }}>Loading...</div> : filtered.map(inc => {
              const sm = SEVERITY_META[inc.severity] || SEVERITY_META.low;
              const stm = STATUS_META[inc.status] || STATUS_META.open;
              const isCritical = inc.severity === 'critical' && inc.status === 'open';
              return (
                <div key={inc.id} style={{ background: 'var(--surface)', border: `1px solid ${isCritical ? '#fecaca' : 'var(--border)'}`, borderTop: `3px solid ${sm.color}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{inc.title}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>📍 {inc.area}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                      <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{sm.icon} {inc.severity}</span>
                      <span style={{ background: stm.bg, color: stm.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{inc.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                  {inc.description && <div style={{ color: 'var(--text-soft)', fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}>{inc.description.slice(0, 100)}{inc.description.length > 100 ? '…' : ''}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', marginBottom: canEdit ? 10 : 0 }}>
                    <span>{inc.reporter_name || '—'}</span>
                    <span>{formatDate(inc.created_at)}</span>
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(inc)} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 0', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                      <button onClick={() => setDeleting(inc)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Incident' : 'Report Incident'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Title *</label><input style={inp} {...register('title', { required: 'Required' })} />{errors.title && <span className="field-error">{String(errors.title.message)}</span>}</div>
            <div className="form-group"><label style={lbl}>Area *</label><input style={inp} {...register('area', { required: 'Required' })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Severity</label><select style={inp} {...register('severity')}>{SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="form-group"><label style={lbl}>Status</label><select style={inp} {...register('status')}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div className="form-group"><label style={lbl}>Description *</label><textarea style={{ ...inp, resize: 'vertical' }} rows={3} {...register('description', { required: 'Required' })} /></div>
          <div className="form-group"><label style={lbl}>Corrective Action</label><textarea style={{ ...inp, resize: 'vertical' }} rows={2} {...register('corrective_action')} /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Report'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={saving} message={`Delete incident "${deleting?.title}"?`} />
    </div>
  );
}
