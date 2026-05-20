import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { schedulingApi } from '../lib/api';
import type { ReminderQueue } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePagedApi } from '../hooks/useApi';
import { formatDateTime } from '../lib/utils';

const STATUS_OPTIONS = ['pending', 'sent', 'failed'];
const CHANNEL_OPTIONS = ['dashboard', 'email', 'sms'];

const STATUS_META: Record<string, { color: string; bg: string; icon: string }> = {
  pending: { color: '#f59e0b', bg: '#fef3c7', icon: '⏳' },
  sent: { color: '#22c55e', bg: '#dcfce7', icon: '✓' },
  failed: { color: '#ef4444', bg: '#fee2e2', icon: '✕' },
};

const CHANNEL_META: Record<string, { color: string; icon: string }> = {
  dashboard: { color: '#6366f1', icon: '⬡' },
  email: { color: '#22c55e', icon: '✉' },
  sms: { color: '#f59e0b', icon: '📱' },
};

export default function RemindersPage() {
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<ReminderQueue>(
    (p, pp, s) => schedulingApi.listReminders(p, pp, s)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReminderQueue | null>(null);
  const [deleting, setDeleting] = useState<ReminderQueue | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const now = new Date();
  const filtered = statusFilter ? items.filter(i => i.status === statusFilter) : items;
  const overdue = items.filter(i => i.status === 'pending' && new Date(i.due_at) < now);
  const statusCounts = STATUS_OPTIONS.reduce((acc, s) => { acc[s] = items.filter(i => i.status === s).length; return acc; }, {} as Record<string, number>);

  function openCreate() {
    setEditing(null);
    reset({ entity_type: '', entity_id: '', title: '', due_at: '', channel: 'dashboard', recipient_role: 'staff', message: '' });
    setModalOpen(true);
  }
  function openEdit(row: ReminderQueue) { setEditing(row); reset({ ...row }); setModalOpen(true); }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      const payload = { ...data, entity_id: Number(data.entity_id) };
      editing ? await schedulingApi.updateReminder(editing.id, payload) : await schedulingApi.createReminder(payload);
      toast.success(editing ? 'Reminder updated' : 'Reminder created');
      setModalOpen(false); reload();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setSaving(true);
    try { await schedulingApi.deleteReminder(deleting.id); toast.success('Deleted'); setDeleting(null); reload(); }
    catch { toast.error('Delete failed'); } finally { setSaving(false); }
  }

  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const lbl = { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const, display: 'block' as const, marginBottom: 4 };

  const columns: Column<ReminderQueue>[] = [
    { key: 'title', header: 'Title', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.title}</span> },
    { key: 'entity_type', header: 'Entity', render: (r) => r.entity_type ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.entity_type} #{r.entity_id}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'due_at', header: 'Due At', render: (r) => {
      const d = new Date(r.due_at);
      const isOverdue = d < now && r.status === 'pending';
      return <span style={{ color: isOverdue ? '#ef4444' : 'var(--text-soft)', fontWeight: isOverdue ? 700 : 400, fontSize: 13 }}>{formatDateTime(r.due_at)}{isOverdue ? ' ⚠ Overdue' : ''}</span>;
    }},
    { key: 'channel', header: 'Channel', render: (r) => {
      const c = CHANNEL_META[r.channel] || { color: '#94a3b8', icon: '?'};
      return <span style={{ color: c.color, fontSize: 13 }}>{c.icon} {r.channel}</span>;
    }},
    { key: 'recipient_role', header: 'Role', render: (r) => <span style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'capitalize' }}>{r.recipient_role}</span> },
    { key: 'status', header: 'Status', render: (r) => {
      const m = STATUS_META[r.status] || STATUS_META.pending;
      return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{m.icon} {r.status}</span>;
    }},
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Reminders</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{total} total · {statusCounts.pending || 0} pending</p>
          </div>
          <button onClick={openCreate} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ New Reminder</button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Overdue alert */}
        {overdue.length > 0 && (
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>⚠</span>
            <div style={{ color: '#991b1b', fontSize: 13 }}>
              <strong>{overdue.length} overdue reminder{overdue.length > 1 ? 's' : ''} not yet sent:</strong>{' '}
              {overdue.map(r => r.title).join(', ')}
            </div>
          </div>
        )}

        {/* Status breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {STATUS_OPTIONS.map(s => {
            const m = STATUS_META[s];
            const active = statusFilter === s;
            return (
              <div key={s} onClick={() => setStatusFilter(active ? '' : s)} style={{
                background: active ? m.bg : 'var(--surface)', border: `1px solid ${active ? m.color : 'var(--border)'}`,
                borderLeft: `4px solid ${m.color}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: m.color }}>{statusCounts[s] || 0}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{s}</div>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search reminders..."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          {statusFilter && <button onClick={() => setStatusFilter('')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>Clear filter ✕</button>}
        </div>

        <Table columns={columns} data={filtered} loading={loading} rowKey={(r) => r.id} onEdit={openEdit} onDelete={(r) => setDeleting(r)} />
        <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Reminder' : 'New Reminder'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Entity Type</label><input style={inp} {...register('entity_type')} placeholder="e.g. instrument, task" /></div>
            <div className="form-group"><label style={lbl}>Entity ID</label><input type="number" style={inp} {...register('entity_id')} /></div>
          </div>
          <div className="form-group"><label style={lbl}>Title *</label><input style={inp} {...register('title', { required: 'Required' })} />{errors.title && <span className="field-error">{String(errors.title.message)}</span>}</div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Due At *</label><input type="datetime-local" style={inp} {...register('due_at', { required: 'Required' })} /></div>
            <div className="form-group"><label style={lbl}>Channel</label><select style={inp} {...register('channel')}>{CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Recipient Role</label><select style={inp} {...register('recipient_role')}><option value="admin">admin</option><option value="manager">manager</option><option value="staff">staff</option><option value="trainee">trainee</option></select></div>
            {editing && <div className="form-group"><label style={lbl}>Status</label><select style={inp} {...register('status')}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>}
          </div>
          <div className="form-group"><label style={lbl}>Message</label><textarea style={{ ...inp, resize: 'vertical' }} rows={2} {...register('message')} /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={saving} message={`Delete reminder "${deleting?.title}"?`} />
    </div>
  );
}
