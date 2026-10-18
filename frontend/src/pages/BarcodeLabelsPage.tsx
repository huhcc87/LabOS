import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import { LABEL_SIZES, LOT_PREFIX, printLabels, type LabelSize, type LabelSpec } from '../lib/labelPrint';

const day = (ms?: number) => (ms ? new Date(ms).toLocaleDateString() : '—');

/** Print barcode labels for stock: one per item, or one per received lot (scans back to that lot). */
export default function BarcodeLabelsPage() {
  const { token } = useAuth();
  const data = useQuery(api.receiving.stockLots, token ? { token } : 'skip');
  const [mode, setMode] = useState<'lot' | 'item'>('lot');
  const [size, setSize] = useState<LabelSize>('2x1');
  const [kind, setKind] = useState<'barcode' | 'qrcode'>('barcode');
  const [copies, setCopies] = useState('1');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const nameOf = useMemo(() => new Map((data?.items ?? []).map((i) => [i._id as string, i.name])), [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!data) return [];
    if (mode === 'lot') {
      return data.lots
        .map((l) => ({ id: l._id as string, title: nameOf.get(l.inventory_id) ?? '(deleted item)', sub: `Lot ${l.lot_number} · ${l.quantity_remaining} left · exp ${day(l.expiry_date)}`, code: `${LOT_PREFIX}${l._id}` }))
        .filter((r) => !q || `${r.title} ${r.sub}`.toLowerCase().includes(q));
    }
    return data.items
      .map((i) => ({ id: i._id as string, title: i.name, sub: [i.catalog_number && `#${i.catalog_number}`, i.location].filter(Boolean).join(' · '), code: i.barcode || i.catalog_number || '' }))
      .filter((r) => !q || `${r.title} ${r.sub}`.toLowerCase().includes(q));
  }, [data, mode, search, nameOf]);

  const toggle = (id: string) => { const s = new Set(picked); if (s.has(id)) s.delete(id); else s.add(id); setPicked(s); };
  const chosen = rows.filter((r) => picked.has(r.id));
  const noCode = chosen.filter((r) => !r.code).length;
  const n = Math.min(100, Math.max(1, Math.floor(Number(copies)) || 1));

  const print = () => {
    const labels: LabelSpec[] = chosen.filter((r) => r.code).flatMap((r) => Array.from({ length: n }, () => ({ title: r.title, sub: r.sub, code: r.code, kind })));
    if (!labels.length) return toast.error('Pick at least one label with a code.');
    if (!printLabels(labels, size)) toast.error('Allow pop-ups to print labels.');
  };

  return (
    <div className="page">
      <h1 style={{ fontSize: 24, margin: 0 }}>Barcode Labels</h1>
      <p style={{ color: 'var(--text-muted)', margin: '4px 0 16px', fontSize: 14 }}>
        Print labels for what you receive. A lot label scans straight back to its lot in the Barcode Scanner.
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div role="tablist" aria-label="Label for" style={{ display: 'flex', gap: 6 }}>
          {([['lot', 'Lots'], ['item', 'Items']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={mode === k} className={`btn btn-sm ${mode === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setMode(k); setPicked(new Set()); }}>{l}</button>
          ))}
        </div>
        <div><label htmlFor="lb-size" style={{ fontSize: 12, display: 'block' }}>Label size</label>
          <select id="lb-size" className="form-select" value={size} onChange={(e) => setSize(e.target.value as LabelSize)}>
            {Object.entries(LABEL_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></div>
        <div><label htmlFor="lb-kind" style={{ fontSize: 12, display: 'block' }}>Code</label>
          <select id="lb-kind" className="form-select" value={kind} onChange={(e) => setKind(e.target.value as 'barcode' | 'qrcode')}>
            <option value="barcode">Barcode (Code 128)</option><option value="qrcode">QR code</option>
          </select></div>
        <div><label htmlFor="lb-copies" style={{ fontSize: 12, display: 'block' }}>Copies each</label>
          <input id="lb-copies" className="form-input" style={{ width: 80 }} type="number" min={1} max={100} value={copies} onChange={(e) => setCopies(e.target.value)} /></div>
        <input className="form-input" style={{ flex: 1, minWidth: 180 }} placeholder="Search…" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={print} disabled={chosen.length === 0}>🖨️ Print {chosen.length ? `${chosen.length * n} label${chosen.length * n > 1 ? 's' : ''}` : ''}</button>
      </div>
      {noCode > 0 && <p className="auth-note warn">{noCode} picked item{noCode > 1 ? 's have' : ' has'} no barcode or catalog number and will be skipped. Print lot labels for them instead.</p>}

      <div className="card" style={{ padding: 0 }}>
        {data === undefined ? <p style={{ padding: 16, color: 'var(--text-muted)' }}>Loading…</p> : rows.length === 0 ? (
          <p style={{ padding: 16, color: 'var(--text-muted)' }}>{mode === 'lot' ? 'No lots in stock yet. Receive a delivery on the Receiving page first.' : 'No items found.'}</p>
        ) : rows.map((r) => (
          <label key={r.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center' }}>
            <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
            <span style={{ flex: 1 }}><strong>{r.title}</strong><br /><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.sub}</span></span>
            <code style={{ fontSize: 12, color: r.code ? 'var(--text-muted)' : 'var(--bad-text)' }}>{r.code ? r.code.slice(0, 18) : 'no code'}</code>
          </label>
        ))}
      </div>
    </div>
  );
}
