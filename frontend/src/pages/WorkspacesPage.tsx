import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { workspacesApi } from '../lib/api';
import type { StudyWorkspace } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePagedApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = ['active', 'on_hold', 'completed', 'archived'];

const STATUS_META: Record<string, { color: string; bg: string; icon: string }> = {
  active: { color: '#22c55e', bg: '#dcfce7', icon: '▶' },
  on_hold: { color: '#f59e0b', bg: '#fef3c7', icon: '⏸' },
  completed: { color: '#6366f1', bg: '#e0e7ff', icon: '✓' },
  archived: { color: '#94a3b8', bg: '#f1f5f9', icon: '📦' },
};

export default function WorkspacesPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('manager');
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<StudyWorkspace>(
    (p, pp, s) => workspacesApi.list(p, pp, s)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StudyWorkspace | null>(null);
  const [deleting, setDeleting] = useState<StudyWorkspace | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const filtered = statusFilter ? items.filter(i => i.status === statusFilter) : items;
  const counts = STATUS_OPTIONS.reduce((acc, s) => { acc[s] = items.filter(i => i.status === s).length; return acc; }, {} as Record<string, number>);
  const activeCount = items.filter(i => i.status === 'active').length;

  function openCreate() { setEditing(null); reset({ name: '', field: '', lead_id: null, milestone: '', status: 'active', description: '' }); setModalOpen(true); }
  function openEdit(row: StudyWorkspace) { setEditing(row); reset({ ...row }); setModalOpen(true); }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      const payload = { ...data, lead_id: data.lead_id ? Number(data.lead_id) : null };
      editing ? await workspacesApi.update(editing.id, payload) : await workspacesApi.create(payload);
      toast.success(editing ? 'Workspace updated' : 'Workspace created');
      setModalOpen(false); reload();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setSaving(true);
    try { await workspacesApi.delete(deleting.id); toast.success('Deleted'); setDeleting(null); reload(); }
    catch { toast.error('Delete failed'); } finally { setSaving(false); }
  }

  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const lbl = { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const, display: 'block' as const, marginBottom: 4 };

  const columns: Column<StudyWorkspace>[] = [
    { key: 'name', header: 'Workspace', render: (r) => <span style={{ fontWeight: 700, color: 'var(--text)' }}>{r.name}</span> },
    { key: 'field', header: 'Field' },
    { key: 'lead_name', header: 'Lead', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.lead_name || '—'}</span> },
    { key: 'milestone', header: 'Milestone', render: (r) => r.milestone ? <span style={{ color: 'var(--text-soft)', fontSize: 12 }}>{r.milestone}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'status', header: 'Status', render: (r) => {
      const m = STATUS_META[r.status] || STATUS_META.active;
      return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{m.icon} {r.status.replace('_', ' ')}</span>;
    }},
  ];

  const FIELD_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#10b981'];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Study Workspaces</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{total} workspaces · {activeCount} active</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['cards', 'table'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)} style={{ background: viewMode === m ? 'var(--accent)' : 'transparent', border: 'none', color: viewMode === m ? '#fff' : 'var(--text-muted)', padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: viewMode === m ? 700 : 400 }}>
                  {m === 'cards' ? '⊞ Cards' : '☰ Table'}
                </button>
              ))}
            </div>
            {canEdit && <button onClick={openCreate} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ New Workspace</button>}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Status breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {STATUS_OPTIONS.map(s => {
            const m = STATUS_META[s];
            const active = statusFilter === s;
            return (
              <div key={s} onClick={() => setStatusFilter(active ? '' : s)} style={{
                background: active ? m.bg : 'var(--surface)', border: `1px solid ${active ? m.color : 'var(--border)'}`,
                borderLeft: `4px solid ${m.color}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: m.color }}>{counts[s] || 0}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{s.replace('_', ' ')}</div>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search workspaces..."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          {statusFilter && <button onClick={() => setStatusFilter('')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>Clear filter ✕</button>}
        </div>

        {viewMode === 'table' ? (
          <>
            <Table columns={columns} data={filtered} loading={loading} rowKey={(r) => r.id}
              onEdit={canEdit ? openEdit : undefined} onDelete={canEdit ? (r) => setDeleting(r) : undefined} />
            <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {loading ? <div style={{ color: 'var(--text-muted)', padding: 20 }}>Loading...</div> : filtered.map((ws, idx) => {
              const m = STATUS_META[ws.status] || STATUS_META.active;
              const fieldColor = FIELD_COLORS[idx % FIELD_COLORS.length];
              return (
                <div key={ws.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `3px solid ${fieldColor}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{ws.name}</div>
                      <div style={{ color: fieldColor, fontSize: 12, fontWeight: 600 }}>{ws.field}</div>
                    </div>
                    <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{m.icon} {ws.status.replace('_', ' ')}</span>
                  </div>
                  {ws.milestone && (
                    <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12, color: 'var(--text-soft)' }}>
                      🎯 <strong>Milestone:</strong> {ws.milestone}
                    </div>
                  )}
                  {ws.description && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}>{ws.description.slice(0, 80)}{ws.description.length > 80 ? '…' : ''}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: canEdit ? 10 : 0 }}>
                    👤 {ws.lead_name || 'No lead assigned'}
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(ws)} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 0', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                      <button onClick={() => setDeleting(ws)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Workspace' : 'New Workspace'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Name *</label><input style={inp} {...register('name', { required: 'Required' })} />{errors.name && <span className="field-error">{String(errors.name.message)}</span>}</div>
            <div className="form-group"><label style={lbl}>Field *</label><input style={inp} {...register('field', { required: 'Required' })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Lead (User ID)</label><input type="number" style={inp} {...register('lead_id')} /></div>
            <div className="form-group"><label style={lbl}>Status</label><select style={inp} {...register('status')}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
          </div>
          <div className="form-group"><label style={lbl}>Milestone</label><input style={inp} {...register('milestone')} /></div>
          <div className="form-group"><label style={lbl}>Description</label><textarea style={{ ...inp, resize: 'vertical' }} rows={2} {...register('description')} /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={saving} message={`Delete workspace "${deleting?.name}"?`} />
    </div>
  );
}
