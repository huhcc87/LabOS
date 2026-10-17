import { useEffect, useState } from 'react';
import { reagentCartApi } from '../../lib/api';

const box: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 3 };

export interface RequestInput {
  name: string; vendor: string; catalog: string; size: string; quantity: number; unit_price?: number; url: string;
  project: string; grant: string; budget_code: string; urgency: 'normal' | 'urgent'; needed_by?: number; notes: string;
}

/** A new reagent request with the details an approver needs: what, how much, who pays, how urgent. */
export function RequestForm({ autoLimit, onSubmit, onCancel }: { autoLimit: number; onSubmit: (r: RequestInput) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState({ name: '', vendor: '', catalog: '', size: '', quantity: '1', price: '', url: '', project: '', grant: '', budget_code: '', urgency: 'normal', needed: '', notes: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const qty = Number(f.quantity);
  const price = f.price === '' ? undefined : Number(f.price);
  const total = (price ?? 0) * (Number.isFinite(qty) ? qty : 0);

  const save = async () => {
    if (!f.name.trim()) return setErr('Item name is required.');
    if (!(qty > 0)) return setErr('Quantity must be more than 0.');
    if (price !== undefined && !(price >= 0)) return setErr('Price cannot be negative.');
    if (f.url && !/^https?:\/\//i.test(f.url)) return setErr('Link must start with http:// or https://');
    setBusy(true);
    try {
      await onSubmit({
        name: f.name.trim(), vendor: f.vendor.trim(), catalog: f.catalog.trim(), size: f.size.trim(), quantity: qty, unit_price: price, url: f.url.trim(),
        project: f.project.trim(), grant: f.grant.trim(), budget_code: f.budget_code.trim(), urgency: f.urgency as 'normal' | 'urgent',
        needed_by: f.needed ? new Date(`${f.needed}T23:59:59`).getTime() : undefined, notes: f.notes.trim(),
      });
    } catch (e: any) { setErr(e?.data ?? e?.message ?? 'Could not save the request.'); } finally { setBusy(false); }
  };

  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 };
  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }} role="region" aria-label="New request">
      <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>New request</h2>
      <div style={grid}>
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl} htmlFor="rq-name">Item *</label><input id="rq-name" style={box} value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></div>
        <div><label style={lbl} htmlFor="rq-vendor">Supplier</label><input id="rq-vendor" style={box} value={f.vendor} onChange={(e) => set('vendor', e.target.value)} /></div>
        <div><label style={lbl} htmlFor="rq-cat">Catalog #</label><input id="rq-cat" style={box} value={f.catalog} onChange={(e) => set('catalog', e.target.value)} /></div>
        <div><label style={lbl} htmlFor="rq-size">Size / pack</label><input id="rq-size" style={box} value={f.size} onChange={(e) => set('size', e.target.value)} placeholder="500 mL" /></div>
        <div><label style={lbl} htmlFor="rq-qty">Quantity *</label><input id="rq-qty" style={box} type="number" min={1} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
        <div><label style={lbl} htmlFor="rq-price">Unit price ($)</label><input id="rq-price" style={box} type="number" min={0} step="0.01" value={f.price} onChange={(e) => set('price', e.target.value)} /></div>
        <div><label style={lbl} htmlFor="rq-proj">Project</label><input id="rq-proj" style={box} value={f.project} onChange={(e) => set('project', e.target.value)} /></div>
        <div><label style={lbl} htmlFor="rq-grant">Grant</label><input id="rq-grant" style={box} value={f.grant} onChange={(e) => set('grant', e.target.value)} /></div>
        <div><label style={lbl} htmlFor="rq-code">Budget code</label><input id="rq-code" style={box} value={f.budget_code} onChange={(e) => set('budget_code', e.target.value)} /></div>
        <div><label style={lbl} htmlFor="rq-urg">Urgency</label>
          <select id="rq-urg" style={box} value={f.urgency} onChange={(e) => set('urgency', e.target.value)}><option value="normal">Normal</option><option value="urgent">Urgent</option></select></div>
        <div><label style={lbl} htmlFor="rq-need">Needed by</label><input id="rq-need" style={box} type="date" value={f.needed} onChange={(e) => set('needed', e.target.value)} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl} htmlFor="rq-url">Product link</label><input id="rq-url" style={box} value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={lbl} htmlFor="rq-notes">Notes for the approver</label><input id="rq-notes" style={box} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
        Total ${total.toFixed(2)}.{' '}
        {autoLimit > 0 ? (price !== undefined && total <= autoLimit ? `At or under $${autoLimit}: approved automatically.` : `Over $${autoLimit} or no price: goes to a manager for approval.`) : 'A manager approves it before it is ordered.'}
      </div>
      {err && <div style={{ color: 'var(--bad-text, #dc2626)', fontSize: 13, marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Submit request'}</button>
      </div>
    </div>
  );
}

interface SpendRow { name: string; committed: number; received: number; count: number }
interface Spend { by_project: SpendRow[]; by_grant: SpendRow[]; by_person: SpendRow[]; last_30_days: number }

/** Where the money goes: by project, grant and person. Managers only. */
export function SpendPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Spend | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { reagentCartApi.spend().then((r) => setData(r.data as Spend)).catch((e) => setErr(e?.data ?? 'Could not load spend.')); }, []);
  const money = (n: number) => `$${n.toFixed(2)}`;
  const table = (title: string, rows: SpendRow[]) => (
    <div style={{ flex: 1, minWidth: 260 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>{title}</h3>
      {rows.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No approved or ordered requests yet.</div> : rows.map((r) => (
        <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
          <span>{r.name} <span style={{ color: 'var(--text-muted)' }}>({r.count})</span></span>
          <span><strong>{money(r.committed + r.received)}</strong> <span style={{ color: 'var(--text-muted)' }}>· {money(r.received)} received</span></span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }} role="region" aria-label="Spend">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Spend {data && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 13 }}>· last 30 days {money(data.last_30_days)}</span>}</h2>
        <button className="btn btn-sm btn-secondary" onClick={onClose}>Close</button>
      </div>
      {err ? <div style={{ color: 'var(--bad-text, #dc2626)' }}>{err}</div> : !data ? <div style={{ color: 'var(--text-muted)' }}>Loading…</div> : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {table('By project', data.by_project)}{table('By grant', data.by_grant)}{table('By person', data.by_person)}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Counts approved, ordered and received requests with a price. Requests without a price count as $0.</div>
    </div>
  );
}
