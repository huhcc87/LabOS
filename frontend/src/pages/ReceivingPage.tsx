import { useEffect, useRef, useState } from 'react';
import { useConvex, useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';
import { errText } from '../lib/errors';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { LOT_PREFIX, printLabels } from '../lib/labelPrint';

type Order = Doc<'reagent_cart'> & { outstanding: number };
type Item = Doc<'inventory'>;

/** What the person is receiving: an open order, a stock item, or something new. */
type Target =
  | { kind: 'order'; order: Order }
  | { kind: 'item'; item: Item }
  | { kind: 'new'; code: string };

const day = (ms?: number) => (ms ? new Date(ms).toLocaleDateString() : '—');
const daysLeft = (ms: number) => Math.ceil((ms - Date.now()) / 86_400_000);
/** "2027-03-31" -> end of that day, local time. */
const endOfDay = (s: string) => new Date(`${s}T23:59:59`).getTime();

export default function ReceivingPage() {
  const { token } = useAuth();
  const convex = useConvex();
  const receive = useMutation(api.receiving.receive);
  const orders = useQuery(api.receiving.pending, token ? { token } : 'skip') as Order[] | undefined;
  const expiring = useQuery(api.receiving.lots, token ? { token, within_days: 90 } : 'skip');
  const recent = useQuery(api.receiving.recent, token ? { token } : 'skip');

  const scanRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [choices, setChoices] = useState<Target[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [lot, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  const [qty, setQty] = useState('1');
  const [location, setLocation] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastLot, setLastLot] = useState<{ id: string; title: string; sub: string } | null>(null);

  const pick = (t: Target) => {
    setTarget(t);
    setChoices([]);
    setLot('');
    setExpiry('');
    setLocation(t.kind === 'item' ? t.item.location ?? '' : '');
    setName(t.kind === 'new' ? '' : '');
    setQty(String(t.kind === 'order' ? Math.max(1, t.order.outstanding) : 1));
  };

  // Coming from "Receive" on a cart request: open that order straight away.
  useEffect(() => {
    const id = sessionStorage.getItem('labos_receive_order');
    if (!id || !orders) return;
    sessionStorage.removeItem('labos_receive_order');
    const order = orders.find((o) => o._id === id);
    if (order) pick({ kind: 'order', order });
    else toast('That order is not waiting to be received any more.', { icon: 'ℹ️' });
  }, [orders]);

  const find = async (raw: string) => {
    const value = raw.trim();
    if (!value || !token) return;
    try {
      const res = await convex.query(api.receiving.lookup, { token, code: value });
      const found: Target[] = [
        ...res.orders.map((order) => ({ kind: 'order' as const, order: order as Order })),
        ...res.items.map((item) => ({ kind: 'item' as const, item })),
      ];
      if (found.length === 1) pick(found[0]);
      else if (found.length > 1) { setTarget(null); setChoices(found); }
      else { toast('No open order or stock item has that code. Receive it as a new item.', { icon: 'ℹ️' }); pick({ kind: 'new', code: value }); }
    } catch (e) { toast.error(errText(e)); }
  };

  const reset = () => {
    setTarget(null); setChoices([]); setCode(''); setLot(''); setExpiry(''); setQty('1'); setLocation(''); setName('');
    scanRef.current?.focus(); // ready for the next package
  };

  const submit = async () => {
    if (!target || !token) return;
    setBusy(true);
    try {
      const res = await receive({
        token,
        cart_item_id: target.kind === 'order' ? (target.order._id as Id<'reagent_cart'>) : undefined,
        inventory_id: target.kind === 'item' ? (target.item._id as Id<'inventory'>) : undefined,
        name: target.kind === 'new' ? name.trim() || undefined : undefined,
        catalog_number: target.kind === 'new' ? target.code : undefined,
        lot_number: lot,
        expiry_date: expiry ? endOfDay(expiry) : undefined,
        quantity: Number(qty),
        location: location.trim() || undefined,
      });
      setLastLot({ id: res.lot_id, title: label, sub: `Lot ${lot.trim()}${expiry ? ` · exp ${new Date(endOfDay(expiry)).toLocaleDateString()}` : ''}` });
      toast.success(`Received. Stock is now ${res.new_quantity}.${res.order_done ? ' Order complete.' : ''}`);
      reset();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const label = target?.kind === 'order' ? target.order.name : target?.kind === 'item' ? target.item.name : 'New item';
  const field: React.CSSProperties = { width: '100%' };
  const ready = !!target && lot.trim() !== '' && Number(qty) > 0 && (target.kind !== 'new' || name.trim() !== '');

  return (
    <div className="page">
      <h1 style={{ fontSize: 24, margin: 0 }}>Receiving</h1>
      <p style={{ color: 'var(--text-muted)', margin: '4px 0 16px', fontSize: 14 }}>
        Scan a package, enter its lot number and expiry date, and it goes into stock. Every lot is traceable.
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <label htmlFor="rcv-scan" style={{ fontSize: 13, fontWeight: 600 }}>Scan or type a catalog number / barcode</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <input id="rcv-scan" ref={scanRef} className="form-input" style={{ flex: 1, minWidth: 220 }} autoFocus value={code}
            onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); find(code); } }}
            placeholder="A USB barcode scanner types here and presses Enter" />
          <button className="btn btn-primary" onClick={() => find(code)} disabled={!code.trim()}>Find</button>
          <button className="btn btn-secondary" onClick={() => setScannerOpen(true)}>📷 Camera</button>
        </div>

        {choices.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>More than one match. Pick one:</div>
            {choices.map((t, i) => (
              <button key={i} className="btn btn-secondary btn-sm" style={{ display: 'block', marginBottom: 6 }} onClick={() => pick(t)}>
                {t.kind === 'order' ? `Order: ${t.order.name} (${t.order.outstanding} outstanding)` : t.kind === 'item' ? `Stock: ${t.item.name}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {lastLot && !target && (
        <div className="card" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>✅ Received <strong>{lastLot.title}</strong> ({lastLot.sub})</span>
          <button className="btn btn-secondary btn-sm" onClick={() => { if (!printLabels([{ title: lastLot.title, sub: lastLot.sub, code: `${LOT_PREFIX}${lastLot.id}` }])) toast.error('Allow pop-ups to print labels.'); }}>🖨️ Print lot label</button>
          <button className="btn btn-sm btn-secondary" onClick={() => setLastLot(null)}>Dismiss</button>
        </div>
      )}

      {target && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }} role="region" aria-label="Receive">
          <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>
            {label}
            {target.kind === 'order' && <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-muted)' }}> · ordered {target.order.quantity}{target.order.unit ? ` ${target.order.unit}` : ''}, {target.order.outstanding} outstanding</span>}
            {target.kind === 'item' && <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-muted)' }}> · in stock {target.item.quantity}{target.item.unit ? ` ${target.item.unit}` : ''}</span>}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {target.kind === 'new' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="rcv-name" style={{ fontSize: 13, fontWeight: 600 }}>Item name *</label>
                <input id="rcv-name" className="form-input" style={field} value={name} onChange={(e) => setName(e.target.value)} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Catalog number: {target.code}</div>
              </div>
            )}
            <div>
              <label htmlFor="rcv-lot" style={{ fontSize: 13, fontWeight: 600 }}>Lot number *</label>
              <input id="rcv-lot" className="form-input" style={field} value={lot} onChange={(e) => setLot(e.target.value)} autoFocus />
            </div>
            <div>
              <label htmlFor="rcv-exp" style={{ fontSize: 13, fontWeight: 600 }}>Expiry date</label>
              <input id="rcv-exp" className="form-input" style={field} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rcv-qty" style={{ fontSize: 13, fontWeight: 600 }}>Quantity received *</label>
              <input id="rcv-qty" className="form-input" style={field} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rcv-loc" style={{ fontSize: 13, fontWeight: 600 }}>Stored at</label>
              <input id="rcv-loc" className="form-input" style={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Freezer, shelf, box" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-secondary" onClick={reset}>Cancel</button>
            <button className="btn btn-primary" disabled={!ready || busy} onClick={submit}>{busy ? 'Saving…' : 'Receive into stock'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <section className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Waiting to be received</h2>
          {orders === undefined ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : orders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nothing on order. Items you check out from the Reagent Cart show up here.</p>
          ) : orders.map((o) => (
            <button key={o._id} className="btn btn-secondary btn-sm" style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6 }} onClick={() => pick({ kind: 'order', order: o })}>
              {o.name} · {o.outstanding} of {o.quantity}{o.catalog_number ? ` · #${o.catalog_number}` : ''}
            </button>
          ))}
        </section>

        <section className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Expiring in 90 days</h2>
          {expiring === undefined ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : expiring.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No lots expire soon.</p>
          ) : expiring.map((l) => (
            <div key={l._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 14 }}>
              <span>{l.item_name} · lot {l.lot_number} · {l.quantity_remaining} left</span>
              <strong style={{ color: daysLeft(l.expiry_date!) <= 30 ? 'var(--bad-text)' : 'var(--warn-text)', whiteSpace: 'nowrap' }}>{day(l.expiry_date)} ({daysLeft(l.expiry_date!)} d)</strong>
            </div>
          ))}
        </section>

        <section className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Recently received</h2>
          {recent === undefined ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : recent.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No deliveries recorded yet.</p>
          ) : recent.map((l) => (
            <div key={l._id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 14 }}>
              {l.item_name} · lot {l.lot_number} · {l.quantity_received}{l.unit ? ` ${l.unit}` : ''}
              <span style={{ color: 'var(--text-muted)' }}> · expires {day(l.expiry_date)} · {day(l.received_at)}</span>
            </div>
          ))}
        </section>
      </div>

      <BarcodeScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={(value) => { setScannerOpen(false); setCode(value); find(value); }} />
    </div>
  );
}
