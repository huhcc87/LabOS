import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { maintenanceApi, instrumentsApi } from '../lib/api';

interface MaintenanceLog {
  id: number;
  instrument_id: number;
  instrument_name: string | null;
  type: 'preventive' | 'corrective' | 'calibration' | 'inspection';
  status: 'scheduled' | 'in_progress' | 'completed' | 'overdue';
  title: string;
  description: string;
  scheduled_date: string;
  completed_date: string | null;
  performed_by: number | null;
  technician_name: string | null;
  parts_replaced: string;
  cost: number;
  notes: string;
  created_at: string;
}

interface Instrument {
  id: number;
  name: string;
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  preventive: { bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' },
  corrective: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
  calibration: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  inspection: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  scheduled: { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' },
  in_progress: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
  completed: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  overdue: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
};

export default function MaintenancePage() {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceLog | null>(null);
  const [deleting, setDeleting] = useState<MaintenanceLog | null>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm<any>();

  async function fetchLogs() {
    setLoading(true);
    try {
      const extra: Record<string, string> = {};
      if (typeFilter) extra.maintenance_type = typeFilter;
      if (statusFilter) extra.status = statusFilter;
      const res = await maintenanceApi.list(page, perPage, search, extra);
      setLogs(res.data.items);
      setTotalPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load maintenance logs');
    } finally {
      setLoading(false);
    }
  }

  async function fetchInstruments() {
    try {
      const res = await instrumentsApi.list(1, 100, '');
      setInstruments(res.data.items);
    } catch (err) {
      console.error('Failed to load instruments');
    }
  }

  useEffect(() => {
    fetchInstruments();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, perPage, search, typeFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: total,
    completed: logs.filter(l => l.status === 'completed').length,
    scheduled: logs.filter(l => l.status === 'scheduled').length,
    overdue: logs.filter(l => l.status === 'overdue').length,
    totalCost: logs.reduce((sum, l) => sum + (l.cost || 0), 0),
  }), [logs, total]);

  function openCreate() {
    setEditing(null);
    reset({
      instrument_id: '',
      type: 'preventive',
      title: '',
      description: '',
      scheduled_date: '',
      parts_replaced: '',
      cost: '',
      notes: ''
    });
    setModalOpen(true);
  }

  function openEdit(row: MaintenanceLog) {
    setEditing(row);
    reset({
      instrument_id: row.instrument_id,
      type: row.type,
      status: row.status,
      title: row.title,
      description: row.description,
      scheduled_date: row.scheduled_date,
      completed_date: row.completed_date || '',
      parts_replaced: row.parts_replaced,
      cost: row.cost,
      notes: row.notes,
    });
    setModalOpen(true);
  }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      const payload = {
        ...data,
        cost: data.cost ? Number(data.cost) : 0,
        instrument_id: Number(data.instrument_id),
      };
      if (editing) {
        await maintenanceApi.update(editing.id, payload);
        toast.success('Log updated');
      } else {
        await maintenanceApi.create(payload);
        toast.success('Log created');
      }
      setModalOpen(false);
      fetchLogs();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save log');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await maintenanceApi.delete(deleting.id);
      toast.success('Log deleted');
      setDeleting(null);
      fetchLogs();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete log');
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete(log: MaintenanceLog) {
    try {
      await maintenanceApi.complete(log.id);
      toast.success('Maintenance completed');
      fetchLogs();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to complete maintenance');
    }
  }

  const columns: Column<MaintenanceLog>[] = [
    { key: 'instrument_name', header: 'Instrument', render: (r) => r.instrument_name || '—' },
    { key: 'title', header: 'Title' },
    { key: 'type', header: 'Type', width: '120px', render: (r) => (
      <span style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'capitalize',
        ...TYPE_COLORS[r.type],
      }}>{r.type}</span>
    )},
    { key: 'status', header: 'Status', width: '110px', render: (r) => (
      <span style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'capitalize',
        ...STATUS_COLORS[r.status],
      }}>{r.status.replace('_', ' ')}</span>
    )},
    { key: 'scheduled_date', header: 'Scheduled' },
    { key: 'completed_date', header: 'Completed', render: (r) => r.completed_date || '—' },
    { key: 'technician_name', header: 'Technician', render: (r) => r.technician_name || '—' },
    { key: 'cost', header: 'Cost', width: '100px', render: (r) => r.cost ? `$${r.cost.toLocaleString()}` : '—' },
    { key: 'actions', header: '', width: '100px', render: (r) => r.status !== 'completed' ? (
      <button
        className="btn btn-sm btn-primary"
        onClick={(e) => { e.stopPropagation(); handleComplete(r); }}
      >
        Complete
      </button>
    ) : null },
  ];

  const statCards = [
    { label: 'Total Records', value: stats.total, color: 'var(--accent)' },
    { label: 'Completed', value: stats.completed, color: 'var(--success)' },
    { label: 'Scheduled', value: stats.scheduled, color: 'var(--info)' },
    { label: 'Overdue', value: stats.overdue, color: 'var(--danger)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Maintenance Log</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Equipment maintenance history & scheduling</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ background: 'var(--surface2)', padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Total Cost: </span>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>${stats.totalCost.toLocaleString()}</span>
          </div>
          <button
            style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            onClick={openCreate}
          >
            + New Record
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {stats.overdue > 0 && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#991b1b',
            fontSize: 14,
          }}>
            <span style={{ fontSize: 16 }}>!</span>
            <strong>{stats.overdue} maintenance task{stats.overdue > 1 ? 's' : ''} overdue</strong>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          {statCards.map((s) => (
            <div key={s.label} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '16px 20px',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

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
            placeholder="Search maintenance logs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          >
            <option value="">All Types</option>
            <option value="preventive">Preventive</option>
            <option value="corrective">Corrective</option>
            <option value="calibration">Calibration</option>
            <option value="inspection">Inspection</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          >
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <Table
          columns={columns}
          data={logs}
          loading={loading}
          rowKey={(r) => r.id}
          onEdit={openEdit}
          onDelete={(r) => setDeleting(r)}
        />
        <Pagination page={page} pages={totalPages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Maintenance Record' : 'New Maintenance Record'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Instrument *</label>
              <select className="form-input" {...register('instrument_id', { required: true })}>
                <option value="">Select instrument...</option>
                {instruments.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input" {...register('type')}>
                <option value="preventive">Preventive</option>
                <option value="corrective">Corrective</option>
                <option value="calibration">Calibration</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>
            {editing && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" {...register('status')}>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" {...register('title', { required: true })} placeholder="e.g., Quarterly Calibration" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Scheduled Date *</label>
              <input type="date" className="form-input" {...register('scheduled_date', { required: true })} />
            </div>
            {editing && (
              <div className="form-group">
                <label className="form-label">Completed Date</label>
                <input type="date" className="form-input" {...register('completed_date')} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Cost ($)</label>
              <input type="number" step="0.01" className="form-input" {...register('cost')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={2} {...register('description')} placeholder="Describe the maintenance work..." />
          </div>
          <div className="form-group">
            <label className="form-label">Parts Replaced</label>
            <input className="form-input" {...register('parts_replaced')} placeholder="List any parts replaced" />
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
        message={`Delete this maintenance record?`}
      />
    </div>
  );
}
