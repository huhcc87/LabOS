import { useState, useEffect } from 'react';
import { suppliersApi, inventoryApi } from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
interface VendorItem {
  id: string;
  name: string;
  catalog: string;
  category: string;
  unit: string;
  vendors: { name: string; price: number; leadDays: number; inStock: boolean; lastOrdered?: string }[];
}

interface PurchaseOrder {
  id: string;
  vendor: string;
  items: { name: string; qty: number; price: number }[];
  status: 'draft' | 'pending_approval' | 'approved' | 'ordered' | 'delivered';
  grantCode?: string;
  total: number;
  createdDate: string;
  eta?: string;
}

interface VendorScore {
  name: string;
  logo: string;
  deliveryScore: number;
  qualityScore: number;
  priceScore: number;
  supportScore: number;
  orders: number;
  onTimeRate: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const ITEMS: VendorItem[] = [
  { id: 'i1', name: 'DMEM High Glucose Media', catalog: 'D5796', category: 'Cell Culture', unit: '500mL', vendors: [{ name: 'Sigma-Aldrich', price: 28.50, leadDays: 2, inStock: true, lastOrdered: '2026-04-01' }, { name: 'Thermo Fisher', price: 31.20, leadDays: 3, inStock: true }, { name: 'VWR', price: 29.80, leadDays: 4, inStock: false }] },
  { id: 'i2', name: 'FBS (Fetal Bovine Serum)', catalog: '10082147', category: 'Cell Culture', unit: '500mL', vendors: [{ name: 'Thermo Fisher', price: 142.00, leadDays: 5, inStock: true, lastOrdered: '2026-03-15' }, { name: 'Sigma-Aldrich', price: 138.50, leadDays: 3, inStock: true }, { name: 'Corning', price: 155.00, leadDays: 7, inStock: true }] },
  { id: 'i3', name: 'Anti-KRAS antibody (G12D)', catalog: 'ab224563', category: 'Antibody', unit: '100µg', vendors: [{ name: 'Abcam', price: 385.00, leadDays: 7, inStock: true, lastOrdered: '2026-02-10' }, { name: 'CST', price: 410.00, leadDays: 5, inStock: true }, { name: 'Santa Cruz', price: 298.00, leadDays: 14, inStock: false }] },
  { id: 'i4', name: 'TRIzol Reagent', catalog: '15596026', category: 'RNA/DNA', unit: '100mL', vendors: [{ name: 'Thermo Fisher', price: 89.00, leadDays: 2, inStock: true, lastOrdered: '2026-04-20' }, { name: 'Sigma-Aldrich', price: 92.50, leadDays: 3, inStock: true }] },
  { id: 'i5', name: 'Protein A/G Agarose Beads', catalog: 'sc-2003', category: 'IP/ChIP', unit: '2mL', vendors: [{ name: 'Santa Cruz', price: 245.00, leadDays: 10, inStock: true }, { name: 'Millipore', price: 228.00, leadDays: 7, inStock: true, lastOrdered: '2026-01-08' }, { name: 'Thermo Fisher', price: 260.00, leadDays: 3, inStock: false }] },
];

const ORDERS: PurchaseOrder[] = [
  { id: 'PO-2026-042', vendor: 'Thermo Fisher', items: [{ name: 'TRIzol Reagent', qty: 5, price: 89 }, { name: 'FBS', qty: 2, price: 142 }], status: 'delivered', grantCode: 'NIH-R01-CA123456', total: 729, createdDate: '2026-04-22', eta: '2026-04-25' },
  { id: 'PO-2026-041', vendor: 'Abcam', items: [{ name: 'Anti-KRAS antibody', qty: 1, price: 385 }], status: 'ordered', grantCode: 'NIH-R01-CA123456', total: 385, createdDate: '2026-05-01', eta: '2026-05-10' },
  { id: 'PO-2026-043', vendor: 'Sigma-Aldrich', items: [{ name: 'DMEM Media', qty: 10, price: 28.50 }, { name: 'FBS', qty: 3, price: 138.50 }], status: 'pending_approval', grantCode: 'NSF-CAREER-789012', total: 700.50, createdDate: '2026-05-09', eta: undefined },
];

const VENDOR_SCORES: VendorScore[] = [
  { name: 'Thermo Fisher', logo: '🔵', deliveryScore: 94, qualityScore: 92, priceScore: 75, supportScore: 88, orders: 142, onTimeRate: 94 },
  { name: 'Sigma-Aldrich', logo: '🔴', deliveryScore: 88, qualityScore: 95, priceScore: 85, supportScore: 82, orders: 98, onTimeRate: 88 },
  { name: 'Abcam', logo: '🟢', deliveryScore: 79, qualityScore: 97, priceScore: 68, supportScore: 91, orders: 55, onTimeRate: 79 },
  { name: 'VWR', logo: '🟡', deliveryScore: 82, qualityScore: 84, priceScore: 88, supportScore: 78, orders: 67, onTimeRate: 82 },
  { name: 'Santa Cruz', logo: '🟠', deliveryScore: 71, qualityScore: 82, priceScore: 92, supportScore: 72, orders: 34, onTimeRate: 71 },
];

const STATUS_META: Record<PurchaseOrder['status'], { label: string; color: string; bg: string }> = {
  draft:            { label: 'Draft',            color: '#9ca3af', bg: 'rgba(107,114,128,0.15)' },
  pending_approval: { label: 'Pending Approval', color: '#fbbf24', bg: 'rgba(234,179,8,0.15)' },
  approved:         { label: 'Approved',         color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
  ordered:          { label: 'Ordered',          color: '#818cf8', bg: 'rgba(99,102,241,0.15)' },
  delivered:        { label: 'Delivered',        color: '#4ade80', bg: 'rgba(34,197,94,0.15)' },
};

const INP: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' };

type Tab = 'compare' | 'orders' | 'vendors';

export default function VendorIntelligencePage() {
  const [tab, setTab] = useState<Tab>('compare');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [cart, setCart] = useState<{ itemId: string; vendorName: string; qty: number }[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [apiItems, setApiItems] = useState<VendorItem[]>(ITEMS);
  const [apiOrders, setApiOrders] = useState<PurchaseOrder[]>(ORDERS);
  const [apiVendorScores, setApiVendorScores] = useState<VendorScore[]>(VENDOR_SCORES);

  useEffect(() => {
    // Load purchase orders
    suppliersApi.listOrders(1, 100).then(res => {
      const items = (res.data as any).items || [];
      if (items.length > 0) setApiOrders(items.map((po: any) => ({
        id: po.id?.toString() || String(Date.now()),
        vendor: po.supplier_name || po.vendor || 'Unknown',
        items: (po.line_items || []).map((li: any) => ({ name: li.product_name || li.name || '', qty: li.quantity || 1, price: li.unit_price || 0 })),
        status: po.status || 'draft',
        grantCode: po.grant_code || '',
        total: po.total_amount || 0,
        createdDate: po.created_at?.slice(0, 10) || '',
        eta: po.expected_delivery?.slice(0, 10),
      })));
    }).catch(() => {});

    // Load suppliers for vendor scoring
    suppliersApi.list(1, 100, '').then(res => {
      const items = (res.data as any).items || [];
      if (items.length > 0) setApiVendorScores(items.map((s: any) => ({
        name: s.name, logo: '🏢',
        deliveryScore: s.on_time_delivery_rate || 80,
        qualityScore: s.quality_rating ? s.quality_rating * 20 : 80,
        priceScore: 80,
        supportScore: 80,
        orders: s.total_orders || 0,
        onTimeRate: s.on_time_delivery_rate || 80,
      })));
    }).catch(() => {});

    // Load inventory items for compare tab
    inventoryApi.list(1, 100, '').then(res => {
      const items = (res.data as any).items || [];
      if (items.length > 0) setApiItems(items.map((it: any) => ({
        id: String(it.id), name: it.name, catalog: it.catalog_number || it.barcode || '', category: it.category || 'General',
        unit: it.unit || 'ea',
        vendors: [{ name: it.vendor || 'Unknown', price: it.unit_cost || 0, leadDays: it.lead_time_days || 5, inStock: (it.quantity || 0) > 0 }],
      })));
    }).catch(() => {});
  }, []);

  const categories = ['all', ...Array.from(new Set(apiItems.map(i => i.category)))];
  const filtered = apiItems.filter(i => {
    const q = search.toLowerCase();
    return (!q || i.name.toLowerCase().includes(q) || i.catalog.includes(q)) && (filterCat === 'all' || i.category === filterCat);
  });

  const addToCart = (itemId: string, vendorName: string) => {
    setCart(prev => {
      const ex = prev.find(c => c.itemId === itemId && c.vendorName === vendorName);
      if (ex) return prev.map(c => c.itemId === itemId && c.vendorName === vendorName ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { itemId, vendorName, qty: 1 }];
    });
  };

  const cartTotal = cart.reduce((sum, c) => {
    const item = apiItems.find(i => i.id === c.itemId);
    const vendor = item?.vendors.find(v => v.name === c.vendorName);
    return sum + (vendor?.price || 0) * c.qty;
  }, 0);

  const ScoreBar = ({ value, color }: { value: number; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3 }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, width: 32, textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <div className="page" style={{ maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Vendor Intelligence</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>AI price comparison · PO management · Vendor scoring · Grant linkage</p>
        </div>
        {cart.length > 0 && (
          <button onClick={() => setShowCart(!showCart)} style={{ padding: '8px 18px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            🛒 Cart ({cart.length} items) — ${cartTotal.toFixed(2)}
          </button>
        )}
      </div>

      {/* Cart panel */}
      {showCart && cart.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.04)' }}>
          <h4 style={{ fontWeight: 600, marginBottom: 12 }}>Purchase Cart</h4>
          {cart.map((c, idx) => {
            const item = apiItems.find(i => i.id === c.itemId);
            const vendor = item?.vendors.find(v => v.name === c.vendorName);
            return (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{item?.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.vendorName} · ${vendor?.price} / {item?.unit}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="number" value={c.qty} onChange={e => setCart(prev => prev.map((x, i) => i === idx ? { ...x, qty: parseInt(e.target.value) || 1 } : x))} style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} min={1} />
                  <div style={{ fontWeight: 600, width: 80, textAlign: 'right' }}>${((vendor?.price || 0) * c.qty).toFixed(2)}</div>
                  <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#f87171', fontSize: 16 }}>×</button>
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Total: ${cartTotal.toFixed(2)}</div>
              <select style={{ ...INP, marginTop: 8, maxWidth: 220, fontSize: 12 }}>
                <option>Link to: NIH-R01-CA123456</option>
                <option>Link to: NSF-CAREER-789012</option>
                <option>Link to: DoD-Grant-101</option>
                <option>No grant linkage</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>Save as Draft</button>
              <button style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Generate PO</button>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[{ key: 'compare' as Tab, label: '📊 Price Comparison' }, { key: 'orders' as Tab, label: '📦 Purchase Orders' }, { key: 'vendors' as Tab, label: '⭐ Vendor Scores' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 18px', fontSize: 14, fontWeight: tab === t.key ? 600 : 400, border: 'none', background: 'none', cursor: 'pointer', color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)', borderBottom: `2px solid ${tab === t.key ? 'var(--primary)' : 'transparent'}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Price Comparison ── */}
      {tab === 'compare' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input style={{ ...INP, maxWidth: 300 }} placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
            <select style={{ ...INP, maxWidth: 180 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map(item => {
              const sorted = [...item.vendors].sort((a, b) => a.price - b.price);
              const bestPrice = sorted[0].price;
              return (
                <div key={item.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cat#: {item.catalog} · {item.category} · Per {item.unit}</div>
                    </div>
                    <div style={{ padding: '4px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', color: '#4ade80', fontSize: 12, fontWeight: 600 }}>
                      Best: ${bestPrice.toFixed(2)} / {item.unit}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                    {sorted.map((v, i) => {
                      const savings = ((v.price - bestPrice) / bestPrice * 100);
                      return (
                        <div key={v.name} style={{ padding: 12, borderRadius: 10, border: `1px solid ${i === 0 ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`, background: i === 0 ? 'rgba(34,197,94,0.04)' : 'var(--surface2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{v.name}</span>
                            {i === 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#4ade80', color: '#000', fontWeight: 700 }}>BEST</span>}
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>${v.price.toFixed(2)}</div>
                          {savings > 0 && <div style={{ fontSize: 11, color: '#f87171', marginBottom: 6 }}>+{savings.toFixed(0)}% vs best</div>}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                            {v.inStock ? <span style={{ color: '#4ade80' }}>✓ In Stock</span> : <span style={{ color: '#f87171' }}>✗ Out of Stock</span>}
                            {' · '}{v.leadDays}d lead time
                          </div>
                          {v.lastOrdered && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>Last ordered: {v.lastOrdered}</div>}
                          <button onClick={() => addToCart(item.id, v.name)} disabled={!v.inStock}
                            style={{ width: '100%', padding: '5px', fontSize: 12, border: 'none', borderRadius: 6, background: v.inStock ? 'var(--primary)' : 'var(--surface)', color: v.inStock ? '#fff' : 'var(--text-muted)', cursor: v.inStock ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                            {v.inStock ? '+ Add to Cart' : 'Out of Stock'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Orders ── */}
      {tab === 'orders' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Purchase Orders</h3>
            <button className="btn btn-primary">+ New PO</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {apiOrders.map(po => {
              const sm = STATUS_META[po.status];
              return (
                <div key={po.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{po.id}</span>
                        <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sm.bg, color: sm.color }}>{sm.label}</span>
                        {po.grantCode && <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>📝 {po.grantCode}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Vendor: {po.vendor} · Created: {po.createdDate}{po.eta ? ` · ETA: ${po.eta}` : ''}</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#4ade80' }}>${po.total.toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap', marginBottom: 12 }}>
                    {po.items.map((item, i) => (
                      <span key={i} style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--surface2)' }}>{item.name} ×{item.qty}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {po.status === 'pending_approval' && (
                      <button style={{ padding: '5px 12px', fontSize: 12, border: 'none', borderRadius: 6, background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Approve PO</button>
                    )}
                    <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>⬇ Download PO</button>
                    <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>Track Delivery</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Vendor Scores ── */}
      {tab === 'vendors' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Vendor Performance Scorecard</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {apiVendorScores.sort((a, b) => (b.deliveryScore + b.qualityScore + b.priceScore + b.supportScore) - (a.deliveryScore + a.qualityScore + a.priceScore + a.supportScore)).map((v, rank) => {
              const overall = Math.round((v.deliveryScore + v.qualityScore + v.priceScore + v.supportScore) / 4);
              return (
                <div key={v.name} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 28 }}>{v.logo}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{v.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.orders} orders · {v.onTimeRate}% on time</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: overall >= 90 ? '#4ade80' : overall >= 75 ? '#fbbf24' : '#f87171' }}>{overall}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Overall</div>
                      {rank === 0 && <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>🥇 TOP</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Delivery Speed', value: v.deliveryScore, color: '#60a5fa' },
                      { label: 'Product Quality', value: v.qualityScore, color: '#4ade80' },
                      { label: 'Price Value', value: v.priceScore, color: '#fbbf24' },
                      { label: 'Support', value: v.supportScore, color: '#818cf8' },
                    ].map(metric => (
                      <div key={metric.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 3 }}>
                          <span>{metric.label}</span>
                        </div>
                        <ScoreBar value={metric.value} color={metric.color} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

}
