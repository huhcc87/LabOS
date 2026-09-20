import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { complianceApi } from '../lib/api';
import type { ComplianceLog } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePagedApi } from '../hooks/useApi';
import { formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const CATEGORY_COLORS: Record<string, string> = {
  Safety: '#ef4444',
  Training: '#6366f1',
  Equipment: '#f59e0b',
  Data: '#22c55e',
  Regulatory: '#8b5cf6',
  'Quality Control': '#06b6d4',
  Default: '#94a3b8',
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.Default;
}

export default function CompliancePage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('manager');
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<ComplianceLog>(
    (p, pp, s) => complianceApi.list(p, pp, s)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ComplianceLog | null>(null);
  const [deleting, setDeleting] = useState<ComplianceLog | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));
  const filtered = categoryFilter ? items.filter(i => i.category === categoryFilter) : items;
  const categoryCounts = categories.reduce((acc, c) => { acc[c] = items.filter(i => i.category === c).length; return acc; }, {} as Record<string, number>);

  function openCreate() { setEditing(null); reset({ title: '', category: '', details: '' }); setModalOpen(true); }
  function openEdit(row: ComplianceLog) { setEditing(row); reset({ ...row }); setModalOpen(true); }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      editing ? await complianceApi.update(editing.id, data) : await complianceApi.create(data);
      toast.success(editing ? 'Log updated' : 'Log created');
      setModalOpen(false); reload();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setSaving(true);
    try { await complianceApi.delete(deleting.id); toast.success('Deleted'); setDeleting(null); reload(); }
    catch { toast.error('Delete failed'); } finally { setSaving(false); }
  }

  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const lbl = { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 as const, display: 'block' as const, marginBottom: 4 };

  const columns: Column<ComplianceLog>[] = [
    { key: 'title', header: 'Title', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.title}</span> },
    { key: 'category', header: 'Category', render: (r) => {
      const c = getCategoryColor(r.category);
      return <span style={{ background: c + '22', color: c, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{r.category}</span>;
    }},
    { key: 'logger_name', header: 'Logged By', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.logger_name || '—'}</span> },
    { key: 'details', header: 'Details', render: (r) => <span style={{ color: 'var(--text-soft)', fontSize: 12 }}>{r.details?.slice(0, 80)}{r.details?.length > 80 ? '…' : ''}</span> },
    { key: 'created_at', header: 'Date', render: (r) => formatDate(r.created_at) },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Compliance Logs</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>{total} entries · {categories.length} categories</p>
          </div>
          {canEdit && <button onClick={openCreate} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ New Log</button>}
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Category summary cards */}
        {categories.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            {categories.map(cat => {
              const color = getCategoryColor(cat);
              const active = categoryFilter === cat;
              return (
                <div key={cat} onClick={() => setCategoryFilter(active ? '' : cat)} style={{
                  background: active ? color + '22' : 'var(--surface)', border: `1px solid ${active ? color : 'var(--border)'}`,
                  borderLeft: `4px solid ${color}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color }}>{categoryCounts[cat] || 0}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{cat}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Category filter chips */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setCategoryFilter('')} style={{
              background: !categoryFilter ? 'var(--accent)' : 'var(--surface2)', border: `1px solid ${!categoryFilter ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 20, color: !categoryFilter ? '#fff' : 'var(--text-muted)', padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: !categoryFilter ? 700 : 400,
            }}>All</button>
            {categories.map(cat => {
              const color = getCategoryColor(cat);
              const active = categoryFilter === cat;
              return (
                <button key={cat} onClick={() => setCategoryFilter(active ? '' : cat)} style={{
                  background: active ? color + '22' : 'var(--surface2)', border: `1px solid ${active ? color : 'var(--border)'}`,
                  borderRadius: 20, color: active ? color : 'var(--text-muted)', padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 400,
                }}>{cat}</button>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search compliance logs..."
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <Table columns={columns} data={filtered} loading={loading} rowKey={(r) => r.id}
          onEdit={canEdit ? openEdit : undefined} onDelete={canEdit ? (r) => setDeleting(r) : undefined} />
        <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Log' : 'New Compliance Log'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group"><label style={lbl}>Title *</label><input style={inp} {...register('title', { required: 'Required' })} />{errors.title && <span className="field-error">{String(errors.title.message)}</span>}</div>
            <div className="form-group"><label style={lbl}>Category *</label><input style={inp} {...register('category', { required: 'Required' })} placeholder="e.g. Safety, Training, Equipment" /></div>
          </div>
          <div className="form-group"><label style={lbl}>Details *</label><textarea style={{ ...inp, resize: 'vertical' }} rows={4} {...register('details', { required: 'Required' })} /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={saving} message={`Delete log "${deleting?.title}"?`} />
    </div>
  );
}
