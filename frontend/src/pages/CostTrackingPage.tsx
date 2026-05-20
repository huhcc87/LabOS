import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { costsApi } from '../lib/api';

interface CostEntry {
  id: number;
  category: 'reagents' | 'equipment' | 'maintenance' | 'services' | 'personnel' | 'other';
  description: string;
  amount: number;
  project: string;
  date: string;
  vendor: string;
  invoice_number: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  submitted_by_id: number | null;
  submitted_by_name: string | null;
  approved_by_id: number | null;
  approved_by_name: string | null;
  notes: string;
  created_at: string;
}

const CATEGORY_CONFIG: Record<string, { color: string; icon: string }> = {
  reagents: { color: '#6366f1', icon: '🧪' },
  equipment: { color: '#22c55e', icon: '🔧' },
  maintenance: { color: '#f59e0b', icon: '⚙️' },
  services: { color: '#38bdf8', icon: '📋' },
  personnel: { color: '#ec4899', icon: '👤' },
  other: { color: '#64748b', icon: '📦' },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
  approved: { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' },
  paid: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
};

export default function CostTrackingPage() {
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CostEntry | null>(null);
  const [deleting, setDeleting] = useState<CostEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm<any>();

  async function fetchCosts() {
    setLoading(true);
    try {
      const extra: Record<string, string> = {};
      if (categoryFilter) extra.category = categoryFilter;
      if (statusFilter) extra.status = statusFilter;
      const res = await costsApi.list(page, perPage, search, extra);
      setCosts(res.data.items);
      setTotalPages(res.data.pages);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCosts();
  }, [page, perPage, search, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalAmount = costs.reduce((sum, c) => sum + c.amount, 0);
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    costs.forEach(c => {
      byCategory[c.category] = (byCategory[c.category] || 0) + c.amount;
      byStatus[c.status] = (byStatus[c.status] || 0) + c.amount;
    });

    return { total: totalAmount, byCategory, byStatus, count: total };
  }, [costs, total]);

  const projects = useMemo(() => Array.from(new Set(costs.map(c => c.project).filter(Boolean))), [costs]);

  function openCreate() {
    setEditing(null);
    reset({
      category: 'reagents',
      description: '',
      amount: '',
      project: '',
      date: new Date().toISOString().split('T')[0],
      vendor: '',
      invoice_number: '',
      status: 'pending',
      notes: ''
    });
    setModalOpen(true);
  }

  function openEdit(row: CostEntry) {
    setEditing(row);
    reset({
      category: row.category,
      description: row.description,
      amount: row.amount,
      project: row.project,
      date: row.date,
      vendor: row.vendor,
      invoice_number: row.invoice_number,
      status: row.status,
      notes: row.notes,
    });
    setModalOpen(true);
  }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      const payload = { ...data, amount: Number(data.amount) };
      if (editing) {
        await costsApi.update(editing.id, payload);
        toast.success('Entry updated');
      } else {
        await costsApi.create(payload);
        toast.success('Entry added');
      }
      setModalOpen(false);
      fetchCosts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await costsApi.delete(deleting.id);
      toast.success('Entry deleted');
      setDeleting(null);
      fetchCosts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete expense');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(cost: CostEntry) {
    try {
      await costsApi.approve(cost.id);
      toast.success('Expense approved');
      fetchCosts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to approve expense');
    }
  }

  async function handleReject(cost: CostEntry) {
    try {
      await costsApi.reject(cost.id);
      toast.success('Expense rejected');
      fetchCosts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to reject expense');
    }
  }

  function exportToCSV() {
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Project', 'Vendor', 'Invoice', 'Status'];
    const rows = costs.map(c => [c.date, c.category, c.description, c.amount, c.project, c.vendor, c.invoice_number, c.status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  }

  const columns: Column<CostEntry>[] = [
    { key: 'date', header: 'Date', width: '100px' },
    { key: 'category', header: 'Category', width: '120px', render: (r) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span>{CATEGORY_CONFIG[r.category]?.icon}</span>
        <span style={{ textTransform: 'capitalize' }}>{r.category}</span>
      </span>
    )},
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', width: '100px', render: (r) => (
      <span style={{ fontWeight: 600, color: 'var(--text)' }}>${r.amount.toLocaleString()}</span>
    )},
    { key: 'project', header: 'Project', render: (r) => r.project || '—' },
    { key: 'vendor', header: 'Vendor', render: (r) => r.vendor || '—' },
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
    { key: 'actions', header: '', width: '120px', render: (r) => (
      r.status === 'pending' ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); handleApprove(r); }}
            style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: 'none', cursor: 'pointer', fontSize: 11 }}
          >
            Approve
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleReject(r); }}
            style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 11 }}
          >
            Reject
          </button>
        </div>
      ) : null
    )},
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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Cost Tracking</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Track lab expenses by project and category</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportToCSV} style={{
            padding: '7px 16px',
            borderRadius: 8,
            background: 'var(--surface2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}>
            Export CSV
          </button>
          <button onClick={openCreate} style={{
            padding: '7px 16px',
            borderRadius: 8,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}>
            + Add Expense
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '20px',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Total Expenses</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>${stats.total.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{stats.count} entries</div>
          </div>
          {Object.entries(stats.byCategory).slice(0, 4).map(([cat, amount]) => (
            <div key={cat} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '20px',
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{CATEGORY_CONFIG[cat]?.icon}</span>
                <span style={{ textTransform: 'capitalize' }}>{cat}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: CATEGORY_CONFIG[cat]?.color }}>${amount.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
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
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
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
            {Object.keys(CATEGORY_CONFIG).map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>)}
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
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            Loading expenses...
          </div>
        )}

        {!loading && (
          <>
            <Table
              columns={columns}
              data={costs}
              loading={false}
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
          </>
        )}

        {!loading && costs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
            <p>No expenses found</p>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Expense' : 'Add Expense'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className="form-input" {...register('category', { required: true })}>
                {Object.keys(CATEGORY_CONFIG).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount ($) *</label>
              <input type="number" step="0.01" className="form-input" {...register('amount', { required: true })} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" {...register('status')}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description *</label>
            <input className="form-input" {...register('description', { required: true })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Project</label>
              <input className="form-input" list="projects" {...register('project')} />
              <datalist id="projects">
                {projects.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" {...register('date', { required: true })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Vendor</label>
              <input className="form-input" {...register('vendor')} />
            </div>
            <div className="form-group">
              <label className="form-label">Invoice Number</label>
              <input className="form-input" {...register('invoice_number')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} {...register('notes')} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        message={`Delete this expense entry?`}
      />
    </div>
  );
}
