import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { samplesApi } from '../lib/api';
import type { SampleRecord } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { usePagedApi } from '../hooks/useApi';
import { statusColor, generateSampleId, formatDate } from '../lib/utils';

const STATUS_OPTIONS = ['received', 'processing', 'stored', 'sequenced', 'archived', 'disposed'] as const;

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
      color,
      border: `1px solid ${color}33`,
      textTransform: 'capitalize',
    }}>{status}</span>
  );
}

export default function SamplesPage() {
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<SampleRecord>(
    (p, pp, s) => samplesApi.list(p, pp, s)
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SampleRecord | null>(null);
  const [deleting, setDeleting] = useState<SampleRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<any>();

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUS_OPTIONS) counts[s] = 0;
    for (const item of items) {
      if (counts[item.status] !== undefined) counts[item.status]++;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return items;
    return items.filter(r => r.status === statusFilter);
  }, [items, statusFilter]);

  function openCreate() {
    setEditing(null);
    reset({
      sample_id: generateSampleId(),
      barcode: '',
      sample_type: '',
      source: '',
      storage_location: '',
      status: 'received',
      received_on: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setModalOpen(true);
  }

  function openEdit(row: SampleRecord) {
    setEditing(row);
    reset({ ...row });
    setModalOpen(true);
  }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      if (editing) {
        await samplesApi.update(editing.id, data);
        toast.success('Sample updated');
      } else {
        await samplesApi.create(data);
        toast.success('Sample created');
      }
      setModalOpen(false);
      reload();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await samplesApi.delete(deleting.id);
      toast.success('Sample deleted');
      setDeleting(null);
      reload();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<SampleRecord>[] = [
    { key: 'sample_id', header: 'Sample ID', render: (r) => (
      <span style={{
        fontFamily: 'monospace',
        fontSize: 12,
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '2px 8px',
        color: 'var(--accent)',
        fontWeight: 600,
      }}>{r.sample_id}</span>
    )},
    { key: 'barcode', header: 'Barcode', render: (r) => r.barcode ? (
      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.barcode}</span>
    ) : '—' },
    { key: 'sample_type', header: 'Type' },
    { key: 'source', header: 'Source' },
    { key: 'project_name', header: 'Project', render: (r) => r.project_name || '—' },
    { key: 'status', header: 'Status', render: (r) => statusBadge(r.status) },
    { key: 'owner_name', header: 'Owner', render: (r) => r.owner_name || '—' },
    { key: 'received_on', header: 'Received', render: (r) => formatDate(r.received_on) },
  ];

  const pipelineColors: Record<string, string> = {
    received: '#6366f1',
    processing: '#f97316',
    stored: '#22c55e',
    sequenced: '#0ea5e9',
    archived: '#8b5cf6',
    disposed: '#94a3b8',
  };

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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Samples</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{total} sample records</p>
        </div>
        <button
          style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          onClick={openCreate}
        >
          + New Sample
        </button>
      </div>

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* Status Pipeline */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {STATUS_OPTIONS.map((s, i) => {
            const count = stats[s] || 0;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  background: active ? pipelineColors[s] : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text)',
                  border: 'none',
                  borderRight: i < STATUS_OPTIONS.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: active ? '#fff' : pipelineColors[s] }}>{count}</div>
                <div style={{ fontSize: 11, textTransform: 'capitalize', marginTop: 2, opacity: active ? 1 : 0.7 }}>{s}</div>
              </button>
            );
          })}
        </div>

        {/* Search + Filter Bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <input
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
            }}
            placeholder="Search by ID, barcode, source..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Clear filter ✕
            </button>
          )}
        </div>

        <Table
          columns={columns}
          data={filteredItems}
          loading={loading}
          rowKey={(r) => r.id}
          onEdit={openEdit}
          onDelete={(r) => setDeleting(r)}
        />
        <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Sample' : 'New Sample'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Sample ID *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" {...register('sample_id', { required: 'Required' })} style={{ flex: 1 }} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setValue('sample_id', generateSampleId())}>Generate</button>
              </div>
              {errors.sample_id && <span className="field-error">{String(errors.sample_id.message)}</span>}
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Barcode</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" {...register('barcode')} style={{ flex: 1 }} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setScannerOpen(true)}>📷 Scan</button>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sample Type *</label>
              <input className="form-input" {...register('sample_type', { required: 'Required' })} />
              {errors.sample_type && <span className="field-error">{String(errors.sample_type.message)}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Source</label>
              <input className="form-input" {...register('source')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Storage Location</label>
              <input className="form-input" {...register('storage_location')} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" {...register('status')}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Received On *</label>
              <input type="date" className="form-input" {...register('received_on', { required: 'Required' })} />
            </div>
            <div className="form-group">
              <label className="form-label">Owner (User ID)</label>
              <input type="number" className="form-input" {...register('owner_id')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} {...register('notes')} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(v) => { setValue('barcode', v); setScannerOpen(false); toast.success(`Scanned: ${v}`); }}
      />

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        message={`Delete sample "${deleting?.sample_id}"?`}
      />
    </div>
  );
}
