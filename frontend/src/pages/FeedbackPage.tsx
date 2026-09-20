import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { feedbackApi } from '../lib/api';
import type { Feedback } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePagedApi } from '../hooks/useApi';
import { formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const MODULE_OPTIONS = ['general', 'protocols', 'instruments', 'samples', 'inventory', 'training', 'dashboard', 'other'];
const STATUS_OPTIONS = ['new', 'under_review', 'resolved', 'closed'];

const STATUS_META: Record<string, { color: string; bg: string; icon: string }> = {
  new: { color: '#6366f1', bg: '#e0e7ff', icon: '🆕' },
  under_review: { color: '#f59e0b', bg: '#fef3c7', icon: '🔍' },
  resolved: { color: '#22c55e', bg: '#dcfce7', icon: '✓' },
  closed: { color: '#94a3b8', bg: '#f1f5f9', icon: '✕' },
};

const MODULE_ICONS: Record<string, string> = {
  general: '💬', protocols: '📋', instruments: '🔬', samples: '🧪',
  inventory: '📦', training: '🎓', dashboard: '⬡', other: '❓',
};

export default function FeedbackPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('manager');
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<Feedback>(
    (p, pp, s) => feedbackApi.list(p, pp, s)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Feedback | null>(null);
  const [deleting, setDeleting] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const filtered = items.filter(i => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (moduleFilter && i.module !== moduleFilter) return false;
    return true;
  });

  const statusCounts = STATUS_OPTIONS.reduce((acc, s) => { acc[s] = items.filter(i => i.status === s).length; return acc; }, {} as Record<string, number>);
  const newCount = items.filter(i => i.status === 'new').length;
  const activeModules = MODULE_OPTIONS.filter(m => items.some(i => i.module === m));

  function openCreate() { setEditing(null); reset({ subject: '', message: '', module: 'general' }); setModalOpen(true); }
  function openEdit(row: Feedback) { setEditing(row); reset({ ...row }); setModalOpen(true); }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      editing ? await feedbackApi.update(editing.id, data) : await feedbackApi.create(data);
      toast.success(editing ? 'Feedback updated' : 'Feedback submitted');
      setModalOpen(false); reload();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setSaving(true);
    try { await feedbackApi.delete(deleting.id); toast.success('Deleted'); setDeleting(null); reload(); }
    catch { toast.error('Delete failed'); } finally { setSaving(false); }
  }

  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const lbl = { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const, display: 'block' as const, marginBottom: 4 };

  const columns: Column<Feedback>[] = [
    { key: 'subject', header: 'Subject', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.subject}</span> },
    { key: 'module', header: 'Module', render: (r) => (
      <span style={{ background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 11, padding: '2px 8px', borderRadius: 4, color: 'var(--text-soft)' }}>
        {MODULE_ICONS[r.module] || '❓'} {r.module}
      </span>
    )},
    { key: 'submitter_name', header: 'By', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.submitter_name || '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => {
      const m = STATUS_META[r.status] || STATUS_META.new;
      return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{m.icon} {r.status.replace('_', ' ')}</span>;
    }},
    { key: 'created_at', header: 'Date', render: (r) => formatDate(r.created_at) },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Feedback</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{total} submissions · {newCount} new</p>
          </div>
          <button onClick={openCreate} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ Submit Feedback</button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* New feedback alert */}
        {newCount > 0 && canManage && (
          <div style={{ background: '#e0e7ff', border: '1px solid #a5b4fc', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>🆕</span>
            <div style={{ color: '#3730a3', fontSize: 13 }}>
              <strong>{newCount} new feedback item{newCount > 1 ? 's' : ''} awaiting review</strong>
            </div>
          </div>
        )}

        {/* Status breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {STATUS_OPTIONS.map(s => {
            const m = STATUS_META[s];
            const active = statusFilter === s;
            return (
              <div key={s} onClick={() => setStatusFilter(active ? '' : s)} style={{
                background: active ? m.bg : 'var(--surface)', border: `1px solid ${active ? m.color : 'var(--border)'}`,
                borderLeft: `4px solid ${m.color}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: m.color }}>{statusCounts[s] || 0}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{s.replace('_', ' ')}</div>
              </div>
            );
          })}
        </div>

        {/* Module filter chips */}
        {activeModules.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setModuleFilter('')} style={{
              background: !moduleFilter ? 'var(--accent)' : 'var(--surface2)', border: `1px solid ${!moduleFilter ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 20, color: !moduleFilter ? '#fff' : 'var(--text-muted)', padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: !moduleFilter ? 700 : 400,
            }}>All modules</button>
            {activeModules.map(m => (
              <button key={m} onClick={() => setModuleFilter(moduleFilter === m ? '' : m)} style={{
                background: moduleFilter === m ? 'var(--accent)' : 'var(--surface2)', border: `1px solid ${moduleFilter === m ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 20, color: moduleFilter === m ? '#fff' : 'var(--text-muted)', padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: moduleFilter === m ? 700 : 400,
              }}>{MODULE_ICONS[m]} {m}</button>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search feedback..."
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <Table columns={columns} data={filtered} loading={loading} rowKey={(r) => r.id}
          onEdit={canManage ? openEdit : undefined} onDelete={canManage ? (r) => setDeleting(r) : undefined} />
        <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Feedback' : 'Submit Feedback'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-group"><label style={lbl}>Subject *</label><input style={inp} {...register('subject', { required: 'Required' })} />{errors.subject && <span className="field-error">{String(errors.subject.message)}</span>}</div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Module</label><select style={inp} {...register('module')}>{MODULE_OPTIONS.map(m => <option key={m} value={m}>{MODULE_ICONS[m]} {m}</option>)}</select></div>
            {editing && canManage && <div className="form-group"><label style={lbl}>Status</label><select style={inp} {...register('status')}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>}
          </div>
          <div className="form-group"><label style={lbl}>Message *</label><textarea style={{ ...inp, resize: 'vertical' }} rows={4} {...register('message', { required: 'Required' })} /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Submit'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={saving} message={`Delete feedback "${deleting?.subject}"?`} />
    </div>
  );
}
