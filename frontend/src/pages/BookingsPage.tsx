import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { instrumentsApi } from '../lib/api';
import type { Booking } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePagedApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../lib/utils';

const STATUS_OPTIONS = ['reserved', 'active', 'completed', 'cancelled'];

const STATUS_META: Record<string, { icon: string; color: string; bg: string }> = {
  reserved: { icon: '⏳', color: '#6366f1', bg: '#e0e7ff' },
  active: { icon: '▶', color: '#22c55e', bg: '#dcfce7' },
  completed: { icon: '✓', color: '#64748b', bg: '#f1f5f9' },
  cancelled: { icon: '✕', color: '#ef4444', bg: '#fee2e2' },
};

export default function BookingsPage() {
  const { user, hasRole } = useAuth();
  const canEdit = hasRole('staff');
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<Booking>(
    (p, pp, s) => instrumentsApi.listBookings(p, pp, s)
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState<Booking | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const filtered = statusFilter ? items.filter(i => i.status === statusFilter) : items;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayBookings = items.filter(b => b.start_time?.slice(0, 10) === todayStr);
  const activeNow = items.filter(b => {
    if (b.status !== 'active') return false;
    const s = new Date(b.start_time);
    const e = new Date(b.end_time);
    return now >= s && now <= e;
  });

  const counts = STATUS_OPTIONS.reduce((acc, s) => { acc[s] = items.filter(i => i.status === s).length; return acc; }, {} as Record<string, number>);

  function openCreate() {
    setEditing(null);
    reset({ instrument_id: '', user_id: user?.id || '', purpose: '', start_time: '', end_time: '', status: 'reserved' });
    setModalOpen(true);
  }

  function openEdit(row: Booking) { setEditing(row); reset({ ...row }); setModalOpen(true); }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      const payload = { ...data, instrument_id: Number(data.instrument_id), user_id: Number(data.user_id) };
      editing ? await instrumentsApi.updateBooking(editing.id, payload) : await instrumentsApi.createBooking(payload);
      toast.success(editing ? 'Booking updated' : 'Booking created');
      setModalOpen(false); reload();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setSaving(true);
    try { await instrumentsApi.deleteBooking(deleting.id); toast.success('Deleted'); setDeleting(null); reload(); }
    catch { toast.error('Delete failed'); } finally { setSaving(false); }
  }

  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const lbl = { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const, display: 'block' as const, marginBottom: 4 };

  const columns: Column<Booking>[] = [
    { key: 'instrument_name', header: 'Instrument', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.instrument_name || `#${r.instrument_id}`}</span> },
    { key: 'user_name', header: 'User', render: (r) => r.user_name || `#${r.user_id}` },
    { key: 'purpose', header: 'Purpose', render: (r) => <span style={{ color: 'var(--text-soft)', fontSize: 12 }}>{r.purpose}</span> },
    { key: 'start_time', header: 'Start', render: (r) => formatDateTime(r.start_time) },
    { key: 'end_time', header: 'End', render: (r) => formatDateTime(r.end_time) },
    { key: 'status', header: 'Status', render: (r) => {
      const m = STATUS_META[r.status] || STATUS_META.reserved;
      return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{m.icon} {r.status}</span>;
    }},
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Instrument Bookings</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{total} total · {todayBookings.length} today · {activeNow.length} active now</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['table', 'cards'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)} style={{ background: viewMode === m ? 'var(--accent)' : 'transparent', border: 'none', color: viewMode === m ? '#fff' : 'var(--text-muted)', padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: viewMode === m ? 700 : 400 }}>
                  {m === 'table' ? '☰ Table' : '⊞ Cards'}
                </button>
              ))}
            </div>
            {canEdit && <button onClick={openCreate} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ New Booking</button>}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Active now alert */}
        {activeNow.length > 0 && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>▶</span>
            <div style={{ color: '#14532d', fontSize: 13 }}>
              <strong>{activeNow.length} booking{activeNow.length > 1 ? 's' : ''} currently active:</strong>{' '}
              {activeNow.map(b => b.instrument_name || `Instrument #${b.instrument_id}`).join(', ')}
            </div>
          </div>
        )}

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
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{s}</div>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search bookings..."
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
            {loading ? <div style={{ color: 'var(--text-muted)', padding: 20 }}>Loading...</div> : filtered.map(b => {
              const m = STATUS_META[b.status] || STATUS_META.reserved;
              const isToday = b.start_time?.slice(0, 10) === todayStr;
              return (
                <div key={b.id} style={{ background: 'var(--surface)', border: `1px solid ${isToday ? '#86efac' : 'var(--border)'}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>{b.instrument_name || `Instrument #${b.instrument_id}`}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{b.user_name || `User #${b.user_id}`}</div>
                    </div>
                    <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5 }}>{m.icon} {b.status}</span>
                  </div>
                  <div style={{ color: 'var(--text-soft)', fontSize: 12, marginBottom: 6 }}>{b.purpose}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                    <span>🕐 {formatDateTime(b.start_time)}</span>
                    <span>→ {formatDateTime(b.end_time)}</span>
                    {isToday && <span style={{ background: '#dcfce7', color: '#16a34a', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>Today</span>}
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(b)} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 0', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                      <button onClick={() => setDeleting(b)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Booking' : 'New Booking'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Instrument ID *</label><input type="number" style={inp} {...register('instrument_id', { required: 'Required' })} />{errors.instrument_id && <span className="field-error">{String(errors.instrument_id.message)}</span>}</div>
            <div className="form-group"><label style={lbl}>User ID *</label><input type="number" style={inp} {...register('user_id', { required: 'Required' })} /></div>
          </div>
          <div className="form-group"><label style={lbl}>Purpose *</label><input style={inp} {...register('purpose', { required: 'Required' })} /></div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Start Time *</label><input type="datetime-local" style={inp} {...register('start_time', { required: 'Required' })} /></div>
            <div className="form-group"><label style={lbl}>End Time *</label><input type="datetime-local" style={inp} {...register('end_time', { required: 'Required' })} /></div>
          </div>
          <div className="form-group"><label style={lbl}>Status</label><select style={inp} {...register('status')}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={saving} message={`Delete this booking for "${deleting?.instrument_name || 'instrument'}"?`} />
    </div>
  );
}
