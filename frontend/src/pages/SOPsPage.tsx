import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { sopsApi } from '../lib/api';

interface SOP {
  id: number;
  title: string;
  code: string;
  category: string;
  version: string;
  status: 'draft' | 'review' | 'approved' | 'archived';
  description: string;
  content: string;
  effective_date: string | null;
  review_date: string | null;
  author_id: number | null;
  author_name: string | null;
  approver_id: number | null;
  approver_name: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b' },
  review: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
  approved: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  archived: { bg: 'rgba(107, 114, 128, 0.15)', color: '#6b7280' },
};

const CATEGORIES = [
  'Sample Management',
  'Quality Control',
  'Safety',
  'Molecular Biology',
  'Cell Culture',
  'Equipment',
  'Data Management',
  'General',
];

export default function SOPsPage() {
  const [sops, setSops] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SOP | null>(null);
  const [deleting, setDeleting] = useState<SOP | null>(null);
  const [viewingSOP, setViewingSOP] = useState<SOP | null>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm<any>();

  async function fetchSOPs() {
    setLoading(true);
    try {
      const extra: Record<string, string> = {};
      if (statusFilter) extra.status = statusFilter;
      if (categoryFilter) extra.category = categoryFilter;
      const res = await sopsApi.list(page, perPage, search, extra);
      setSops(res.data.items);
      setTotalPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load SOPs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSOPs();
  }, [page, perPage, search, statusFilter, categoryFilter]);

  const stats = useMemo(() => ({
    total: total,
    approved: sops.filter(s => s.status === 'approved').length,
    review: sops.filter(s => s.status === 'review').length,
    draft: sops.filter(s => s.status === 'draft').length,
  }), [sops, total]);

  function openCreate() {
    setEditing(null);
    reset({ title: '', code: '', category: '', version: '1.0', status: 'draft', description: '', content: '', effective_date: '', review_date: '' });
    setModalOpen(true);
  }

  function openEdit(row: SOP) {
    setEditing(row);
    reset({
      title: row.title,
      code: row.code,
      category: row.category,
      version: row.version,
      status: row.status,
      description: row.description,
      content: row.content,
      effective_date: row.effective_date || '',
      review_date: row.review_date || '',
    });
    setModalOpen(true);
  }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      if (editing) {
        await sopsApi.update(editing.id, data);
        toast.success('SOP updated');
      } else {
        await sopsApi.create(data);
        toast.success('SOP created');
      }
      setModalOpen(false);
      fetchSOPs();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save SOP');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await sopsApi.delete(deleting.id);
      toast.success('SOP deleted');
      setDeleting(null);
      fetchSOPs();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete SOP');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(sop: SOP) {
    try {
      await sopsApi.approve(sop.id);
      toast.success('SOP approved');
      fetchSOPs();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to approve SOP');
    }
  }

  const columns: Column<SOP>[] = [
    { key: 'code', header: 'Code', width: '100px', render: (r) => (
      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>{r.code}</span>
    )},
    { key: 'title', header: 'Title', render: (r) => (
      <button
        onClick={() => setViewingSOP(r)}
        style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}
      >
        {r.title}
      </button>
    )},
    { key: 'category', header: 'Category' },
    { key: 'version', header: 'Version', width: '80px', render: (r) => (
      <span style={{ fontFamily: 'monospace' }}>v{r.version}</span>
    )},
    { key: 'status', header: 'Status', width: '100px', render: (r) => (
      <span style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'capitalize',
        ...STATUS_COLORS[r.status],
      }}>{r.status}</span>
    )},
    { key: 'author_name', header: 'Author', render: (r) => r.author_name || '—' },
    { key: 'effective_date', header: 'Effective', render: (r) => r.effective_date || '—' },
  ];

  const statCards = [
    { label: 'Total SOPs', value: stats.total, color: 'var(--accent)' },
    { label: 'Approved', value: stats.approved, color: 'var(--success)' },
    { label: 'In Review', value: stats.review, color: 'var(--warning)' },
    { label: 'Drafts', value: stats.draft, color: 'var(--text-muted)' },
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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>SOPs Library</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Standard Operating Procedures</p>
        </div>
        <button
          style={{ padding: '7px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          onClick={openCreate}
        >
          + New SOP
        </button>
      </div>

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
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
            placeholder="Search SOPs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
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
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="approved">Approved</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <Table
          columns={columns}
          data={sops}
          loading={loading}
          rowKey={(r) => r.id}
          onEdit={openEdit}
          onDelete={(r) => setDeleting(r)}
        />
        <Pagination
          page={page}
          pages={totalPages}
          total={total}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
        />
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit SOP' : 'New SOP'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" {...register('title', { required: true })} />
            </div>
            <div className="form-group">
              <label className="form-label">Code *</label>
              <input className="form-input" {...register('code', { required: true })} placeholder="SOP-XXX" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className="form-input" {...register('category', { required: true })}>
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Version</label>
              <input className="form-input" {...register('version')} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" {...register('status')}>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="approved">Approved</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={2} {...register('description')} placeholder="Brief description..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Effective Date</label>
              <input type="date" className="form-input" {...register('effective_date')} />
            </div>
            <div className="form-group">
              <label className="form-label">Review Date</label>
              <input type="date" className="form-input" {...register('review_date')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Content</label>
            <textarea className="form-textarea" rows={8} {...register('content')} placeholder="Enter SOP content..." />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!viewingSOP} onClose={() => setViewingSOP(null)} title={viewingSOP?.title || ''} size="lg">
        {viewingSOP && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div><strong>Code:</strong> {viewingSOP.code}</div>
              <div><strong>Version:</strong> v{viewingSOP.version}</div>
              <div><strong>Status:</strong> <span style={{ ...STATUS_COLORS[viewingSOP.status], padding: '2px 8px', borderRadius: 8 }}>{viewingSOP.status}</span></div>
              <div><strong>Author:</strong> {viewingSOP.author_name || '—'}</div>
              {viewingSOP.status === 'review' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { handleApprove(viewingSOP); setViewingSOP(null); }}
                >
                  Approve
                </button>
              )}
            </div>
            {viewingSOP.description && (
              <div style={{ marginBottom: 16, color: 'var(--text-muted)' }}>
                {viewingSOP.description}
              </div>
            )}
            <div style={{ background: 'var(--surface2)', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
              {viewingSOP.content || 'No content available.'}
            </div>
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Effective: {viewingSOP.effective_date || '—'}</span>
              <span style={{ marginLeft: 16 }}>Review: {viewingSOP.review_date || '—'}</span>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        message={`Delete SOP "${deleting?.title}"?`}
      />
    </div>
  );
}
