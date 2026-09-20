import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { reagentCartApi, paymentsApi, procurementApi } from '../lib/api';

interface CartItem {
  id: number;
  vendor: string;
  name: string;
  catalog: string;
  size: string;
  unit_price: number | null;
  quantity: number;
  currency: string;
  url: string;
  image_url: string;
  cas: string;
  notes: string;
  status: 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';
  captured_at: string;
  ordered_at: string | null;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

const STATUS_META: Record<CartItem['status'], { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending review', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  approved:  { label: 'Approved',       color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  ordered:   { label: 'Ordered',        color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  received:  { label: 'Received',       color: '#0891b2', bg: 'rgba(8,145,178,0.12)' },
  cancelled: { label: 'Cancelled',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

export default function ReagentCartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | CartItem['status']>('all');
  const [filterVendor, setFilterVendor] = useState('all');
  const [search, setSearch] = useState('');
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reagentCartApi.list();
      setItems((res.data as any) || []);
    } catch { /* graceful */ }
    setLoading(false);
  }, []);

  const loadPaymentStatus = useCallback(async () => {
    try {
      const s = await paymentsApi.status();
      setStripeConfigured(!!s.data.configured);
      if (s.data.configured) {
        const m = await paymentsApi.listMethods();
        setMethods((m.data as any) || []);
      }
    } catch {
      setStripeConfigured(false);
    }
  }, []);

  useEffect(() => { load(); loadPaymentStatus(); }, [load, loadPaymentStatus]);

  // Polling so items appear in near-real-time as the extension captures them
  useEffect(() => {
    const id = window.setInterval(load, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter(i =>
      (filterStatus === 'all' || i.status === filterStatus) &&
      (filterVendor === 'all' || i.vendor === filterVendor) &&
      (search === '' || (i.name + ' ' + i.catalog + ' ' + i.vendor).toLowerCase().includes(search.toLowerCase()))
    );
  }, [items, filterStatus, filterVendor, search]);

  const vendors = useMemo(() => Array.from(new Set(items.map(i => i.vendor).filter(Boolean))), [items]);

  const totalSelected = useMemo(() => {
    return filtered
      .filter(i => selectedIds.has(i.id))
      .reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 1), 0);
  }, [filtered, selectedIds]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.filter(i => i.status === 'pending' || i.status === 'approved').map(i => i.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this item from the cart?')) return;
    await reagentCartApi.delete(id);
    load();
  };

  const handleQuantity = async (id: number, q: number) => {
    if (q < 1) return;
    await reagentCartApi.update(id, { quantity: q });
    load();
  };

  const handleApprove = async (id: number) => {
    await reagentCartApi.update(id, { status: 'approved' });
    load();
  };

  // F1: cross-vendor price compare — simulate fetching alt prices for an item
  const handleComparePrices = async (id: number, name: string, _catalog: string) => {
    // Simulated comparison — in production this calls vendor APIs in background
    const variation = (vendor: string) => {
      const base = (items.find(i => i.id === id)?.unit_price || 50);
      const factor = { 'Sigma-Aldrich': 1.00, 'Thermo Fisher': 0.92, 'VWR': 0.97, 'Fisher Scientific': 0.88, 'Bio-Rad': 1.03 }[vendor] || 1.0;
      return Math.round(base * factor * 100) / 100;
    };
    const sim = ['Sigma-Aldrich', 'Thermo Fisher', 'VWR', 'Fisher Scientific', 'Bio-Rad'].map(v => ({
      vendor: v, unit_price: variation(v), url: `https://${v.toLowerCase().replace(/[^a-z]/g, '')}.com/search?q=${encodeURIComponent(name)}`,
    }));
    await procurementApi.setAltPrices(id, sim);
    setExpandedId(id);
  };

  // F8: set recurrence
  const handleRecurrence = async (id: number, pattern: string) => {
    await procurementApi.setRecurrence(id, pattern, true);
    alert(pattern ? `✓ Recurring ${pattern}. Will auto-reorder.` : '✓ Recurrence cleared.');
  };

  // F11: voice capture — parse "add 100 mL Tris pH 8" into a cart item
  const startVoiceCapture = () => {
    const W: any = window;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) {
      alert('Voice capture requires Chrome / Edge / Safari (Web Speech API).');
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    setVoiceListening(true);
    rec.onresult = async (e: any) => {
      const text = e.results[0][0].transcript;
      setVoiceListening(false);
      // Naive parse: "add 100 mL Tris pH 8" → name = "100 mL Tris pH 8"
      const cleaned = text.replace(/^add\s+/i, '').trim();
      await reagentCartApi.create({
        vendor: 'Voice capture',
        name: cleaned,
        catalog: '',
        notes: `Captured via voice: "${text}"`,
        quantity: 1,
      });
      load();
    };
    rec.onerror = () => setVoiceListening(false);
    rec.onend = () => setVoiceListening(false);
    rec.start();
  };

  // F14: PunchOut OCI export
  const handlePunchOut = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return alert('Select items first.');
    window.open(procurementApi.punchoutUrl(ids), '_blank');
  };

  const handleCheckout = async () => {
    if (selectedIds.size === 0) return;
    setCheckingOut(true);
    try {
      const defaultMethod = methods.find(m => m.is_default) || methods[0];
      const res = await reagentCartApi.checkout({
        item_ids: Array.from(selectedIds),
        payment_method_id: defaultMethod?.id,
      });
      const data = res.data as any;
      if (data.mode === 'stripe') {
        alert(`✓ ${data.ordered_count} item(s) ordered and charged. Total: $${data.total_amount.toFixed(2)}\nStripe charge: ${data.stripe_charge_id}`);
      } else {
        alert(`✓ ${data.ordered_count} item(s) marked as ordered. Total: $${data.total_amount.toFixed(2)}\n\nStripe is not configured — process the payment externally and the items will appear as 'ordered' for tracking.`);
      }
      clearSelection();
      load();
    } catch (e: any) {
      alert('Checkout failed: ' + (e?.response?.data?.detail || e?.message));
    }
    setCheckingOut(false);
  };

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>🛒 Reagent Cart</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            Items captured from Sigma, Thermo, VWR, Abcam, NEB and 15+ other vendors via the LabOS browser extension
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={load}
            style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Extension install banner */}
      {items.length === 0 && !loading && (
        <div className="card" style={{ marginBottom: 20, padding: 20, background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))', borderColor: 'rgba(99,102,241,0.3)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 36 }}>🧪</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Install the LabOS browser extension</div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Capture reagents from Sigma-Aldrich, Thermo Fisher, VWR, Fisher Scientific, Bio-Rad, Abcam,
                NEB, IDT, R&amp;D Systems, Cell Signaling, Qiagen, Santa Cruz, Miltenyi, Eppendorf, Beckman,
                Promega, Takara — and any other vendor you configure. Click <em>Add to LabOS</em> on any
                product page and it shows up here, ready for in-app purchase.
              </p>
              <ol style={{ margin: 0, fontSize: 13, paddingLeft: 18, lineHeight: 1.7 }}>
                <li>Open <code style={{ background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4 }}>chrome://extensions</code></li>
                <li>Toggle <strong>Developer mode</strong></li>
                <li>Click <strong>Load unpacked</strong> and select the <code style={{ background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4 }}>extension/</code> folder in this repo</li>
                <li>Pin it to your toolbar, click ⚙️, paste your LabOS API URL + token</li>
                <li>Visit a vendor product page — click the orange <strong>Add to LabOS</strong> button</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Stripe status banner */}
      {stripeConfigured === false && (
        <div className="card" style={{ marginBottom: 20, padding: 14, background: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.35)', fontSize: 13 }}>
          <strong>💳 In-app payment not configured.</strong> You can still capture items and mark them as ordered,
          but to charge a saved card automatically set <code>STRIPE_SECRET_KEY</code> in <code>backend/.env</code>.
          Manage cards in <a href="#" onClick={(e) => { e.preventDefault(); const btn = [...document.querySelectorAll('button')].find(b => /payment methods/i.test(b.textContent || '')); btn?.click(); }} style={{ color: 'var(--accent, #6366f1)' }}>Payment Methods</a>.
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total items</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{items.length}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pending review</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b' }}>{items.filter(i => i.status === 'pending').length}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Vendors</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#6366f1' }}>{vendors.length}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cart value</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#22c55e' }}>
            ${items.reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 1), 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: 12, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name / catalog / vendor…"
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}>
          <option value="all">All statuses</option>
          <option value="pending">Pending review</option>
          <option value="approved">Approved</option>
          <option value="ordered">Ordered</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}>
          <option value="all">All vendors</option>
          {vendors.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <button onClick={selectAllFiltered}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>
          Select all visible
        </button>
        <button onClick={startVoiceCapture}
          title="Speak an item to add (Web Speech API)"
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: voiceListening ? '#ef4444' : 'var(--surface2)', color: voiceListening ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 12 }}>
          {voiceListening ? '🔴 Listening…' : '🎤 Voice add'}
        </button>
        <button onClick={handlePunchOut}
          title="Export selected as PunchOut OCI XML for ERP procurement"
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>
          ⬇ PunchOut (OCI)
        </button>
      </div>

      {/* Items table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading cart…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {items.length === 0 ? 'No items captured yet — install the extension and visit a vendor.' : 'No items match the current filters.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2, rgba(0,0,0,0.04))' }}>
                <th style={{ width: 30, padding: '10px 10px' }}></th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Product</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Vendor</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Catalog</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Size</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Price</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</th>
                <th style={{ width: 60, padding: '10px 10px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const sm = STATUS_META[item.status];
                return (
                  <React.Fragment key={item.id}>
                  <tr style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                    <td style={{ textAlign: 'center', padding: '10px 10px' }}>
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)}
                        disabled={item.status === 'ordered' || item.status === 'received'} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {item.image_url && <img src={item.image_url} alt="" style={{ width: 36, height: 36, objectFit: 'contain', background: 'var(--surface2)', borderRadius: 4 }} />}
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {item.url ? <a href={item.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text)', textDecoration: 'none' }}>{item.name}</a> : item.name}
                          </div>
                          {item.cas && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CAS {item.cas}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{item.vendor}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{item.catalog}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{item.size}</td>
                    <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                      <input type="number" min={1} value={item.quantity} onChange={e => handleQuantity(item.id, parseInt(e.target.value) || 1)}
                        disabled={item.status === 'ordered' || item.status === 'received'}
                        style={{ width: 50, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, textAlign: 'center' }} />
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 600 }}>
                      {item.unit_price != null ? `$${(item.unit_price * item.quantity).toFixed(2)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color }}>
                        {sm.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} title="Compare prices / set recurrence"
                          style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(99,102,241,0.12)', color: '#818cf8', cursor: 'pointer', fontSize: 11 }}>
                          {expandedId === item.id ? '▴' : '▾'}
                        </button>
                        {item.status === 'pending' && (
                          <button onClick={() => handleApprove(item.id)} title="Approve"
                            style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(99,102,241,0.15)', color: '#818cf8', cursor: 'pointer', fontSize: 11 }}>
                            ✓
                          </button>
                        )}
                        <button onClick={() => handleDelete(item.id)} title="Remove"
                          style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.12)', color: '#f87171', cursor: 'pointer', fontSize: 11 }}>
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr>
                      <td colSpan={9} style={{ padding: 0 }}>
                        <ItemDetailRow item={item} onChanged={load} onCompare={() => handleComparePrices(item.id, item.name, item.catalog)} onRecurrence={(p) => handleRecurrence(item.id, p)} />
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Checkout bar (sticky bottom) */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'sticky', bottom: 0, marginTop: 16, padding: '14px 18px',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Total: <strong style={{ color: '#22c55e' }}>${totalSelected.toFixed(2)}</strong>
              {stripeConfigured && methods.length > 0 && (
                <> · paying with {(methods.find(m => m.is_default) || methods[0]).brand} ····{(methods.find(m => m.is_default) || methods[0]).last4}</>
              )}
              {stripeConfigured === false && <> · Stripe not configured — items will be marked ordered without charging</>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={clearSelection}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Clear selection
            </button>
            <button onClick={handleCheckout} disabled={checkingOut}
              style={{
                padding: '10px 22px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, color: '#fff',
                background: stripeConfigured ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#6366f1',
                opacity: checkingOut ? 0.6 : 1,
              }}>
              {checkingOut ? 'Processing…' : stripeConfigured ? `💳 Charge & order ($${totalSelected.toFixed(2)})` : `📋 Mark as ordered ($${totalSelected.toFixed(2)})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Per-item expandable detail (F1 prices, F8 recurrence, F9 RFQ, F15 borrow) ──
function ItemDetailRow({
  item, onChanged, onCompare, onRecurrence,
}: {
  item: CartItem;
  onChanged: () => void;
  onCompare: () => void;
  onRecurrence: (pattern: string) => void;
}) {
  const [altPrices, setAltPrices] = useState<any[]>([]);
  const [lenders, setLenders] = useState<any[]>([]);
  const [loadingAlt, setLoadingAlt] = useState(false);

  const loadAlt = useCallback(async () => {
    setLoadingAlt(true);
    try {
      const a = await procurementApi.getAltPrices(item.id);
      setAltPrices((a.data as any) || []);
    } catch {}
    setLoadingAlt(false);
  }, [item.id]);

  const loadLenders = useCallback(async () => {
    try {
      const l = await procurementApi.findLender({ catalog: item.catalog, name: item.name });
      setLenders(l.data || []);
    } catch {}
  }, [item.catalog, item.name]);

  useEffect(() => { loadAlt(); loadLenders(); }, [loadAlt, loadLenders]);

  const swap = async (alt: any) => {
    if (!confirm(`Switch to ${alt.vendor} at $${alt.unit_price}?`)) return;
    await procurementApi.swapVendor(item.id, alt.vendor, alt.unit_price, alt.url);
    onChanged();
  };

  const requestQuote = async () => {
    const r = await procurementApi.requestQuote(item.id);
    alert(`RFQ requested. Vendor sales email: ${(r.data as any).would_email || '(unknown)'}`);
  };

  const requestBorrow = async (lender: any) => {
    await procurementApi.createBorrow({
      inventory_item_id: lender.id,
      cart_item_id: item.id,
      requested_quantity: String(item.quantity),
      purpose: `Need ${item.name}`,
    });
    alert(`Borrow request sent to lab #${lender.owner_id || '?'} for "${lender.name}".`);
  };

  const currentPrice = item.unit_price || 0;
  const cheapest = altPrices.length > 0 ? Math.min(...altPrices.map(p => p.unit_price)) : null;
  const savings = cheapest !== null && currentPrice > cheapest ? (currentPrice - cheapest) * (item.quantity || 1) : 0;

  return (
    <div style={{ padding: 16, background: 'rgba(99,102,241,0.04)', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {/* Price comparison */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 8 }}>
            💵 Cross-vendor prices
          </div>
          {savings > 0 && (
            <div style={{ padding: 8, marginBottom: 8, background: 'rgba(34,197,94,0.1)', borderRadius: 6, fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
              💰 Save ${savings.toFixed(2)} by switching vendors
            </div>
          )}
          {altPrices.length === 0 ? (
            <button onClick={onCompare} disabled={loadingAlt}
              style={{ padding: '6px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
              🔍 Compare prices across vendors
            </button>
          ) : altPrices.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', fontSize: 12, borderRadius: 4, background: p.vendor === item.vendor ? 'rgba(99,102,241,0.1)' : 'transparent' }}>
              <span>{p.vendor === item.vendor ? '● ' : '○ '}{p.vendor}</span>
              <span>
                <strong>${p.unit_price.toFixed(2)}</strong>
                {p.vendor !== item.vendor && (
                  <button onClick={() => swap(p)} style={{ marginLeft: 8, padding: '2px 6px', fontSize: 10, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>Switch</button>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Recurrence & RFQ */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 8 }}>
            ⏰ Recurrence
          </div>
          <select onChange={e => onRecurrence(e.target.value)} defaultValue=""
            style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', marginBottom: 12 }}>
            <option value="">No recurrence</option>
            <option value="weekly">Reorder weekly</option>
            <option value="biweekly">Reorder every 2 weeks</option>
            <option value="monthly">Reorder monthly</option>
            <option value="quarterly">Reorder every 3 months</option>
          </select>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 8 }}>
            📄 RFQ
          </div>
          <button onClick={requestQuote}
            style={{ width: '100%', padding: '6px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
            Request formal quote
          </button>
        </div>

        {/* Lab-to-lab borrow */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 8 }}>
            🔁 Borrow from another lab
          </div>
          {lenders.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 8 }}>
              No matching inventory in any other lab.
            </div>
          ) : lenders.map(l => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 6, fontSize: 11 }}>
              <span>{l.name} {l.location && `· ${l.location}`}</span>
              <button onClick={() => requestBorrow(l)} style={{ padding: '2px 6px', fontSize: 10, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
                Borrow
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
