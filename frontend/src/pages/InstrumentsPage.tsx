import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { instrumentsApi } from '../lib/api';
import type { Instrument } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePagedApi } from '../hooks/useApi';
import { statusColor, formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = ['available', 'in_use', 'maintenance', 'decommissioned'];

const STATUS_META: Record<string, { icon: string; color: string; bg: string }> = {
  available: { icon: '✓', color: '#16a34a', bg: '#dcfce7' },
  in_use: { icon: '▶', color: '#6366f1', bg: '#e0e7ff' },
  maintenance: { icon: '🔧', color: '#d97706', bg: '#fef3c7' },
  decommissioned: { icon: '✕', color: '#94a3b8', bg: '#f1f5f9' },
};

export default function InstrumentsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('manager');
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<Instrument>(
    (p, pp, s) => instrumentsApi.list(p, pp, s)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Instrument | null>(null);
  const [deleting, setDeleting] = useState<Instrument | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [statusFilter, setStatusFilter] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const filtered = statusFilter ? items.filter(i => i.status === statusFilter) : items;

  function openCreate() { setEditing(null); reset({ name: '', category: '', location: '', maintenance_frequency_days: 30, next_maintenance_date: '', status: 'available', notes: '' }); setModalOpen(true); }
  function openEdit(row: Instrument) { setEditing(row); reset({ ...row }); setModalOpen(true); }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      editing ? await instrumentsApi.update(editing.id, data) : await instrumentsApi.create(data);
      toast.success(editing ? 'Instrument updated' : 'Instrument created');
      setModalOpen(false); reload();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setSaving(true);
    try { await instrumentsApi.delete(deleting.id); toast.success('Deleted'); setDeleting(null); reload(); }
    catch (err: any) { toast.error('Delete failed'); } finally { setSaving(false); }
  }

  // Status counts from loaded items
  const counts = STATUS_OPTIONS.reduce((acc, s) => { acc[s] = items.filter(i => i.status === s).length; return acc; }, {} as Record<string, number>);
  const maintenanceSoon = items.filter(i => {
    if (!i.next_maintenance_date) return false;
    const d = new Date(i.next_maintenance_date);
    const diff = (d.getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 14;
  });

  const columns: Column<Instrument>[] = [
    { key: 'name', header: 'Instrument', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.name}</span> },
    { key: 'category', header: 'Category' },
    { key: 'location', header: 'Location' },
    { key: 'status', header: 'Status', render: (r) => {
      const m = STATUS_META[r.status] || STATUS_META.available;
      return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{m.icon} {r.status}</span>;
    }},
    { key: 'next_maintenance_date', header: 'Next Maintenance', render: (r) => {
      if (!r.next_maintenance_date) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
      const d = new Date(r.next_maintenance_date);
      const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
      const urgent = diff >= 0 && diff <= 7;
      const warning = diff > 7 && diff <= 14;
      return <span style={{ color: urgent ? '#ef4444' : warning ? '#f59e0b' : 'var(--text-soft)', fontWeight: urgent || warning ? 700 : 400 }}>
        {formatDate(r.next_maintenance_date)}{diff >= 0 && diff <= 14 ? ` (${diff}d)` : ''}
      </span>;
    }},
    { key: 'maintenance_frequency_days', header: 'Freq.', width: '80px', render: (r) => `${r.maintenance_frequency_days}d` },
    { key: 'notes', header: 'Notes', render: (r) => r.notes ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.notes.slice(0, 50)}{r.notes.length > 50 ? '…' : ''}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
  ];

  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const lbl = { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const, display: 'block' as const, marginBottom: 4 };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Instruments</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{total} instruments registered</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['cards', 'table'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)} style={{ background: viewMode === m ? 'var(--accent)' : 'transparent', border: 'none', color: viewMode === m ? '#fff' : 'var(--text-muted)', padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: viewMode === m ? 700 : 400 }}>
                  {m === 'cards' ? '⊞ Cards' : '☰ Table'}
                </button>
              ))}
            </div>
            {canEdit && <button onClick={openCreate} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ Add Instrument</button>}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Maintenance alert */}
        {maintenanceSoon.length > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>🔧</span>
            <div style={{ color: '#92400e', fontSize: 13 }}>
              <strong>{maintenanceSoon.length} instrument{maintenanceSoon.length > 1 ? 's' : ''} due for maintenance within 14 days:</strong>{' '}
              {maintenanceSoon.map(i => i.name).join(', ')}
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
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{s.replace('_', ' ')}</div>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search instruments..."
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {loading ? <div style={{ color: 'var(--text-muted)', padding: 20 }}>Loading...</div> : filtered.map((inst) => {
              const m = STATUS_META[inst.status] || STATUS_META.available;
              const dueDate = inst.next_maintenance_date ? new Date(inst.next_maintenance_date) : null;
              const daysUntil = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null;
              const urgent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
              return (
                <div key={inst.id} style={{ background: 'var(--surface)', border: `1px solid ${urgent ? '#fde68a' : 'var(--border)'}`, borderRadius: 10, padding: 16, transition: 'box-shadow 0.15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{inst.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{inst.category}</div>
                    </div>
                    <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5 }}>{m.icon} {inst.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ color: 'var(--text-soft)', fontSize: 12 }}>📍 {inst.location || '—'}</span>
                    <span style={{ color: urgent ? '#ef4444' : 'var(--text-soft)', fontSize: 12, fontWeight: urgent ? 700 : 400 }}>
                      🔧 {dueDate ? `${formatDate(inst.next_maintenance_date)}${daysUntil !== null && daysUntil <= 14 ? ` (${daysUntil}d)` : ''}` : 'No date set'}
                    </span>
                  </div>
                  {inst.notes && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>{inst.notes}</div>}
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(inst)} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 0', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                      <button onClick={() => setDeleting(inst)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Instrument' : 'New Instrument'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Name *</label><input style={inp} {...register('name', { required: 'Required' })} />{errors.name && <span className="field-error">{String(errors.name.message)}</span>}</div>
            <div className="form-group"><label style={lbl}>Category *</label><input style={inp} {...register('category', { required: 'Required' })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Location</label><input style={inp} {...register('location')} /></div>
            <div className="form-group"><label style={lbl}>Status</label><select style={inp} {...register('status')}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Next Maintenance Date</label><input type="date" style={inp} {...register('next_maintenance_date')} /></div>
            <div className="form-group"><label style={lbl}>Maintenance Frequency (days)</label><input type="number" style={inp} {...register('maintenance_frequency_days', { valueAsNumber: true })} /></div>
          </div>
          <div className="form-group"><label style={lbl}>Notes</label><textarea style={{ ...inp, resize: 'vertical' }} rows={2} {...register('notes')} /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={saving} message={`Delete "${deleting?.name}"?`} />
    </div>
  );
}
