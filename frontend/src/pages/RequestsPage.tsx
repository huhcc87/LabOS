import { useCallback, useEffect, useMemo, useState } from 'react';
import { reagentCartApi, inventoryApi } from '../lib/api';
import { RequestForm, SpendPanel, InvoicePanel, type RequestInput } from '../features/cart/CartPanels';
import { useNavigate } from '../context/NavigationContext';
import LabBanner from '../components/LabBanner';
import EmojiIcon from '../components/EmojiIcon';
import { VENDOR_SEARCHES, vendorSearchUrl } from '../data/vendorSearch';
import { cartCsv, downloadText, openPrint, poHtml } from '../features/cart/cartExport';
import { flagRequests } from '../features/cart/requestFlags';

type Status = 'pending' | 'approved' | 'rejected' | 'ordered' | 'received' | 'cancelled';

interface RequestRow {
  id: string; name: string; vendor: string; catalog: string; size: string; unit_price: number | null; quantity: number;
  url: string; status: Status; captured_at: string; ordered_at: string | null; requested_by?: string;
  project?: string; grant?: string; urgency?: string; po_number?: string; decision_note?: string; over_budget?: string[];
}

/** The request pipeline, left to right. Rejected and cancelled requests sit under "Other". */
const STAGES: { key: string; label: string; match: (s: Status) => boolean }[] = [
  { key: 'new', label: 'New', match: (s) => s === 'pending' },
  { key: 'approved', label: 'Approved', match: (s) => s === 'approved' },
  { key: 'ordered', label: 'Ordered', match: (s) => s === 'ordered' },
  { key: 'received', label: 'Received', match: (s) => s === 'received' },
  { key: 'all', label: 'All', match: () => true },
  { key: 'other', label: 'Other', match: (s) => s === 'rejected' || s === 'cancelled' },
];

const money = (n: number | null) => (n == null ? '' : n.toLocaleString(undefined, { style: 'currency', currency: 'USD' }));
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const errText = (e: unknown) => (e as { data?: string; message?: string })?.data ?? (e as Error)?.message ?? 'Something went wrong.';

interface Hit { name: string; vendor: string; catalog: string; size: string; unit_price?: number; source: string; notes?: string }

