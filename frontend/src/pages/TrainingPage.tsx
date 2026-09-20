import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { trainingApi } from '../lib/api';
import type { TrainingRecord } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePagedApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { statusColor, formatDate } from '../lib/utils';

const STATUS_FILTERS = ['all', 'active', 'expired', 'pending'] as const;

function statusBadge(status: string) {
  const color = statusColor(status);
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      background: color + '1a',
      color: color,
      border: `1px solid ${color}33`,
      textTransform: 'capitalize',
    }}>{status}</span>
  );
}

export default function TrainingPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('manager');

  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<TrainingRecord>(
    (p, pp, s) => trainingApi.list(p, pp, s)
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingRecord | null>(null);
  const [deleting, setDeleting] = useState<TrainingRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  const { register, handleSubmit, reset } = useForm<any>();

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const stats = useMemo(() => {
    const active = items.filter(r => r.status === 'active').length;
    const expired = items.filter(r => r.status === 'expired').length;
    const pending = items.filter(r => r.status === 'pending').length;
    const expiringSoon = items.filter(r => {
      if (!r.expires_on) return false;
      const d = new Date(r.expires_on);
      return d >= now && d <= in30;
    }).length;
    return { active, expired, pending, expiringSoon };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return items;
    return items.filter(r => r.status === statusFilter);
  }, [items, statusFilter]);

  function openCreate() {
    setEditing(null);
    reset({ user_id: '', title: '', completed_on: '', expires_on: '', status: 'active', notes: '' });
    setModalOpen(true);
  }
  function openEdit(row: TrainingRecord) { setEditing(row); reset({ ...row }); setModalOpen(true); }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      const payload = {
        ...data,
        user_id: Number(data.user_id),
        instrument_id: data.instrument_id ? Number(data.instrument_id) : null,
        protocol_id: data.protocol_id ? Number(data.protocol_id) : null,
      };
      editing ? await trainingApi.update(editing.id, payload) : await trainingApi.create(payload);
      toast.success(editing ? 'Updated' : 'Created');
      setModalOpen(false);
      reload();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await trainingApi.delete(deleting.id);
      toast.success('Deleted');
      setDeleting(null);
      reload();
    } catch { toast.error('Delete failed'); }
    finally { setSaving(false); }
  }

  const columns: Column<TrainingRecord>[] = [
    { key: 'title', header: 'Title' },
    { key: 'user_name', header: 'User', render: (r) => r.user_name || `ID:${r.user_id}` },
    { key: 'instrument_name', header: 'Instrument', render: (r) => r.instrument_name || '—' },
    { key: 'completed_on', header: 'Completed', render: (r) => formatDate(r.completed_on) },
    { key: 'expires_on', header: 'Expires', render: (r) => {
      if (!r.expires_on) return '—';
      const d = new Date(r.expires_on);
      const soon = d >= now && d <= in30;
      return <span style={{ color: soon ? 'var(--warning)' : 'var(--text)' }}>{formatDate(r.expires_on)}</span>;
    }},
    { key: 'status', header: 'Status', render: (r) => statusBadge(r.status) },
  ];

  const statCards = [
    { label: 'Active', value: stats.active, color: 'var(--success)', filter: 'active' },
    { label: 'Expired', value: stats.expired, color: 'var(--danger)', filter: 'expired' },
    { label: 'Pending', value: stats.pending, color: 'var(--warning)', filter: 'pending' },
    { label: 'Expiring Soon', value: stats.expiringSoon, color: '#f97316', filter: 'all' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Training Records</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{total} total records</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: viewMode === 'card' ? 'var(--accent)' : 'var(--surface2)', color: viewMode === 'card' ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13 }}
            onClick={() => setViewMode(v => v === 'table' ? 'card' : 'table')}
          >
            {viewMode === 'table' ? 'Card View' : 'Table View'}
          </button>
          {canEdit && (
            <button
              style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              onClick={openCreate}
            >
              + New Record
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* Alert Banner */}
        {stats.expiringSoon > 0 && (
          <div style={{
            background: '#fef9c3',
            border: '1px solid #fde047',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#854d0e',
            fontSize: 14,
          }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <strong>{stats.expiringSoon} training record{stats.expiringSoon > 1 ? 's' : ''} expire within 30 days</strong>
          </div>
        )}

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          {statCards.map((s) => (
            <div
              key={s.label}
              onClick={() => setStatusFilter(s.filter)}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${statusFilter === s.filter && s.filter !== 'all' ? s.color : 'var(--border)'}`,
                borderRadius: 10,
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s',
                boxShadow: statusFilter === s.filter && s.filter !== 'all' ? `0 0 0 2px ${s.color}33` : 'none',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search + Filter Bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{
              flex: 1,
              minWidth: 200,
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
            }}
            placeholder="Search training records..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1px solid var(--border)',
                  background: statusFilter === f ? 'var(--accent)' : 'var(--surface)',
                  color: statusFilter === f ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: statusFilter === f ? 600 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {viewMode === 'table' ? (
          <>
            <Table
              columns={columns}
              data={filteredItems}
              loading={loading}
              rowKey={(r) => r.id}
              onEdit={canEdit ? openEdit : undefined}
              onDelete={canEdit ? (r) => setDeleting(r) : undefined}
            />
            <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {filteredItems.map((r) => {
              const color = statusColor(r.status);
              const expSoon = r.expires_on && new Date(r.expires_on) >= now && new Date(r.expires_on) <= in30;
              return (
                <div key={r.id} style={{
                  background: 'var(--surface)',
                  border: `1px solid ${expSoon ? 'var(--warning)' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{r.title}</div>
                    {statusBadge(r.status)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>User: {r.user_name || `ID:${r.user_id}`}</div>
                  {r.instrument_name && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Instrument: {r.instrument_name}</div>}
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Completed: {formatDate(r.completed_on)}</div>
                  <div style={{ fontSize: 13, color: expSoon ? 'var(--warning)' : 'var(--text-muted)' }}>
                    Expires: {r.expires_on ? formatDate(r.expires_on) : '—'}
                    {expSoon && ' ⚠️'}
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => openEdit(r)} style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                      <button onClick={() => setDeleting(r)} style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Training Record' : 'New Training Record'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">User ID *</label>
              <input type="number" className="form-input" {...register('user_id', { required: true })} />
            </div>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" {...register('title', { required: true })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Instrument ID</label>
              <input type="number" className="form-input" {...register('instrument_id')} />
            </div>
            <div className="form-group">
              <label className="form-label">Protocol ID</label>
              <input type="number" className="form-input" {...register('protocol_id')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Completed On</label>
              <input type="date" className="form-input" {...register('completed_on')} />
            </div>
            <div className="form-group">
              <label className="form-label">Expires On</label>
              <input type="date" className="form-input" {...register('expires_on')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" {...register('status')}>
                <option value="active">active</option>
                <option value="expired">expired</option>
                <option value="pending">pending</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} {...register('notes')} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        message={`Delete "${deleting?.title}"?`}
      />
    </div>
  );
}
