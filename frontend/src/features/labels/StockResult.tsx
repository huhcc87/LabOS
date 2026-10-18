import { useEffect, useState } from 'react';
import { useConvex, useMutation } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../../convex/_generated/api';
import type { Doc } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from '../../context/NavigationContext';
import { errText } from '../../lib/errors';
import { LOT_PREFIX, printLabels } from '../../lib/labelPrint';

type Lot = Doc<'inventory_lots'> & { item_name: string };
export type StockHits = {
  orders: Array<Doc<'reagent_cart'> & { outstanding: number }>;
  items: Doc<'inventory'>[];
  lots: Lot[];
};

const day = (ms?: number) => (ms ? new Date(ms).toLocaleDateString() : '—');

/** What a scanned code means for stock: a lot (take from stock, print label), an item, or an open order. */
export function StockResult({ code, hits, onChanged }: { code: string; hits: StockHits; onChanged: () => void }) {
  const { token } = useAuth();
  const convex = useConvex();
  const navigate = useNavigate();
  const consume = useMutation(api.receiving.consume);
  const [used, setUsed] = useState<Record<string, string>>({});
  const [itemLots, setItemLots] = useState<Lot[]>([]);
  const [tick, setTick] = useState(0);

  // For an item code, also list its lots so one can be picked.
  useEffect(() => {
    let live = true;
    if (!token || !hits.items.length || hits.lots.length) { setItemLots([]); return; }
    Promise.all(hits.items.map((i) => convex.query(api.receiving.lots, { token, inventory_id: i._id }))).then((r) => { if (live) setItemLots(r.flat() as Lot[]); });
    return () => { live = false; };
  }, [convex, token, hits, tick]);

  const lots = hits.lots.length ? hits.lots : itemLots;

  const use = async (lot: Lot) => {
    const qty = Number(used[lot._id] ?? '1');
    try {
      const r = await consume({ token: token ?? undefined, lot_id: lot._id, quantity: qty });
      toast.success(`Used ${qty}. ${r.lot_remaining} left in lot ${lot.lot_number}.`);
      setUsed({ ...used, [lot._id]: '1' });
      setTick((n) => n + 1);
      onChanged();
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

  return (
    <div aria-label={`Stock for ${code}`}>
      {lots.map((lot) => (
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
      {hits.items.map((item) => (
        <div key={item._id} className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>{item.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· in stock {item.quantity}{item.unit ? ` ${item.unit}` : ''}</span></div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 10px' }}>{[item.catalog_number && `#${item.catalog_number}`, item.location, item.expiry_date && `soonest expiry ${day(item.expiry_date)}`].filter(Boolean).join(' · ')}</div>
          <button className="btn btn-secondary btn-sm" onClick={() => printItem(item)}>🖨️ Print item label</button>
        </div>
      ))}
      {hits.orders.map((o) => (
        <div key={o._id} className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>{o.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· on order, {o.outstanding} outstanding</span></div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => { sessionStorage.setItem('labos_receive_order', o._id); navigate('receiving'); }}>Receive this order</button>
        </div>
      ))}
    </div>
  );
}
