import { useRef, useState } from 'react';
import { useConvex, useMutation } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../convex/_generated/api';
import type { Doc } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';
import { errText } from '../lib/errors';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { LOT_PREFIX, printLabels } from '../lib/labelPrint';

type Lot = Doc<'inventory_lots'> & { item_name: string };
type Result = {
  orders: Array<Doc<'reagent_cart'> & { outstanding: number }>;
  items: Doc<'inventory'>[];
  lots: Lot[];
};

const day = (ms?: number) => (ms ? new Date(ms).toLocaleDateString() : '—');

/** Scan any lab barcode: a lot label, a catalog number, or an item barcode. Shows what it is and what you can do. */
export default function BarcodeScannerPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { token } = useAuth();
  const convex = useConvex();
  const consume = useMutation(api.receiving.consume);
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [used, setUsed] = useState<Record<string, string>>({});

  const find = async (raw: string) => {
    const value = raw.trim();
    if (!value || !token) return;
    try {
      const res = (await convex.query(api.receiving.lookup, { token, code: value })) as Result;
      setResult(res);
      if (!res.orders.length && !res.items.length && !res.lots.length) toast('Nothing in LabOS has that code.', { icon: 'ℹ️' });
      // For an item code, also list its lots so one can be picked.
      if (res.items.length && !res.lots.length) {
        const lots = await Promise.all(res.items.map((i) => convex.query(api.receiving.lots, { token, inventory_id: i._id })));
        setResult({ ...res, lots: lots.flat() as Lot[] });
      }
    } catch (e) { toast.error(errText(e)); }
  };

  const clear = () => { setCode(''); setResult(null); inputRef.current?.focus(); };

  const use = async (lot: Lot) => {
    const qty = Number(used[lot._id] ?? '1');
    try {
      const r = await consume({ token, lot_id: lot._id, quantity: qty });
      toast.success(`Used ${qty}. ${r.lot_remaining} left in lot ${lot.lot_number}.`);
      setUsed({ ...used, [lot._id]: '1' });
      await find(code);
    } catch (e) { toast.error(errText(e)); }
  };

  const printLot = (lot: Lot) => {
    const ok = printLabels([{ title: lot.item_name, sub: `Lot ${lot.lot_number}${lot.expiry_date ? ` · exp ${day(lot.expiry_date)}` : ''}`, code: `${LOT_PREFIX}${lot._id}` }]);
    if (!ok) toast.error('Allow pop-ups to print labels.');
  };

  const printItem = (item: Doc<'inventory'>) => {
    const value = item.barcode || item.catalog_number;
    if (!value) return toast.error('This item has no barcode or catalog number to print.');
    if (!printLabels([{ title: item.name, sub: item.location, code: value }])) toast.error('Allow pop-ups to print labels.');
  };

  const none = result && !result.orders.length && !result.items.length && !result.lots.length;

  return (
    <div className="page">
      <h1 style={{ fontSize: 24, margin: 0 }}>Barcode Scanner</h1>
      <p style={{ color: 'var(--text-muted)', margin: '4px 0 16px', fontSize: 14 }}>
        Scan a lot label, item barcode or catalog number. Use stock, print a label, or go receive an order.
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <label htmlFor="scan-code" style={{ fontSize: 13, fontWeight: 600 }}>Scan or type a code</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <input id="scan-code" ref={inputRef} className="form-input" style={{ flex: 1, minWidth: 220 }} autoFocus value={code}
            onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); find(code); } }}
            placeholder="A USB barcode scanner types here and presses Enter" />
          <button className="btn btn-primary" onClick={() => find(code)} disabled={!code.trim()}>Find</button>
          <button className="btn btn-secondary" onClick={() => setOpen(true)}>📷 Camera</button>
          {result && <button className="btn btn-secondary" onClick={clear}>Clear</button>}
        </div>
      </div>

      {none && <div className="card" style={{ padding: 16 }}>No lot, item or order matches “{code}”.</div>}

      {result?.lots.map((lot) => (
        <div key={lot._id} className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>{lot.item_name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· lot {lot.lot_number}</span></div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 10px' }}>
            {lot.quantity_remaining} of {lot.quantity_received}{lot.unit ? ` ${lot.unit}` : ''} left · expires {day(lot.expiry_date)}{lot.location ? ` · ${lot.location}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor={`use-${lot._id}`} style={{ fontSize: 13 }}>Use</label>
            <input id={`use-${lot._id}`} className="form-input" style={{ width: 90 }} type="number" min={1} value={used[lot._id] ?? '1'} onChange={(e) => setUsed({ ...used, [lot._id]: e.target.value })} />
            <button className="btn btn-primary btn-sm" onClick={() => use(lot)} disabled={lot.quantity_remaining <= 0}>Take from stock</button>
            <button className="btn btn-secondary btn-sm" onClick={() => printLot(lot)}>🖨️ Print lot label</button>
          </div>
        </div>
      ))}

      {result?.items.map((item) => (
        <div key={item._id} className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>{item.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· in stock {item.quantity}{item.unit ? ` ${item.unit}` : ''}</span></div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 10px' }}>{[item.catalog_number && `#${item.catalog_number}`, item.location, item.expiry_date && `soonest expiry ${day(item.expiry_date)}`].filter(Boolean).join(' · ')}</div>
          <button className="btn btn-secondary btn-sm" onClick={() => printItem(item)}>🖨️ Print item label</button>
        </div>
      ))}

      {result?.orders.map((o) => (
        <div key={o._id} className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>{o.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· on order, {o.outstanding} outstanding</span></div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => onNavigate?.('receiving')} disabled={!onNavigate}>Go to Receiving</button>
        </div>
      ))}

      <BarcodeScanner isOpen={open} onClose={() => setOpen(false)} onScan={(value) => { setOpen(false); setCode(value); find(value); }} />
    </div>
  );
}
