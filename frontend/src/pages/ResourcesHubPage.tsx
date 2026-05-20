import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { inventoryApi, templatesApi, costsApi, aiApi } from '../lib/api';
import { exportCSV, exportPDF } from '../lib/export';
import { useNavigate } from '../context/NavigationContext';

// Types
interface InventoryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minStock: number;
  location: string;
  supplier: string;
  cost: number;
  status: 'ok' | 'low' | 'critical';
  lastUpdated: string;
}

interface Template {
  id: number;
  name: string;
  type: string;
  description: string;
  content: string;
  lastUsed: string;
  usageCount: number;
  createdBy: string;
}

interface Expense {
  id: number;
  description: string;
  category: string;
  amount: number;
  date: string;
  vendor: string;
  status: 'pending' | 'approved' | 'rejected';
}

// Constants
const CATEGORIES = ['Reagents', 'Consumables', 'Cell Culture', 'PPE', 'Chemicals', 'Glassware', 'Electronics', 'Other'];
const UNITS = ['pcs', 'tubes', 'bottles', 'pairs', 'boxes', 'mL', 'L', 'g', 'kg', 'packs'];
const TEMPLATE_TYPES = ['Document', 'Spreadsheet', 'Protocol', 'Report', 'Form', 'Checklist'];
const EXPENSE_CATEGORIES = ['Reagents', 'Equipment', 'Consumables', 'Services', 'Maintenance', 'Software', 'Travel', 'Other'];

// Backend → frontend mappers
function mapInvItem(raw: any): InventoryItem {
  const qty = raw.quantity ?? 0;
  const min = raw.reorder_threshold ?? 0;
  const status: InventoryItem['status'] = qty <= min * 0.25 ? 'critical' : qty <= min ? 'low' : 'ok';
  return {
    id: raw.id,
    name: raw.name ?? '',
    category: raw.category ? (raw.category.charAt(0).toUpperCase() + raw.category.slice(1)) : 'Reagents',
    quantity: qty,
    unit: raw.unit ?? 'pcs',
    minStock: min,
    location: raw.storage_location ?? '',
    supplier: raw.supplier?.company ?? '',
    cost: (raw.unit_price ?? 0) / 100,
    status,
    lastUpdated: raw.last_ordered ?? new Date().toISOString().slice(0, 10),
  };
}

function mapTemplate(raw: any): Template {
  const typeMap: Record<string, string> = {
    protocol: 'Protocol', report: 'Report', form: 'Form', checklist: 'Checklist',
  };
  return {
    id: raw.id,
    name: raw.name ?? '',
    type: typeMap[raw.category] ?? 'Document',
    description: raw.description ?? '',
    content: raw.content ?? '',
    lastUsed: raw.updated_at?.slice(0, 10) ?? 'Never',
    usageCount: raw.usage_count ?? 0,
    createdBy: raw.created_by?.full_name ?? 'Lab Team',
  };
}

function mapExpense(raw: any): Expense {
  const catMap: Record<string, string> = {
    reagents: 'Reagents', equipment: 'Equipment', maintenance: 'Maintenance',
    services: 'Services', personnel: 'Personnel', other: 'Other',
  };
  return {
    id: raw.id,
    description: raw.description ?? '',
    category: catMap[raw.category] ?? 'Other',
    amount: (raw.amount ?? 0) / 100,
    date: raw.date ?? '',
    vendor: raw.vendor ?? '',
    status: (raw.status ?? 'pending') as Expense['status'],
  };
}