/** Add Request: look the item up in what the lab already has, or enter it by vendor + catalog number. */
function AddRequestPanel({ autoLimit, onSubmit, onClose, start }: { autoLimit: number; onSubmit: (r: RequestInput) => Promise<void>; onClose: () => void; start?: Partial<Hit> }) {
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState('');
  const [catalog, setCatalog] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [form, setForm] = useState(!!start);
  const [prefill, setPrefill] = useState<Partial<Hit>>(start ?? {});
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const search = async () => {
    const term = q.trim();
    if (!term) return;
    setBusy(true);
    try {
      const [inv, past] = await Promise.all([inventoryApi.list(1, 8, term), reagentCartApi.list()]);
      const fromInventory: Hit[] = ((inv.data as { items: any[] }).items ?? []).map((i) => ({
        name: i.name, vendor: i.supplier ?? '', catalog: i.catalog_number ?? '', size: i.unit ?? '', unit_price: i.cost_per_unit ?? undefined, source: 'Your inventory',
      }));
      const needle = term.toLowerCase();
      const seen = new Set<string>();
      const fromHistory: Hit[] = ((past.data as RequestRow[]) ?? [])
        .filter((r) => `${r.name} ${r.catalog} ${r.vendor}`.toLowerCase().includes(needle))
        .filter((r) => { const k = `${r.vendor}|${r.catalog}|${r.name}`; if (seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, 8)
        .map((r) => ({ name: r.name, vendor: r.vendor, catalog: r.catalog, size: r.size, unit_price: r.unit_price ?? undefined, source: 'Request history' }));
      setHits([...fromInventory, ...fromHistory]);
    } finally { setBusy(false); }
  };

  const pick = (h: Partial<Hit>) => { setPrefill(h); setForm(true); };
  const lookupSpecific = () => pick({ vendor: vendor.trim(), catalog: catalog.trim() });

  if (form) {
    return (
      <div>
        <RequestForm key={JSON.stringify(prefill)} autoLimit={autoLimit} onCancel={onClose} onSubmit={onSubmit}
          initial={{ name: prefill.name ?? '', vendor: prefill.vendor ?? '', catalog: prefill.catalog ?? '', size: prefill.size ?? '', price: prefill.unit_price != null ? String(prefill.unit_price) : '', notes: prefill.notes ?? '' }} />
      </div>
    );
  }

  const field: React.CSSProperties = { padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, width: '100%', boxSizing: 'border-box' };
  return (
    <div className="card" style={{ padding: 20, marginBottom: 16 }} role="region" aria-label="Add request">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Add request</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => pick({})}>Skip lookup</button>
          <button className="btn btn-secondary" onClick={onClose} aria-label="Close">Close</button>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void search(); }} style={{ display: 'flex', gap: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} style={field} aria-label="Search products" placeholder="Search by product name, vendor or catalog number" autoFocus />
        <button className="btn btn-primary" type="submit" disabled={busy || !q.trim()}>Search</button>
      </form>

      {hits && (
        <div style={{ marginTop: 14 }}>
          {hits.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nothing matched in your inventory or past requests. Use the form to add it.</p>}
          {hits.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{h.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{[h.vendor, h.catalog && `Cat. ${h.catalog}`, h.size, h.unit_price != null && money(h.unit_price)].filter(Boolean).join(' · ')}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.source}</span>
              <button className="btn btn-primary" onClick={() => pick(h)}>Request</button>
            </div>
          ))}
          <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={() => pick({ name: q.trim() })}>Not listed? Request “{q.trim()}”</button>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>Search “{q.trim()}” on a vendor's site:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {VENDOR_SEARCHES.slice(0, 8).map((v) => (
              <a key={v.name} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} href={vendorSearchUrl(v, q)} target="_blank" rel="noopener noreferrer">{v.name}</a>
            ))}
            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => navigate('chemical-search')}>More…</button>
          </div>
        </div>
      )}

      <div style={{ margin: '18px 0 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>OR</div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Request a specific item</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Enter both the vendor and the catalog number.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} style={field} aria-label="Vendor" placeholder="Vendor" />
        <input value={catalog} onChange={(e) => setCatalog(e.target.value)} style={field} aria-label="Catalog number" placeholder="Catalog number" />
        <button className="btn btn-secondary" disabled={!vendor.trim() || !catalog.trim()} onClick={lookupSpecific}>Continue</button>
      </div>
    </div>
  );
}

