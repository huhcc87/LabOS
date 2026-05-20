import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { suppliersApi } from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id: number;
  supplier_id: string;
  company: string;
  category: string;
  subcategory: string;
  description: string;
  procurement_priority: string;
  approval_status: string;
  is_preferred: boolean;
  website: string;
  contact_email: string;
  contact_phone: string;
  rating: number;
  total_orders: number;
  budget_tier: string;
  country_region: string;
  primary_offerings: string;
  common_applications: string;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier?: { company: string };
  status: string;
  total: number;
  urgency: string;
  project_code: string;
  expected_delivery: string;
  tracking_number: string;
  notes: string;
  items_json: string;
  created_at: string;
}

const PO_STATUSES = ['all', 'draft', 'pending_approval', 'approved', 'ordered', 'shipped', 'received', 'cancelled'];

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  High:     { bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
  Medium:   { bg: 'rgba(234,179,8,0.15)',   text: '#fbbf24' },
  Low:      { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80' },
  Specialty:{ bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa' },
};

const APPROVAL_COLORS: Record<string, { bg: string; text: string }> = {
  approved: { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80' },
  pending:  { bg: 'rgba(234,179,8,0.15)',   text: '#fbbf24' },
  review:   { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa' },
  rejected: { bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
};

const PO_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:            { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
  pending_approval: { bg: 'rgba(234,179,8,0.15)',   text: '#fbbf24' },
  approved:         { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa' },
  ordered:          { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa' },
  shipped:          { bg: 'rgba(6,182,212,0.15)',   text: '#22d3ee' },
  received:         { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80' },
  cancelled:        { bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
};

const URGENCY_COLORS: Record<string, { bg: string; text: string }> = {
  normal:   { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
  urgent:   { bg: 'rgba(234,179,8,0.15)',   text: '#fbbf24' },
  critical: { bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers');

  // ── Suppliers state ──────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppLoading, setSuppLoading] = useState(false);
  const [suppSearch, setSuppSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState({ total: 0, approved: 0, preferred: 0 });
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    company: '', category: '', subcategory: '', procurement_priority: 'Medium',
    budget_tier: 'Mid-market', website: '', contact_email: '', contact_phone: '', description: '',
  });

  // ── Orders state ─────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [openOrderStats, setOpenOrderStats] = useState(0);
  const [newOrder, setNewOrder] = useState({
    supplier_id: 0, urgency: 'normal', project_code: '',
    expected_delivery: '', notes: '',
  });

  // ── Loaders ───────────────────────────────────────────────────────────────

  async function loadSuppliers() {
    setSuppLoading(true);
    try {
      const extra: Record<string, string> = {};
      if (categoryFilter) extra.category = categoryFilter;
      if (statusFilter) extra.approval_status = statusFilter;
      const r = await suppliersApi.list(1, 100, suppSearch, extra);
      setSuppliers(r.data.items);
      try {
        const s = await suppliersApi.stats();
        setStats(s.data);
      } catch { /* stats optional */ }
    } catch {
      toast.error('Failed to load suppliers');
    } finally {
      setSuppLoading(false);
    }
  }

  async function loadOrders() {
    setOrdersLoading(true);
    try {
      const status = orderStatusFilter === 'all' ? '' : orderStatusFilter;
      const r = await suppliersApi.listOrders(1, 100, status);
      setOrders(r.data.items);
      setOpenOrderStats(r.data.items.filter((o: PurchaseOrder) =>
        !['received', 'cancelled'].includes(o.status)
      ).length);
    } catch {
      toast.error('Failed to load purchase orders');
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppSearch, categoryFilter, statusFilter]);

  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, orderStatusFilter]);

  // ── Supplier handlers ─────────────────────────────────────────────────────

  const handleCreateSupplier = async () => {
    if (!newSupplier.company) { toast.error('Company name is required'); return; }
    try {
      await suppliersApi.create({
        ...newSupplier,
        supplier_id: `SUP-${Date.now().toString().slice(-6)}`,
        approval_status: 'pending',
      });
      setShowAddSupplier(false);
      setNewSupplier({ company: '', category: '', subcategory: '', procurement_priority: 'Medium', budget_tier: 'Mid-market', website: '', contact_email: '', contact_phone: '', description: '' });
      toast.success('Supplier added!');
      await loadSuppliers();
    } catch {
      toast.error('Failed to add supplier');
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    try {
      await suppliersApi.delete(id);
      toast.success('Supplier removed');
      setSelectedSupplier(null);
      await loadSuppliers();
    } catch {
      toast.error('Failed to remove supplier');
    }
  };

  // ── Order handlers ────────────────────────────────────────────────────────

  const handleCreateOrder = async () => {
    if (!newOrder.supplier_id) { toast.error('Select a supplier'); return; }
    try {
      await suppliersApi.createOrder({
        ...newOrder,
        po_number: `PO-${Date.now().toString().slice(-8)}`,
        status: 'draft',
        items_json: '[]',
        subtotal: 0, tax: 0, shipping: 0, total: 0,
      });
      setShowNewOrder(false);
      setNewOrder({ supplier_id: 0, urgency: 'normal', project_code: '', expected_delivery: '', notes: '' });
      toast.success('Purchase order created!');
      await loadOrders();
    } catch {
      toast.error('Failed to create order');
    }
  };

  const handleOrderAction = async (order: PurchaseOrder, action: string) => {
    try {
      if (action === 'submit') {
        await suppliersApi.updateOrder(order.id, { status: 'pending_approval' });
        toast.success('Submitted for approval');
      } else if (action === 'approve') {
        await suppliersApi.approveOrder(order.id);
        toast.success('Order approved');
      } else if (action === 'ordered') {
        await suppliersApi.updateOrder(order.id, { status: 'ordered' });
        toast.success('Marked as ordered');
      } else if (action === 'receive') {
        await suppliersApi.receiveOrder(order.id);
        toast.success('Order received!');
      } else if (action === 'cancel') {
        await suppliersApi.updateOrder(order.id, { status: 'cancelled' });
        toast.success('Order cancelled');
      }
      await loadOrders();
    } catch {
      toast.error('Action failed');
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const Badge = ({ label, colors }: { label: string; colors: { bg: string; text: string } }) => (
    <span style={{
      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: colors.bg, color: colors.text, textTransform: 'capitalize',
    }}>{label}</span>
  );

  const Stars = ({ n }: { n: number }) => (
    <span style={{ fontSize: 12, letterSpacing: 1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= n ? '#fbbf24' : 'var(--border)' }}>★</span>
      ))}
    </span>
  );

  const modalStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  };
  const modalBox: React.CSSProperties = {
    background: 'var(--surface)', borderRadius: 16, padding: 28,
    width: 540, maxHeight: '90vh', overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
  };

  const uniqueCategories = [...new Set(suppliers.map(s => s.category).filter(Boolean))];

  return (
    <div className="page" style={{ maxWidth: 1300, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Suppliers & Procurement</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Manage your lab supplier directory and purchase orders
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { icon: '🏭', label: 'Total Suppliers', value: stats.total || suppliers.length, color: '#60a5fa' },
          { icon: '✅', label: 'Approved',         value: stats.approved || suppliers.filter(s => s.approval_status === 'approved').length, color: '#4ade80' },
          { icon: '⭐', label: 'Preferred',        value: stats.preferred || suppliers.filter(s => s.is_preferred).length, color: '#fbbf24' },
          { icon: '📋', label: 'Open POs',         value: openOrderStats, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {(['suppliers', 'orders'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '11px 22px', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: activeTab === tab ? 600 : 400, fontSize: 14, marginBottom: -1,
            textTransform: 'capitalize',
          }}>
            {tab === 'suppliers' ? '🏭 Suppliers' : '📋 Purchase Orders'}
          </button>
        ))}
      </div>

      {/* ── SUPPLIERS TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'suppliers' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input"
              placeholder="🔍 Search suppliers..."
              style={{ flex: 1, minWidth: 200 }}
              value={suppSearch}
              onChange={e => setSuppSearch(e.target.value)}
            />
            <select className="form-select" style={{ minWidth: 170 }}
              value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="form-select" style={{ minWidth: 150 }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="review">Under Review</option>
              <option value="rejected">Rejected</option>
            </select>
            {(suppSearch || categoryFilter || statusFilter) && (
              <button className="btn btn-secondary" onClick={() => { setSuppSearch(''); setCategoryFilter(''); setStatusFilter(''); }}>
                Clear
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setShowAddSupplier(true)}>+ Add Supplier</button>
          </div>

          {suppLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <div>Loading suppliers...</div>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏭</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Suppliers Found</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
                {suppSearch || categoryFilter || statusFilter
                  ? 'Try clearing your filters'
                  : 'Add your first supplier to get started'}
              </p>
              <button className="btn btn-primary" onClick={() => setShowAddSupplier(true)}>+ Add Supplier</button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['Company', 'Category', 'Priority', 'Status', 'Rating', 'Tier', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(s => (
                    <tr key={s.id} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => setSelectedSupplier(s)}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                            🏭
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {s.company}
                              {s.is_preferred && <span style={{ marginLeft: 6, fontSize: 11, color: '#fbbf24' }}>⭐</span>}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.supplier_id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', maxWidth: 160 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.category || '—'}</div>
                        {s.subcategory && <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>{s.subcategory}</div>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <Badge label={s.procurement_priority || 'Medium'} colors={PRIORITY_COLORS[s.procurement_priority] ?? PRIORITY_COLORS.Medium} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <Badge label={s.approval_status || 'pending'} colors={APPROVAL_COLORS[s.approval_status] ?? APPROVAL_COLORS.pending} />
                      </td>
                      <td style={{ padding: '12px 14px' }}><Stars n={s.rating} /></td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{s.budget_tier || '—'}</td>
                      <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => setSelectedSupplier(s)}>View</button>
                          <button className="btn btn-sm btn-primary" onClick={() => {
                            setNewOrder(o => ({ ...o, supplier_id: s.id }));
                            setActiveTab('orders');
                            setShowNewOrder(true);
                          }}>+ PO</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PURCHASE ORDERS TAB ───────────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div>
          {/* Status filter pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
              {PO_STATUSES.map(s => (
                <button key={s} onClick={() => setOrderStatusFilter(s)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  border: orderStatusFilter === s ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: orderStatusFilter === s ? 'var(--accent)' : 'var(--surface2)',
                  color: orderStatusFilter === s ? 'white' : 'var(--text-muted)',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => setShowNewOrder(true)}>+ New PO</button>
          </div>

          {ordersLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <div>Loading orders...</div>
            </div>
          ) : orders.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Purchase Orders</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
                {orderStatusFilter !== 'all' ? 'No orders with this status' : 'Create your first purchase order'}
              </p>
              <button className="btn btn-primary" onClick={() => setShowNewOrder(true)}>+ New PO</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.map(order => {
                const colors = PO_STATUS_COLORS[order.status] ?? PO_STATUS_COLORS.draft;
                const urgColors = URGENCY_COLORS[order.urgency] ?? URGENCY_COLORS.normal;
                return (
                  <div key={order.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16 }}>
                    {/* PO number + supplier */}
                    <div style={{ flex: 1.5, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{order.po_number}</span>
                        <Badge label={order.status.replace('_', ' ')} colors={colors} />
                        {order.urgency !== 'normal' && <Badge label={order.urgency} colors={urgColors} />}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {order.supplier?.company ?? `Supplier #${order.supplier_id}`}
                        {order.project_code && ` • ${order.project_code}`}
                      </div>
                    </div>

                    {/* Total */}
                    <div style={{ textAlign: 'right', minWidth: 90 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                        ${((order.total ?? 0) / 100).toLocaleString()}
                      </div>
                    </div>

                    {/* Delivery */}
                    <div style={{ minWidth: 110, fontSize: 12, color: 'var(--text-muted)' }}>
                      {order.expected_delivery
                        ? <><span style={{ fontSize: 10, display: 'block', marginBottom: 1 }}>Expected</span>{order.expected_delivery}</>
                        : '—'}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {order.status === 'draft' && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleOrderAction(order, 'submit')}>Submit</button>
                      )}
                      {order.status === 'pending_approval' && (
                        <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: 'none' }} onClick={() => handleOrderAction(order, 'approve')}>✓ Approve</button>
                      )}
                      {order.status === 'approved' && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleOrderAction(order, 'ordered')}>Mark Ordered</button>
                      )}
                      {['ordered', 'shipped'].includes(order.status) && (
                        <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: 'none' }} onClick={() => handleOrderAction(order, 'receive')}>✓ Received</button>
                      )}
                      {!['received', 'cancelled'].includes(order.status) && (
                        <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'none' }} onClick={() => handleOrderAction(order, 'cancel')}>✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SUPPLIER DETAIL MODAL ─────────────────────────────────────────── */}
      {selectedSupplier && (
        <div style={modalStyle} onClick={() => setSelectedSupplier(null)}>
          <div style={{ ...modalBox, width: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                  {selectedSupplier.company}
                  {selectedSupplier.is_preferred && <span style={{ marginLeft: 8, color: '#fbbf24', fontSize: 18 }}>⭐</span>}
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedSupplier.supplier_id}</span>
              </div>
              <button onClick={() => setSelectedSupplier(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              <Badge label={selectedSupplier.approval_status} colors={APPROVAL_COLORS[selectedSupplier.approval_status] ?? APPROVAL_COLORS.pending} />
              <Badge label={selectedSupplier.procurement_priority} colors={PRIORITY_COLORS[selectedSupplier.procurement_priority] ?? PRIORITY_COLORS.Medium} />
              <Badge label={selectedSupplier.budget_tier || 'Mid-market'} colors={{ bg: 'rgba(99,102,241,0.15)', text: '#818cf8' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Category', value: selectedSupplier.category },
                { label: 'Subcategory', value: selectedSupplier.subcategory },
                { label: 'Country / Region', value: selectedSupplier.country_region },
                { label: 'Total Orders', value: String(selectedSupplier.total_orders) },
                { label: 'Email', value: selectedSupplier.contact_email },
                { label: 'Phone', value: selectedSupplier.contact_phone },
              ].filter(r => r.value).map(row => (
                <div key={row.label}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{row.label}</div>
                  <div style={{ fontSize: 13 }}>{row.value}</div>
                </div>
              ))}
            </div>

            {selectedSupplier.website && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Website</div>
                <a href={selectedSupplier.website} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--accent)' }}>{selectedSupplier.website}</a>
              </div>
            )}

            {selectedSupplier.description && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>About</div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>{selectedSupplier.description}</p>
              </div>
            )}

            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Rating</div>
            <Stars n={selectedSupplier.rating} />

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setSelectedSupplier(null)} style={{ flex: 1 }}>Close</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                setNewOrder(o => ({ ...o, supplier_id: selectedSupplier.id }));
                setSelectedSupplier(null);
                setActiveTab('orders');
                setShowNewOrder(true);
              }}>📋 Create PO</button>
              <button style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}
                onClick={() => handleDeleteSupplier(selectedSupplier.id)}>
                🗑️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD SUPPLIER MODAL ────────────────────────────────────────────── */}
      {showAddSupplier && (
        <div style={modalStyle} onClick={() => setShowAddSupplier(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Add Supplier</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Company Name *</label>
                <input className="form-input" placeholder="e.g., Thermo Fisher Scientific"
                  value={newSupplier.company} onChange={e => setNewSupplier({ ...newSupplier, company: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Category</label>
                  <input className="form-input" placeholder="e.g., Reagents & Consumables"
                    value={newSupplier.category} onChange={e => setNewSupplier({ ...newSupplier, category: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Subcategory</label>
                  <input className="form-input" placeholder="e.g., PCR Reagents"
                    value={newSupplier.subcategory} onChange={e => setNewSupplier({ ...newSupplier, subcategory: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Priority</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={newSupplier.procurement_priority} onChange={e => setNewSupplier({ ...newSupplier, procurement_priority: e.target.value })}>
                    {['High', 'Medium', 'Low', 'Specialty'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Budget Tier</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={newSupplier.budget_tier} onChange={e => setNewSupplier({ ...newSupplier, budget_tier: e.target.value })}>
                    {['Premium', 'Mid-market', 'Economy'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Website</label>
                <input className="form-input" placeholder="https://..."
                  value={newSupplier.website} onChange={e => setNewSupplier({ ...newSupplier, website: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Contact Email</label>
                  <input className="form-input" type="email" placeholder="sales@vendor.com"
                    value={newSupplier.contact_email} onChange={e => setNewSupplier({ ...newSupplier, contact_email: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Contact Phone</label>
                  <input className="form-input" placeholder="+1 (800) 000-0000"
                    value={newSupplier.contact_phone} onChange={e => setNewSupplier({ ...newSupplier, contact_phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Description</label>
                <textarea className="form-input" rows={3} placeholder="Brief description of products/services..."
                  value={newSupplier.description} onChange={e => setNewSupplier({ ...newSupplier, description: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddSupplier(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateSupplier} style={{ flex: 1 }}>Add Supplier</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW PO MODAL ──────────────────────────────────────────────────── */}
      {showNewOrder && (
        <div style={modalStyle} onClick={() => setShowNewOrder(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>New Purchase Order</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Supplier *</label>
                <select className="form-select" style={{ width: '100%' }}
                  value={newOrder.supplier_id} onChange={e => setNewOrder({ ...newOrder, supplier_id: Number(e.target.value) })}>
                  <option value={0}>Select supplier…</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Urgency</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={newOrder.urgency} onChange={e => setNewOrder({ ...newOrder, urgency: e.target.value })}>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Project Code</label>
                  <input className="form-input" placeholder="e.g., PROJ-2024"
                    value={newOrder.project_code} onChange={e => setNewOrder({ ...newOrder, project_code: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Expected Delivery</label>
                <input type="date" className="form-input"
                  value={newOrder.expected_delivery} onChange={e => setNewOrder({ ...newOrder, expected_delivery: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Notes</label>
                <textarea className="form-input" rows={3} placeholder="Special instructions, catalog numbers..."
                  value={newOrder.notes} onChange={e => setNewOrder({ ...newOrder, notes: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button className="btn btn-secondary" onClick={() => setShowNewOrder(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateOrder} style={{ flex: 1 }}>Create PO</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