export default function ResourcesHubPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'inventory' | 'templates' | 'costs' | 'predictions'>('inventory');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [predLoading, setPredLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Compat shim so existing JSX showToast() calls continue to work
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') toast.success(message);
    else toast.error(message);
  };

  // Loading states
  const [invLoading, setInvLoading] = useState(false);
  const [tplLoading, setTplLoading] = useState(false);
  const [costLoading, setCostLoading] = useState(false);

  // Inventory state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [inventoryFilter, setInventoryFilter] = useState({ category: '', status: '' });
  const [newItem, setNewItem] = useState({
    name: '', category: 'Reagents', quantity: 0, unit: 'pcs', minStock: 10, location: '', supplier: '', cost: 0
  });

  // Templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '', type: 'Document', description: '', content: ''
  });

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [budgetTotal, setBudgetTotal] = useState(100000);
  const [newExpense, setNewExpense] = useState({
    description: '', category: 'Reagents', amount: 0, date: new Date().toISOString().slice(0, 10), vendor: ''
  });

  // ── Loaders ────────────────────────────────────────────────────────────────

  async function loadInventory() {
    setInvLoading(true);
    try {
      const r = await inventoryApi.list(1, 200);
      setInventory(r.data.items.map(mapInvItem));
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setInvLoading(false);
    }
  }

  async function loadTemplates() {
    setTplLoading(true);
    try {
      const r = await templatesApi.list(1, 200);
      setTemplates(r.data.items.map(mapTemplate));
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setTplLoading(false);
    }
  }

  async function loadCosts() {
    setCostLoading(true);
    try {
      const r = await costsApi.list(1, 200);
      setExpenses(r.data.items.map(mapExpense));
    } catch {
      toast.error('Failed to load expenses');
    } finally {
      setCostLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'inventory') loadInventory();
    else if (activeTab === 'templates') loadTemplates();
    else if (activeTab === 'costs') loadCosts();
    else if (activeTab === 'predictions') {
      setPredLoading(true);
      aiApi.inventoryPredictions()
        .then(r => setPredictions(r.data))
        .catch(() => toast.error('Failed to load predictions'))
        .finally(() => setPredLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Inventory handlers ─────────────────────────────────────────────────────

  const handleCreateItem = async () => {
    if (!newItem.name) { showToast('Please enter item name', 'error'); return; }
    try {
      await inventoryApi.create({
        name: newItem.name,
        category: newItem.category.toLowerCase(),
        quantity: newItem.quantity,
        unit: newItem.unit,
        reorder_threshold: newItem.minStock,
        storage_location: newItem.location,
        unit_price: Math.round(newItem.cost * 100),
        notes: '',
      });
      setNewItem({ name: '', category: 'Reagents', quantity: 0, unit: 'pcs', minStock: 10, location: '', supplier: '', cost: 0 });
      setShowItemModal(false);
      showToast('Item added to inventory!');
      await loadInventory();
    } catch {
      showToast('Failed to add item', 'error');
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    try {
      await inventoryApi.update(editingItem.id, {
        name: editingItem.name,
        category: editingItem.category.toLowerCase(),
        quantity: editingItem.quantity,
        unit: editingItem.unit,
        reorder_threshold: editingItem.minStock,
        storage_location: editingItem.location,
        unit_price: Math.round(editingItem.cost * 100),
      });
      setEditingItem(null);
      showToast('Item updated!');
      await loadInventory();
    } catch {
      showToast('Failed to update item', 'error');
    }
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    try {
      await inventoryApi.delete(item.id);
      showToast('Item deleted');
      await loadInventory();
    } catch {
      showToast('Failed to delete item', 'error');
    }
  };

  const handleAdjustQuantity = async (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    try {
      await inventoryApi.update(item.id, {
        name: item.name,
        category: item.category.toLowerCase(),
        quantity: newQty,
        unit: item.unit,
        reorder_threshold: item.minStock,
        storage_location: item.location,
        unit_price: Math.round(item.cost * 100),
      });
      showToast(`Quantity ${delta > 0 ? 'increased' : 'decreased'}`);
      await loadInventory();
    } catch {
      showToast('Failed to adjust quantity', 'error');
    }
  };

  // ── Template handlers ──────────────────────────────────────────────────────

  const handleCreateTemplate = async () => {
    if (!newTemplate.name) { showToast('Please enter template name', 'error'); return; }
    const catMap: Record<string, string> = {
      'Document': 'form', 'Spreadsheet': 'form', 'Protocol': 'protocol',
      'Report': 'report', 'Form': 'form', 'Checklist': 'checklist',
    };
    try {
      await templatesApi.create({
        name: newTemplate.name,
        category: catMap[newTemplate.type] ?? 'form',
        description: newTemplate.description,
        content: newTemplate.content,
      });
      setNewTemplate({ name: '', type: 'Document', description: '', content: '' });
      setShowTemplateModal(false);
      showToast('Template created!');
      await loadTemplates();
    } catch {
      showToast('Failed to create template', 'error');
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    const catMap: Record<string, string> = {
      'Document': 'form', 'Spreadsheet': 'form', 'Protocol': 'protocol',
      'Report': 'report', 'Form': 'form', 'Checklist': 'checklist',
    };
    try {
      await templatesApi.update(editingTemplate.id, {
        name: editingTemplate.name,
        category: catMap[editingTemplate.type] ?? 'form',
        description: editingTemplate.description,
        content: editingTemplate.content,
      });
      setEditingTemplate(null);
      showToast('Template updated!');
      await loadTemplates();
    } catch {
      showToast('Failed to update template', 'error');
    }
  };

  const handleDeleteTemplate = async (template: Template) => {
    try {
      await templatesApi.delete(template.id);
      showToast('Template deleted');
      await loadTemplates();
    } catch {
      showToast('Failed to delete template', 'error');
    }
  };

  const handleUseTemplate = (template: Template) => {
    setViewingTemplate(template);
    showToast('Template loaded!');
  };

  // ── Expense handlers ───────────────────────────────────────────────────────

  const handleCreateExpense = async () => {
    if (!newExpense.description || !newExpense.amount) {
      showToast('Please fill required fields', 'error'); return;
    }
    try {
      await costsApi.create({
        description: newExpense.description,
        category: newExpense.category.toLowerCase(),
        amount: Math.round(newExpense.amount * 100),
        date: newExpense.date,
        vendor: newExpense.vendor,
        status: 'pending',
      });
      setNewExpense({ description: '', category: 'Reagents', amount: 0, date: new Date().toISOString().slice(0, 10), vendor: '' });
      setShowExpenseModal(false);
      showToast('Expense recorded!');
      await loadCosts();
    } catch {
      showToast('Failed to record expense', 'error');
    }
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense) return;
    try {
      await costsApi.update(editingExpense.id, {
        description: editingExpense.description,
        category: editingExpense.category.toLowerCase(),
        amount: Math.round(editingExpense.amount * 100),
        date: editingExpense.date,
        vendor: editingExpense.vendor,
        status: editingExpense.status,
      });
      setEditingExpense(null);
      showToast('Expense updated!');
      await loadCosts();
    } catch {
      showToast('Failed to update expense', 'error');
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    try {
      await costsApi.delete(expense.id);
      showToast('Expense deleted');
      await loadCosts();
    } catch {
      showToast('Failed to delete expense', 'error');
    }
  };

  const handleExpenseStatus = async (expense: Expense, status: Expense['status']) => {
    try {
      if (status === 'approved') await costsApi.approve(expense.id);
      else if (status === 'rejected') await costsApi.reject(expense.id);
      showToast(`Expense ${status}`);
      await loadCosts();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  // ── Calculations ───────────────────────────────────────────────────────────

  const filteredInventory = inventory.filter(i => {
    if (inventoryFilter.category && i.category !== inventoryFilter.category) return false;
    if (inventoryFilter.status && i.status !== inventoryFilter.status) return false;
    return true;
  });

  const totalSpent = expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);
  const pendingAmount = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);
  const budgetRemaining = budgetTotal - totalSpent;

  const spendingByCategory = EXPENSE_CATEGORIES.map(cat => ({
    category: cat,
    amount: expenses.filter(e => e.category === cat && e.status === 'approved').reduce((sum, e) => sum + e.amount, 0)
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  const statusColors: Record<string, { bg: string; text: string }> = {
    ok: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    low: { bg: 'rgba(234,179,8,0.15)', text: '#fbbf24' },
    critical: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
    pending: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
    approved: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
    rejected: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  };

  const tabs = [
    { key: 'inventory', label: 'Inventory', icon: '📦', count: inventory.length },
    { key: 'templates', label: 'Templates', icon: '📄', count: templates.length },
    { key: 'costs', label: 'Cost Tracking', icon: '💰', count: expenses.length },
    { key: 'predictions', label: 'AI Predictions', icon: '🔮', count: 0 },
  ];

  const modalStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  };

  const modalContentStyle: React.CSSProperties = {
    background: 'var(--surface)', borderRadius: 16, padding: 24, width: 500, maxHeight: '90vh', overflow: 'auto'
  };

  const loadingPlaceholder = (label: string) => (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      <div style={{ fontSize: 14 }}>Loading {label}...</div>
    </div>
  );

  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Resources</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manage inventory, templates, and costs</p>
        </div>
        <button onClick={() => setShowHelpModal(true)} className="btn btn-secondary">
          ❓ How to Use
        </button>
      </div>

      {/* More Tools Quick Access */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { icon: '📄', label: 'Documents', page: 'documents', color: '#6366f1' },
          { icon: '🏬', label: 'Supplier Directory', page: 'supplier-directory', color: '#06b6d4' },
          { icon: '🏪', label: 'Procurement', page: 'suppliers', color: '#f59e0b' },
        ].map(tool => (
          <button key={tool.page} onClick={() => navigate(tool.page)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20,
            color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontWeight: 500,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = tool.color; (e.currentTarget as HTMLButtonElement).style.color = tool.color; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
          >
            <span>{tool.icon}</span>
            <span>{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.key ? 600 : 400, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: -1
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span style={{
                background: activeTab === tab.key ? 'var(--accent)' : 'var(--surface2)',
                color: activeTab === tab.key ? 'white' : 'var(--text-muted)',
                padding: '2px 8px', borderRadius: 10, fontSize: 11
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        invLoading ? loadingPlaceholder('inventory') :
        <div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Items', value: inventory.length, color: 'var(--text)', icon: '📦' },
              { label: 'OK Stock', value: inventory.filter(i => i.status === 'ok').length, color: '#4ade80', icon: '✅' },
              { label: 'Low Stock', value: inventory.filter(i => i.status === 'low').length, color: '#fbbf24', icon: '⚠️' },
              { label: 'Critical', value: inventory.filter(i => i.status === 'critical').length, color: '#f87171', icon: '🚨' },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Filters & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <select
                className="form-select"
                value={inventoryFilter.category}
                onChange={e => setInventoryFilter({ ...inventoryFilter, category: e.target.value })}
                style={{ minWidth: 150 }}
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                className="form-select"
                value={inventoryFilter.status}
                onChange={e => setInventoryFilter({ ...inventoryFilter, status: e.target.value })}
                style={{ minWidth: 120 }}
              >
                <option value="">All Status</option>
                <option value="ok">OK</option>
                <option value="low">Low</option>
                <option value="critical">Critical</option>
              </select>
              {(inventoryFilter.category || inventoryFilter.status) && (
                <button className="btn btn-secondary" onClick={() => setInventoryFilter({ category: '', status: '' })}>
                  Clear Filters
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() =>
                exportCSV(inventory.map(i => ({ Name: i.name, Category: i.category, Quantity: i.quantity, Unit: i.unit, Location: i.location, Supplier: i.supplier, 'Min Stock': i.minStock, Cost: i.cost, Status: i.quantity <= i.minStock ? 'Low Stock' : 'OK' })), 'inventory')
              }>⬇ CSV</button>
              <button className="btn btn-secondary btn-sm" onClick={() =>
                exportPDF('Inventory Report', ['Name','Category','Qty','Unit','Location','Status'],
                  inventory.map(i => [i.name, i.category, String(i.quantity), i.unit, i.location || '', i.quantity <= i.minStock ? '⚠ Low' : '✓ OK']), 'inventory')
              }>⬇ PDF</button>
              <button className="btn btn-primary" onClick={() => setShowItemModal(true)}>+ Add Item</button>
            </div>
          </div>

          {/* Inventory Table */}
          {inventory.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Inventory Items</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Add items to track your lab inventory</p>
              <button className="btn btn-primary" onClick={() => setShowItemModal(true)}>+ Add First Item</button>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No items match current filters</p>
              <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setInventoryFilter({ category: '', status: '' })}>
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Item</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Category</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Quantity</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Location</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Status</th>
                    <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map(item => (
                    <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.supplier || 'No supplier'}</div>
                      </td>
                      <td style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>{item.category}</td>
                      <td style={{ padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            onClick={() => handleAdjustQuantity(item, -1)}
                            style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 14 }}
                          >-</button>
                          <span style={{ fontSize: 14, fontWeight: 500, minWidth: 60, textAlign: 'center' }}>{item.quantity} {item.unit}</span>
                          <button
                            onClick={() => handleAdjustQuantity(item, 1)}
                            style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 14 }}
                          >+</button>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Min: {item.minStock}</div>
                      </td>
                      <td style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>{item.location || '-'}</td>
                      <td style={{ padding: 12 }}>
                        <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: statusColors[item.status]?.bg, color: statusColors[item.status]?.text }}>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: 12, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditingItem(item)}>✏️ Edit</button>
                          <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteItem(item)}>🗑️</button>
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

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        tplLoading ? loadingPlaceholder('templates') :
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowTemplateModal(true)}>+ New Template</button>
          </div>

          {templates.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Templates Yet</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Create templates for documents, protocols, and reports</p>
              <button className="btn btn-primary" onClick={() => setShowTemplateModal(true)}>+ Create First Template</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {templates.map(t => (
                <div key={t.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, padding: '2px 8px', background: 'rgba(59,130,246,0.15)', borderRadius: 8 }}>{t.type}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Used {t.usageCount}x</span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t.name}</h3>
                  {t.description && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{t.description}</p>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Last used: {t.lastUsed} • By {t.createdBy}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => handleUseTemplate(t)}>📋 Use</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingTemplate(t)}>✏️</button>
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteTemplate(t)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cost Tracking Tab */}
      {activeTab === 'costs' && (
        costLoading ? loadingPlaceholder('expenses') :
        <div>
          {/* Budget Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Budget', value: `$${budgetTotal.toLocaleString()}`, color: 'var(--text)', icon: '💵' },
              { label: 'Spent', value: `$${totalSpent.toLocaleString()}`, color: '#60a5fa', icon: '💳' },
              { label: 'Pending', value: `$${pendingAmount.toLocaleString()}`, color: '#fbbf24', icon: '⏳' },
              { label: 'Remaining', value: `$${budgetRemaining.toLocaleString()}`, color: budgetRemaining > 0 ? '#4ade80' : '#f87171', icon: '📊' },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Budget Setting */}
          <div className="card" style={{ marginBottom: 24, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label style={{ fontSize: 14, fontWeight: 500 }}>Annual Budget:</label>
              <input
                type="number"
                className="form-input"
                style={{ width: 150 }}
                value={budgetTotal}
                onChange={e => setBudgetTotal(Number(e.target.value))}
              />
              <div style={{ flex: 1, height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (totalSpent / budgetTotal) * 100)}%`,
                  background: totalSpent > budgetTotal ? '#ef4444' : totalSpent > budgetTotal * 0.8 ? '#fbbf24' : '#4ade80',
                  borderRadius: 4
                }} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{((totalSpent / budgetTotal) * 100).toFixed(1)}% used</span>
            </div>
          </div>

          {spendingByCategory.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Spending by Category</h3>
              {spendingByCategory.map(c => (
                <div key={c.category} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{c.category}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>${c.amount.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${(c.amount / totalSpent) * 100}%`, background: 'var(--accent)', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Expenses</h3>
            <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>+ Add Expense</button>
          </div>

          {expenses.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Expenses Recorded</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Track your lab spending and expenses</p>
              <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>+ Record First Expense</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {expenses.map(exp => (
                <div key={exp.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                      💳
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600 }}>{exp.description}</h4>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: statusColors[exp.status]?.bg, color: statusColors[exp.status]?.text }}>
                          {exp.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {exp.category} • {exp.vendor || 'No vendor'} • {exp.date}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>${exp.amount.toLocaleString()}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {exp.status === 'pending' && (
                        <>
                          <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'none' }} onClick={() => handleExpenseStatus(exp, 'approved')}>✓ Approve</button>
                          <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleExpenseStatus(exp, 'rejected')}>✕ Reject</button>
                        </>
                      )}
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditingExpense(exp)}>✏️</button>
                      <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteExpense(exp)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {(showItemModal || editingItem) && (
        <div style={modalStyle} onClick={() => { setShowItemModal(false); setEditingItem(null); }}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editingItem ? 'Edit Item' : 'Add Inventory Item'}</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Item Name *</label>
                <input type="text" className="form-input" placeholder="e.g., PCR Master Mix"
                  value={editingItem ? editingItem.name : newItem.name}
                  onChange={e => editingItem ? setEditingItem({ ...editingItem, name: e.target.value }) : setNewItem({ ...newItem, name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Category</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingItem ? editingItem.category : newItem.category}
                    onChange={e => editingItem ? setEditingItem({ ...editingItem, category: e.target.value }) : setNewItem({ ...newItem, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Unit</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingItem ? editingItem.unit : newItem.unit}
                    onChange={e => editingItem ? setEditingItem({ ...editingItem, unit: e.target.value }) : setNewItem({ ...newItem, unit: e.target.value })}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Quantity</label>
                  <input type="number" className="form-input" min="0"
                    value={editingItem ? editingItem.quantity : newItem.quantity}
                    onChange={e => editingItem ? setEditingItem({ ...editingItem, quantity: Number(e.target.value) }) : setNewItem({ ...newItem, quantity: Number(e.target.value) })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Min Stock Level</label>
                  <input type="number" className="form-input" min="0"
                    value={editingItem ? editingItem.minStock : newItem.minStock}
                    onChange={e => editingItem ? setEditingItem({ ...editingItem, minStock: Number(e.target.value) }) : setNewItem({ ...newItem, minStock: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Location</label>
                <input type="text" className="form-input" placeholder="e.g., Freezer A, Shelf 2"
                  value={editingItem ? editingItem.location : newItem.location}
                  onChange={e => editingItem ? setEditingItem({ ...editingItem, location: e.target.value }) : setNewItem({ ...newItem, location: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Supplier</label>
                  <input type="text" className="form-input" placeholder="e.g., Thermo Fisher"
                    value={editingItem ? editingItem.supplier : newItem.supplier}
                    onChange={e => editingItem ? setEditingItem({ ...editingItem, supplier: e.target.value }) : setNewItem({ ...newItem, supplier: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Cost per Unit ($)</label>
                  <input type="number" className="form-input" min="0" step="0.01"
                    value={editingItem ? editingItem.cost : newItem.cost}
                    onChange={e => editingItem ? setEditingItem({ ...editingItem, cost: Number(e.target.value) }) : setNewItem({ ...newItem, cost: Number(e.target.value) })} />
                </div>
              </div>
            </div>
            {/* SDS / Safety Section */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Safety Data (SDS)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>CAS Number</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="text" className="form-input" placeholder="e.g., 7732-18-5"
                      value={(editingItem as any)?.cas_number ?? (newItem as any).cas_number ?? ''}
                      onChange={e => editingItem ? setEditingItem({ ...editingItem, cas_number: e.target.value } as any) : setNewItem({ ...newItem, cas_number: e.target.value } as any)}
                      style={{ flex: 1 }} />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ whiteSpace: 'nowrap', padding: '0 10px' }}
                      onClick={async () => {
                        const name = editingItem?.name ?? newItem.name;
                        if (!name) { toast.error('Enter a chemical name first'); return; }
                        try {
                          const r = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/MolecularFormula,IUPACName/JSON`);
                          if (!r.ok) throw new Error();
                          const d = await r.json();
                          const cid = d.PropertyTable?.Properties?.[0];
                          if (!cid) throw new Error();
                          const sdsUrl = `https://pubchem.ncbi.nlm.nih.gov/compound/${cid.CID}#section=Safety-and-Hazards`;
                          const casR = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid.CID}/synonyms/JSON`);
                          const casD = await casR.json();
                          const synonyms: string[] = casD.InformationList?.Information?.[0]?.Synonym ?? [];
                          const cas = synonyms.find((s: string) => /^\d{2,7}-\d{2}-\d$/.test(s)) ?? '';
                          if (editingItem) {
                            setEditingItem({ ...editingItem, cas_number: cas, sds_url: sdsUrl } as any);
                          } else {
                            setNewItem({ ...newItem, cas_number: cas, sds_url: sdsUrl } as any);
                          }
                          toast.success('SDS data fetched from PubChem');
                        } catch { toast.error('Not found on PubChem'); }
                      }}
                    >🔍 Fetch</button>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Hazard Class</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={(editingItem as any)?.hazard_class ?? (newItem as any).hazard_class ?? ''}
                    onChange={e => editingItem ? setEditingItem({ ...editingItem, hazard_class: e.target.value } as any) : setNewItem({ ...newItem, hazard_class: e.target.value } as any)}>
                    <option value="">None / Not Applicable</option>
                    <option value="Flammable">🔥 Flammable</option>
                    <option value="Corrosive">⚗️ Corrosive</option>
                    <option value="Toxic">☠️ Toxic</option>
                    <option value="Oxidizer">🔶 Oxidizer</option>
                    <option value="Biohazard">☣️ Biohazard</option>
                    <option value="Radioactive">☢️ Radioactive</option>
                    <option value="Irritant">⚠️ Irritant</option>
                    <option value="Cryogenic">🧊 Cryogenic</option>
                  </select>
                </div>
              </div>
              {((editingItem as any)?.sds_url || (newItem as any).sds_url) && (
                <div style={{ fontSize: 12, color: 'var(--accent)' }}>
                  📄 SDS: <a href={(editingItem as any)?.sds_url ?? (newItem as any).sds_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>View on PubChem →</a>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => { setShowItemModal(false); setEditingItem(null); }} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={editingItem ? handleUpdateItem : handleCreateItem} style={{ flex: 1 }}>
                {editingItem ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Template Modal */}
      {(showTemplateModal || editingTemplate) && (
        <div style={modalStyle} onClick={() => { setShowTemplateModal(false); setEditingTemplate(null); }}>
          <div style={{ ...modalContentStyle, width: 600 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editingTemplate ? 'Edit Template' : 'Create Template'}</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Template Name *</label>
                  <input type="text" className="form-input" placeholder="e.g., Experiment Report"
                    value={editingTemplate ? editingTemplate.name : newTemplate.name}
                    onChange={e => editingTemplate ? setEditingTemplate({ ...editingTemplate, name: e.target.value }) : setNewTemplate({ ...newTemplate, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Type</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingTemplate ? editingTemplate.type : newTemplate.type}
                    onChange={e => editingTemplate ? setEditingTemplate({ ...editingTemplate, type: e.target.value }) : setNewTemplate({ ...newTemplate, type: e.target.value })}>
                    {TEMPLATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
                <input type="text" className="form-input" placeholder="Brief description..."
                  value={editingTemplate ? editingTemplate.description : newTemplate.description}
                  onChange={e => editingTemplate ? setEditingTemplate({ ...editingTemplate, description: e.target.value }) : setNewTemplate({ ...newTemplate, description: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Template Content</label>
                <textarea className="form-input" rows={8} placeholder="Enter template content here..."
                  value={editingTemplate ? editingTemplate.content : newTemplate.content}
                  onChange={e => editingTemplate ? setEditingTemplate({ ...editingTemplate, content: e.target.value }) : setNewTemplate({ ...newTemplate, content: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => { setShowTemplateModal(false); setEditingTemplate(null); }} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate} style={{ flex: 1 }}>
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Template Modal */}
      {viewingTemplate && (
        <div style={modalStyle} onClick={() => setViewingTemplate(null)}>
          <div style={{ ...modalContentStyle, width: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{viewingTemplate.name}</h3>
                <span style={{ fontSize: 12, color: 'var(--accent)' }}>{viewingTemplate.type}</span>
              </div>
              <button onClick={() => setViewingTemplate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 16, marginBottom: 16, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, maxHeight: 400, overflow: 'auto' }}>
              {viewingTemplate.content || 'No content in this template'}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setViewingTemplate(null)} style={{ flex: 1 }}>Close</button>
              <button className="btn btn-primary" onClick={() => {
                navigator.clipboard.writeText(viewingTemplate.content);
                showToast('Template copied to clipboard!');
              }} style={{ flex: 1 }}>📋 Copy Content</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Expense Modal */}
      {(showExpenseModal || editingExpense) && (
        <div style={modalStyle} onClick={() => { setShowExpenseModal(false); setEditingExpense(null); }}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description *</label>
                <input type="text" className="form-input" placeholder="e.g., PCR reagents purchase"
                  value={editingExpense ? editingExpense.description : newExpense.description}
                  onChange={e => editingExpense ? setEditingExpense({ ...editingExpense, description: e.target.value }) : setNewExpense({ ...newExpense, description: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Category</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingExpense ? editingExpense.category : newExpense.category}
                    onChange={e => editingExpense ? setEditingExpense({ ...editingExpense, category: e.target.value }) : setNewExpense({ ...newExpense, category: e.target.value })}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Amount ($) *</label>
                  <input type="number" className="form-input" min="0" step="0.01"
                    value={editingExpense ? editingExpense.amount : newExpense.amount}
                    onChange={e => editingExpense ? setEditingExpense({ ...editingExpense, amount: Number(e.target.value) }) : setNewExpense({ ...newExpense, amount: Number(e.target.value) })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Date</label>
                  <input type="date" className="form-input"
                    value={editingExpense ? editingExpense.date : newExpense.date}
                    onChange={e => editingExpense ? setEditingExpense({ ...editingExpense, date: e.target.value }) : setNewExpense({ ...newExpense, date: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Vendor</label>
                  <input type="text" className="form-input" placeholder="e.g., Thermo Fisher"
                    value={editingExpense ? editingExpense.vendor : newExpense.vendor}
                    onChange={e => editingExpense ? setEditingExpense({ ...editingExpense, vendor: e.target.value }) : setNewExpense({ ...newExpense, vendor: e.target.value })} />
                </div>
              </div>
              {editingExpense && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Status</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingExpense.status}
                    onChange={e => setEditingExpense({ ...editingExpense, status: e.target.value as Expense['status'] })}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => { setShowExpenseModal(false); setEditingExpense(null); }} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={editingExpense ? handleUpdateExpense : handleCreateExpense} style={{ flex: 1 }}>
                {editingExpense ? 'Save Changes' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Predictions Tab */}
      {activeTab === 'predictions' && (
        predLoading ? loadingPlaceholder('predictions') : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>🔮</span>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>AI Inventory Predictions</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>AI-powered reorder forecasts based on consumption history</p>
              </div>
            </div>
            {predictions.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>No predictions yet</div>
                <div style={{ fontSize: 13 }}>Add inventory items with usage history to see AI reorder predictions</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {predictions.map((p: any) => (
                  <div key={p.item_id} className="card" style={{ padding: 16, borderLeft: `4px solid ${p.urgency === 'critical' ? '#ef4444' : p.urgency === 'high' ? '#f59e0b' : '#22c55e'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.item_name}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                          Current stock: <strong>{p.current_quantity} {p.unit}</strong> · Threshold: {p.reorder_threshold} {p.unit}
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {p.days_until_stockout !== null
                            ? `Estimated stockout in <strong>${p.days_until_stockout} days</strong>`
                            : 'Stockout timeline unknown — insufficient usage data'
                          }
                        </div>
                        {p.recommended_order_quantity && (
                          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                            Recommended order: {p.recommended_order_quantity} {p.unit}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                        background: p.urgency === 'critical' ? '#ef444420' : p.urgency === 'high' ? '#f59e0b20' : '#22c55e20',
                        color: p.urgency === 'critical' ? '#ef4444' : p.urgency === 'high' ? '#f59e0b' : '#22c55e',
                        border: `1px solid ${p.urgency === 'critical' ? '#ef444440' : p.urgency === 'high' ? '#f59e0b40' : '#22c55e40'}`,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {p.urgency}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* How to Use Modal */}
      {showHelpModal && (
        <div style={modalStyle} onClick={() => setShowHelpModal(false)}>
          <div style={{ ...modalContentStyle, width: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>How to Use Resources</h3>
              <button onClick={() => setShowHelpModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>📦 Inventory</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                  <li>Add items with name, category, quantity, and location</li>
                  <li>Set minimum stock levels for low stock alerts</li>
                  <li>Use +/- buttons to quickly adjust quantities</li>
                  <li>Filter by category or stock status</li>
                  <li>Status auto-updates based on min stock level</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>📄 Templates</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                  <li>Create reusable templates for documents and protocols</li>
                  <li>Choose template type (Document, Protocol, Report, etc.)</li>
                  <li>Click "Use" to view and copy template content</li>
                  <li>Track how often each template is used</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>💰 Cost Tracking</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                  <li>Set your annual budget at the top</li>
                  <li>Record expenses with category, amount, and vendor</li>
                  <li>Approve or reject pending expenses</li>
                  <li>View spending breakdown by category</li>
                </ul>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowHelpModal(false)} style={{ marginTop: 24, width: '100%' }}>Got it!</button>
          </div>
        </div>
      )}
    </div>
  );
}
