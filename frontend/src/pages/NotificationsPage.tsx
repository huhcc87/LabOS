import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { notificationsApi } from '../lib/api';
import type { NotificationRule } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePagedApi } from '../hooks/useApi';

const CHANNEL_OPTIONS = ['dashboard', 'email', 'sms'];
const ROLE_OPTIONS = ['admin', 'pi', 'manager', 'staff', 'trainee'];

const CHANNEL_META: Record<string, { color: string; bg: string; icon: string }> = {
  dashboard: { color: '#6366f1', bg: '#e0e7ff', icon: '⬡' },
  email: { color: '#22c55e', bg: '#dcfce7', icon: '✉' },
  sms: { color: '#f59e0b', bg: '#fef3c7', icon: '📱' },
};

export default function NotificationsPage() {
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<NotificationRule>(
    (p, pp, s) => notificationsApi.list(p, pp, s)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationRule | null>(null);
  const [deleting, setDeleting] = useState<NotificationRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [channelFilter, setChannelFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const filtered = items.filter(i => {
    if (channelFilter && i.channel !== channelFilter) return false;
    if (activeFilter === 'active' && !i.is_active) return false;
    if (activeFilter === 'inactive' && i.is_active) return false;
    return true;
  });

  const activeCount = items.filter(i => i.is_active).length;
  const channelCounts = CHANNEL_OPTIONS.reduce((acc, c) => { acc[c] = items.filter(i => i.channel === c).length; return acc; }, {} as Record<string, number>);

  function openCreate() {
    setEditing(null);
    reset({ title: '', trigger_event: '', channel: 'dashboard', recipient_role: 'staff', lead_time_hours: 24, is_active: true });
    setModalOpen(true);
  }
  function openEdit(row: NotificationRule) { setEditing(row); reset({ ...row }); setModalOpen(true); }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      const payload = { ...data, lead_time_hours: Number(data.lead_time_hours), is_active: data.is_active === true || data.is_active === 'true' };
      editing ? await notificationsApi.update(editing.id, payload) : await notificationsApi.create(payload);
      toast.success(editing ? 'Rule updated' : 'Rule created');
      setModalOpen(false); reload();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setSaving(true);
    try { await notificationsApi.delete(deleting.id); toast.success('Deleted'); setDeleting(null); reload(); }
    catch { toast.error('Delete failed'); } finally { setSaving(false); }
  }

  async function toggleActive(rule: NotificationRule) {
    try {
      await notificationsApi.update(rule.id, { ...rule, is_active: !rule.is_active });
      toast.success(rule.is_active ? 'Rule disabled' : 'Rule enabled');
      reload();
    } catch { toast.error('Failed to update'); }
  }

  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const lbl = { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const, display: 'block' as const, marginBottom: 4 };

  const columns: Column<NotificationRule>[] = [
    { key: 'title', header: 'Title', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.title}</span> },
    { key: 'trigger_event', header: 'Trigger', render: (r) => <span style={{ color: 'var(--text-soft)', fontSize: 12, fontFamily: 'monospace', background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>{r.trigger_event}</span> },
    { key: 'channel', header: 'Channel', render: (r) => {
      const m = CHANNEL_META[r.channel] || { color: '#94a3b8', bg: '#f1f5f9', icon: '?' };
      return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{m.icon} {r.channel}</span>;
    }},
    { key: 'recipient_role', header: 'Role', render: (r) => <span style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'capitalize' }}>{r.recipient_role}</span> },
    { key: 'lead_time_hours', header: 'Lead Time', width: '100px', render: (r) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.lead_time_hours}h</span> },
    { key: 'is_active', header: 'Status', render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); toggleActive(r); }} style={{
        background: r.is_active ? '#dcfce7' : '#fee2e2', border: 'none', borderRadius: 4, color: r.is_active ? '#16a34a' : '#dc2626',
        fontSize: 11, fontWeight: 700, padding: '3px 10px', cursor: 'pointer',
      }}>
        {r.is_active ? '● Active' : '○ Inactive'}
      </button>
    )},
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Notification Rules</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{total} rules · {activeCount} active</p>
          </div>
          <button onClick={openCreate} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ New Rule</button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Channel breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {CHANNEL_OPTIONS.map(c => {
            const m = CHANNEL_META[c];
            const active = channelFilter === c;
            return (
              <div key={c} onClick={() => setChannelFilter(active ? '' : c)} style={{
                background: active ? m.bg : 'var(--surface)', border: `1px solid ${active ? m.color : 'var(--border)'}`,
                borderLeft: `4px solid ${m.color}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{m.icon}</span>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: m.color }}>{channelCounts[c] || 0}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'capitalize' }}>{c}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active/inactive filter + search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search rules..."
            style={{ flex: 1, minWidth: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} style={{
              background: activeFilter === f ? 'var(--accent)' : 'var(--surface2)', border: `1px solid ${activeFilter === f ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8, color: activeFilter === f ? '#fff' : 'var(--text-muted)', padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: activeFilter === f ? 700 : 400, textTransform: 'capitalize',
            }}>{f}</button>
          ))}
        </div>

        <Table columns={columns} data={filtered} loading={loading} rowKey={(r) => r.id} onEdit={openEdit} onDelete={(r) => setDeleting(r)} />
        <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Rule' : 'New Notification Rule'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-group"><label style={lbl}>Title *</label><input style={inp} {...register('title', { required: 'Required' })} />{errors.title && <span className="field-error">{String(errors.title.message)}</span>}</div>
          <div className="form-group"><label style={lbl}>Trigger Event *</label><input style={inp} {...register('trigger_event', { required: 'Required' })} placeholder="e.g. instrument.maintenance_due" /></div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Channel</label><select style={inp} {...register('channel')}>{CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{CHANNEL_META[c]?.icon} {c}</option>)}</select></div>
            <div className="form-group"><label style={lbl}>Recipient Role</label><select style={inp} {...register('recipient_role')}>{ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Lead Time (hours)</label><input type="number" style={inp} {...register('lead_time_hours')} /></div>
            <div className="form-group" style={{ justifyContent: 'center', paddingTop: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" {...register('is_active')} style={{ width: 16, height: 16 }} />
                <span style={{ ...lbl, margin: 0 }}>Active rule</span>
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={saving} message={`Delete rule "${deleting?.title}"?`} />
    </div>
  );
}