export default function RequestsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('new');
  const [view, setView] = useState<'requests' | 'orders'>('requests');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cfg, setCfg] = useState({ auto_approve_limit: 0, can_manage: false });
  const [panel, setPanel] = useState<'' | 'add' | 'spend' | 'invoices'>('');
  const [addMenu, setAddMenu] = useState(false);
  const [groupMenu, setGroupMenu] = useState(false);
  const [notice, setNotice] = useState('');
  // Chemical Search hands over a name to request; open the Add panel with it filled in.
  // Read without removing: React runs state initializers twice in development, so removal happens in an effect.
  const [start] = useState<Partial<Hit> | undefined>(() => {
    try {
      const raw = sessionStorage.getItem('labos_request_prefill');
      return raw ? (JSON.parse(raw) as Partial<Hit>) : undefined;
    } catch { return undefined; }
  });
  useEffect(() => {
    try { sessionStorage.removeItem('labos_request_prefill'); } catch { /* ignore */ }
    if (start) setPanel('add');
  }, [start]);

  const load = useCallback(async () => {
    try { setRows(((await reagentCartApi.list()).data as RequestRow[]) ?? []); } catch (e) { setNotice(errText(e)); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); reagentCartApi.config().then((r) => setCfg(r.data as typeof cfg)).catch(() => {}); }, [load]);

  const counts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s.key, rows.filter((r) => s.match(r.status)).length])), [rows]);
  const flags = useMemo(() => flagRequests(rows), [rows]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const vendors = useMemo(() => Array.from(new Set(rows.map((r) => r.vendor).filter(Boolean))).sort(), [rows]);
  const visible = useMemo(() => {
    const match = STAGES.find((s) => s.key === stage)!.match;
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => match(r.status) && (!flaggedOnly || flags.has(r.id)) && (vendorFilter === 'all' || r.vendor === vendorFilter)
      && (!needle || `${r.name} ${r.catalog} ${r.vendor} ${r.requested_by ?? ''}`.toLowerCase().includes(needle)));
  }, [rows, stage, vendorFilter, search, flaggedOnly, flags]);

  useEffect(() => { setSelected(new Set()); }, [stage, vendorFilter, search]);

  /** One order per PO number: everything bought from one vendor in one go. */
  const orders = useMemo(() => {
    const byPo = new Map<string, RequestRow[]>();
    for (const r of rows) if (r.po_number) byPo.set(r.po_number, [...(byPo.get(r.po_number) ?? []), r]);
    return [...byPo.entries()].map(([po, items]) => ({
      po, items, vendor: items[0].vendor || 'Unassigned',
      total: items.reduce((s, r) => s + (r.unit_price ?? 0) * r.quantity, 0),
      date: items.map((r) => r.ordered_at ?? r.captured_at).sort().pop() ?? '',
      received: items.every((r) => r.status === 'received'),
    })).sort((a, b) => b.date.localeCompare(a.date));
  }, [rows]);

  const exportCsv = () => downloadText(`requests-${new Date().toISOString().slice(0, 10)}.csv`, cartCsv(visible.map((r) => ({ ...r, vendor: r.vendor, catalog: r.catalog }))));
  const printPo = (o: (typeof orders)[number]) => {
    if (!openPrint(poHtml(o.po, o.vendor, o.items))) setNotice('Allow pop-ups to print the purchase order.');
  };

  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const ids = [...selected];

  const run = async (fn: () => Promise<string | void>) => {
    setNotice(''); setGroupMenu(false);
    try { const msg = await fn(); if (msg) setNotice(msg); await load(); setSelected(new Set()); } catch (e) { setNotice(errText(e)); }
  };
  const approve = (list: string[]) => run(async () => {
    const r = (await reagentCartApi.decide(list, 'approve')).data as { changed: number; blocked: { name: string; budgets: string[] }[] };
    if (r.blocked?.length) {
      const names = r.blocked.map((b) => `${b.name} (${b.budgets.join(', ')})`).join('; ');
      if (window.confirm(`Over budget: ${names}.\n\nApprove anyway?`)) await reagentCartApi.decide(r.blocked.map((b: any) => b.id), 'approve', undefined, true);
    }
  });
  const reject = (list: string[]) => {
    const note = window.prompt('Reason for rejecting (optional):');
    if (note === null) return;
    void run(async () => { await reagentCartApi.decide(list, 'reject', note || undefined); });
  };
  const placeOrder = (list: string[]) => run(async () => {
    const r = (await reagentCartApi.checkout({ item_ids: list })).data as { ordered_count: number; skipped: number };
    return `${r.ordered_count} request${r.ordered_count === 1 ? '' : 's'} ordered${r.skipped ? `, ${r.skipped} skipped (only approved requests can be ordered)` : ''}.`;
  });
  /** Requests every inventory item at or under its minimum, skipping ones that already have an open request. */
  const reorderLow = () => run(async () => {
    const r = (await reagentCartApi.reorderLowStock()).data as { created: number; low: number };
    setStage('new');
    return r.low === 0 ? 'No inventory items are at or under their minimum.'
      : r.created === 0 ? 'Every low-stock item already has an open request.'
      : `${r.created} request${r.created === 1 ? '' : 's'} created for low-stock items.`;
  });
  const cancel = (id: string) => { if (window.confirm('Cancel this request?')) void run(async () => { await reagentCartApi.delete(id); }); };
  const create = async (r: RequestInput) => { await reagentCartApi.create(r); setPanel(''); setStage('new'); await load(); };

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', padding: '8px 10px', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '12px 10px', fontSize: 13, verticalAlign: 'top', borderTop: '1px solid var(--border)' };
  const link: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: 0 };

  return (
    <div>
      <LabBanner art="procurement" title="Requests" subtitle="Request what the lab needs, get it approved, order it, and receive it into inventory." />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div role="group" aria-label="View" style={{ display: 'flex', gap: 0 }}>
          {(['requests', 'orders'] as const).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={view === v ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '6px 16px', borderRadius: v === 'requests' ? '6px 0 0 6px' : '0 6px 6px 0' }}>
              {v === 'requests' ? 'Requests' : `Orders${orders.length ? ` ${orders.length}` : ''}`}
            </button>
          ))}
        </div>
        {view === 'requests' && <div role="tablist" aria-label="Request stages" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STAGES.map((s) => (
            <button key={s.key} role="tab" aria-selected={stage === s.key} onClick={() => setStage(s.key)}
              className={stage === s.key ? 'btn btn-primary' : 'btn btn-secondary'} style={{ padding: '6px 14px' }}>
              {s.label}{counts[s.key] ? <span style={{ marginLeft: 6, opacity: 0.8 }}>{counts[s.key]}</span> : null}
            </button>
          ))}
        </div>}
        <div style={{ flex: 1 }} />
        {view === 'requests' && <button className="btn btn-secondary" onClick={exportCsv} disabled={!visible.length} title="Download the requests shown as a CSV file"><EmojiIcon glyph="⬇" /> Export</button>}
        <button className="btn btn-secondary" onClick={() => setPanel(panel === 'spend' ? '' : 'spend')}><EmojiIcon glyph="📊" /> Spend</button>
        <button className="btn btn-secondary" onClick={() => setPanel(panel === 'invoices' ? '' : 'invoices')}><EmojiIcon glyph="🧾" /> Invoices</button>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-primary" aria-haspopup="menu" aria-expanded={addMenu} onClick={() => setAddMenu((v) => !v)}>+ Add</button>
          {addMenu && (
            <div role="menu" className="card" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 30, minWidth: 170, padding: 4 }}>
              <button role="menuitem" className="btn btn-secondary" style={{ width: '100%', border: 'none', textAlign: 'left' }} onClick={() => { setAddMenu(false); setPanel('add'); }}>Request</button>
              <button role="menuitem" className="btn btn-secondary" style={{ width: '100%', border: 'none', textAlign: 'left' }} onClick={() => { setAddMenu(false); navigate('inventory'); }}>Inventory item</button>
              <button role="menuitem" className="btn btn-secondary" style={{ width: '100%', border: 'none', textAlign: 'left' }} onClick={() => { setAddMenu(false); void reorderLow(); }}>Reorder low stock</button>
            </div>
          )}
        </div>
      </div>

      {notice && <div role="status" className="card" style={{ padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>{notice}</div>}
      {panel === 'add' && <AddRequestPanel autoLimit={cfg.auto_approve_limit} onSubmit={create} onClose={() => setPanel('')} start={start} />}
      {panel === 'spend' && <SpendPanel onClose={() => setPanel('')} />}
      {panel === 'invoices' && <InvoicePanel onClose={() => setPanel('')} />}

      {view === 'orders' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr><th style={th}>Order (PO)</th><th style={th}>Vendor</th><th style={th}>Items</th><th style={{ ...th, textAlign: 'right' }}>Total</th><th style={th}>Date</th><th style={th}>Status</th><th style={th} /></tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: 36 }}>No orders yet. Approved requests become orders when you place them.</td></tr>
              )}
              {orders.map((o) => (
                <tr key={o.po}>
                  <td style={{ ...td, fontWeight: 600 }}>{o.po}</td>
                  <td style={td}>{o.vendor}</td>
                  <td style={td}>{o.items.map((i) => i.name).join(', ')}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{money(o.total) || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{o.date ? day(o.date) : ''}</td>
                  <td style={td}>{o.received ? 'Received' : 'Ordered'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button style={link} onClick={() => printPo(o)}>Print PO</button>
                    {!o.received && <button style={{ ...link, marginLeft: 12 }} onClick={() => { sessionStorage.setItem('labos_receive_order', String(o.items[0].id)); navigate('receiving'); }}>Receive</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'requests' && <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {cfg.can_manage && (
          <div style={{ position: 'relative' }}>
            <button className="btn btn-secondary" disabled={!ids.length} aria-haspopup="menu" aria-expanded={groupMenu} onClick={() => setGroupMenu((v) => !v)}>
              Group actions{ids.length ? ` (${ids.length})` : ''}
            </button>
            {groupMenu && (
              <div role="menu" className="card" style={{ position: 'absolute', left: 0, top: '110%', zIndex: 30, minWidth: 190, padding: 4 }}>
                <button role="menuitem" className="btn btn-secondary" style={{ width: '100%', border: 'none', textAlign: 'left' }} onClick={() => void approve(ids)}>Approve</button>
                <button role="menuitem" className="btn btn-secondary" style={{ width: '100%', border: 'none', textAlign: 'left' }} onClick={() => reject(ids)}>Reject</button>
                <button role="menuitem" className="btn btn-secondary" style={{ width: '100%', border: 'none', textAlign: 'left' }} onClick={() => void placeOrder(ids)}>Place order</button>
              </div>
            )}
          </div>
        )}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by item, vendor, catalog or person"
          aria-label="Filter requests" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', minWidth: 280 }} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          Flagged only{flags.size ? ` (${flags.size})` : ''}
        </label>
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} aria-label="Filter by vendor"
          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="all">All vendors</option>
          {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
          <thead>
            <tr>
              <th style={th}>{cfg.can_manage && <input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(visible.map((r) => r.id)))} />}</th>
              <th style={th}>Item</th><th style={th}>Vendor</th><th style={{ ...th, textAlign: 'right' }}>Total</th>
              <th style={th}>Details</th><th style={th}>From</th><th style={th}>Updated</th><th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>Loading requests…</td></tr>}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: 36 }}>
                No requests here. Use <strong>+ Add</strong> to request something.
              </td></tr>
            )}
            {visible.map((r) => (
              <tr key={r.id}>
                <td style={td}>{cfg.can_manage && <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}</td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  {r.size && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.size}</div>}
                </td>
                <td style={td}>
                  <div>{r.vendor || '—'}</div>
                  {r.catalog && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.catalog}</div>}
                  {r.url && /^https?:\/\//i.test(r.url) && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>Product page</a>}
                </td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div>{money(r.unit_price != null ? r.unit_price * r.quantity : null) || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>× {r.quantity}</div>
                </td>
                <td style={td}>
                  {r.grant && <div style={{ fontSize: 12 }}>Grant: {r.grant}</div>}
                  {r.project && <div style={{ fontSize: 12 }}>Project: {r.project}</div>}
                  {r.urgency === 'urgent' && <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Urgent</div>}
                  {r.po_number && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.po_number}</div>}
                  {!!r.over_budget?.length && <div style={{ fontSize: 12, color: '#dc2626' }}>Over budget: {r.over_budget.join(', ')}</div>}
                  {flags.get(r.id)?.map((f) => (
                    <div key={f.kind} style={{ fontSize: 12, color: '#b45309', display: 'flex', gap: 4, alignItems: 'baseline' }}><EmojiIcon glyph="⚠️" /> {f.text}</div>
                  ))}
                  {r.decision_note && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.decision_note}</div>}
                </td>
                <td style={td}>{r.requested_by || '—'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{day(r.ordered_at ?? r.captured_at)}</td>
                <td style={td}>
                  <div style={{ textTransform: 'capitalize', marginBottom: 4 }}>{r.status === 'pending' ? 'Submitted' : r.status}</div>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      {cfg.can_manage && <button style={link} onClick={() => void approve([r.id])}>Approve</button>}
                      {cfg.can_manage && <button style={link} onClick={() => reject([r.id])}>Reject</button>}
                      <button style={link} onClick={() => cancel(r.id)}>Cancel</button>
                    </div>
                  )}
                  {r.status === 'approved' && cfg.can_manage && <button style={link} onClick={() => void placeOrder([r.id])}>Place order</button>}
                  {r.status === 'ordered' && (
                    <button style={link} onClick={() => { sessionStorage.setItem('labos_receive_order', String(r.id)); navigate('receiving'); }}>Receive</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>}
    </div>
  );
}
