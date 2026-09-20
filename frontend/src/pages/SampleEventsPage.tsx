import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { samplesApi } from '../lib/api';
import type { SampleEvent } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePagedApi } from '../hooks/useApi';
import { formatDateTime } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const EVENT_TYPE_COLORS: Record<string, string> = {
  intake: '#6366f1',
  processing: '#f59e0b',
  storage: '#22c55e',
  transfer: '#8b5cf6',
  disposal: '#ef4444',
  analysis: '#06b6d4',
  default: '#94a3b8',
};

const STATUS_META: Record<string, { color: string; bg: string }> = {
  logged: { color: '#6366f1', bg: '#e0e7ff' },
  in_progress: { color: '#f59e0b', bg: '#fef3c7' },
  completed: { color: '#22c55e', bg: '#dcfce7' },
  failed: { color: '#ef4444', bg: '#fee2e2' },
};

function getEventColor(eventType: string) {
  return EVENT_TYPE_COLORS[eventType?.toLowerCase()] || EVENT_TYPE_COLORS.default;
}

export default function SampleEventsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('staff');
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<SampleEvent>(
    (p, pp, s) => samplesApi.listEvents(p, pp, s)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SampleEvent | null>(null);
  const [deleting, setDeleting] = useState<SampleEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('timeline');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const filtered = eventTypeFilter ? items.filter(i => i.event_type?.toLowerCase() === eventTypeFilter) : items;

  const eventTypes = Array.from(new Set(items.map(i => i.event_type?.toLowerCase()).filter(Boolean)));
  const eventTypeCounts = eventTypes.reduce((acc, t) => { acc[t] = items.filter(i => i.event_type?.toLowerCase() === t).length; return acc; }, {} as Record<string, number>);

  // Sort by timestamp for timeline
  const sortedFiltered = [...filtered].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  function openCreate() {
    setEditing(null);
    reset({ sample_record_id: '', event_type: '', location: '', status: 'logged', timestamp: new Date().toISOString().slice(0, 16), notes: '' });
    setModalOpen(true);
  }
  function openEdit(row: SampleEvent) { setEditing(row); reset({ ...row, timestamp: row.timestamp?.slice(0, 16) }); setModalOpen(true); }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      const payload = { ...data, sample_record_id: Number(data.sample_record_id), timestamp: data.timestamp + ':00' };
      editing ? await samplesApi.updateEvent(editing.id, payload) : await samplesApi.createEvent(payload);
      toast.success(editing ? 'Event updated' : 'Event created');
      setModalOpen(false); reload();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setSaving(true);
    try { await samplesApi.deleteEvent(deleting.id); toast.success('Deleted'); setDeleting(null); reload(); }
    catch { toast.error('Delete failed'); } finally { setSaving(false); }
  }

  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const lbl = { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const, display: 'block' as const, marginBottom: 4 };

  const columns: Column<SampleEvent>[] = [
    { key: 'sample_record_id', header: 'Sample', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text)' }}>#{r.sample_record_id}</span> },
    { key: 'event_type', header: 'Event Type', render: (r) => {
      const color = getEventColor(r.event_type);
      return <span style={{ background: color + '22', color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'capitalize' }}>{r.event_type}</span>;
    }},
    { key: 'location', header: 'Location', render: (r) => r.location ? <span style={{ color: 'var(--text-soft)', fontSize: 12 }}>📍 {r.location}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'status', header: 'Status', render: (r) => {
      const m = STATUS_META[r.status] || STATUS_META.logged;
      return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{r.status?.replace('_', ' ')}</span>;
    }},
    { key: 'performer_name', header: 'Performed By', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.performer_name || '—'}</span> },
    { key: 'timestamp', header: 'Timestamp', render: (r) => <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>{formatDateTime(r.timestamp)}</span> },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Sample Events</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{total} events · {eventTypes.length} event types</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['timeline', 'table'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)} style={{ background: viewMode === m ? 'var(--accent)' : 'transparent', border: 'none', color: viewMode === m ? '#fff' : 'var(--text-muted)', padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: viewMode === m ? 700 : 400, textTransform: 'capitalize' }}>
                  {m === 'timeline' ? '⏱ Timeline' : '☰ Table'}
                </button>
              ))}
            </div>
            {canEdit && <button onClick={openCreate} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ New Event</button>}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Event type cards */}
        {eventTypes.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
            {eventTypes.map(t => {
              const color = getEventColor(t);
              const active = eventTypeFilter === t;
              return (
                <div key={t} onClick={() => setEventTypeFilter(active ? '' : t)} style={{
                  background: active ? color + '22' : 'var(--surface)', border: `1px solid ${active ? color : 'var(--border)'}`,
                  borderLeft: `4px solid ${color}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color }}>{eventTypeCounts[t] || 0}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, textTransform: 'capitalize' }}>{t}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search events..."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          {eventTypeFilter && <button onClick={() => setEventTypeFilter('')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>Clear filter ✕</button>}
        </div>

        {viewMode === 'table' ? (
          <>
            <Table columns={columns} data={filtered} loading={loading} rowKey={(r) => r.id}
              onEdit={canEdit ? openEdit : undefined} onDelete={canEdit ? (r) => setDeleting(r) : undefined} />
            <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
          </>
        ) : (
          <div>
            {loading ? <div style={{ color: 'var(--text-muted)', padding: 20 }}>Loading…</div> : (
              <div style={{ position: 'relative' }}>
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {sortedFiltered.map((ev, i) => {
                    const color = getEventColor(ev.event_type);
                    const sm = STATUS_META[ev.status] || STATUS_META.logged;
                    return (
                      <div key={ev.id} style={{ display: 'flex', gap: 16, paddingBottom: i < sortedFiltered.length - 1 ? 16 : 0 }}>
                        {/* Dot */}
                        <div style={{ width: 34, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 14 }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', background: color, border: '2px solid var(--surface)', zIndex: 1, boxShadow: `0 0 0 2px ${color}44` }} />
                        </div>
                        {/* Card */}
                        <div style={{ flex: 1, background: 'var(--surface)', border: `1px solid var(--border)`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ background: color + '22', color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'capitalize' }}>{ev.event_type}</span>
                              <span style={{ background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{ev.status?.replace('_', ' ')}</span>
                              <span style={{ color: 'var(--text-soft)', fontWeight: 600, fontSize: 13 }}>Sample #{ev.sample_record_id}</span>
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{formatDateTime(ev.timestamp)}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                            {ev.location && <span>📍 {ev.location}</span>}
                            {ev.performer_name && <span>👤 {ev.performer_name}</span>}
                            {ev.notes && <span style={{ color: 'var(--text-soft)' }}>{ev.notes}</span>}
                          </div>
                          {canEdit && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                              <button onClick={() => openEdit(ev)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                              <button onClick={() => setDeleting(ev)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {sortedFiltered.length === 0 && <div style={{ color: 'var(--text-muted)', padding: '20px 50px' }}>No events found</div>}
                </div>
              </div>
            )}
            <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Sample Event' : 'New Sample Event'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Sample Record ID *</label><input type="number" style={inp} {...register('sample_record_id', { required: 'Required' })} />{errors.sample_record_id && <span className="field-error">{String(errors.sample_record_id.message)}</span>}</div>
            <div className="form-group"><label style={lbl}>Event Type *</label><input style={inp} {...register('event_type', { required: 'Required' })} placeholder="intake, processing, storage…" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Location</label><input style={inp} {...register('location')} /></div>
            <div className="form-group"><label style={lbl}>Status</label><input style={inp} {...register('status')} placeholder="logged, in_progress, completed…" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Timestamp *</label><input type="datetime-local" style={inp} {...register('timestamp', { required: 'Required' })} /></div>
            <div className="form-group"><label style={lbl}>Performed By (User ID)</label><input type="number" style={inp} {...register('performed_by')} /></div>
          </div>
          <div className="form-group"><label style={lbl}>Notes</label><textarea style={{ ...inp, resize: 'vertical' }} rows={2} {...register('notes')} /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={saving} message="Delete this sample event?" />
    </div>
  );
}
