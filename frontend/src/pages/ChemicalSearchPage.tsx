import { useEffect, useState } from 'react';
import { inventoryApi, procurementApi } from '../lib/api';
import { useNavigate } from '../context/NavigationContext';
import { VENDOR_SEARCHES, vendorSearchUrl, isCasNumber } from '../data/vendorSearch';
import LabBanner from '../components/LabBanner';

interface StockRow { id: string; name: string; quantity: number; unit?: string; location?: string; supplier?: string; catalog_number?: string; hazards?: string; sds_url?: string }
interface Restricted { name: string; cas_number?: string; reason?: string }

/** Search a chemical by name or CAS number: what the lab already holds, any restriction on it, and where to buy it. */
export default function ChemicalSearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [stock, setStock] = useState<StockRow[]>([]);
  const [restricted, setRestricted] = useState<Restricted[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const cas = isCasNumber(term);
  const looksLikeCas = /^\d{2,7}-\d{2}-\d$/.test(term.trim());

  const search = (e: React.FormEvent) => { e.preventDefault(); void run(q); };

  // The Shop page can hand over a search term to run straight away.
  useEffect(() => {
    try {
      const t = sessionStorage.getItem('labos_chem_prefill');
      sessionStorage.removeItem('labos_chem_prefill');
      if (t) { setQ(t); void run(t); }
    } catch { /* storage unavailable: start empty */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setBusy(true); setErr(''); setTerm(t);
    try {
      const [inv, scan] = await Promise.all([
        inventoryApi.list(1, 20, t),
        procurementApi.scanChemical(t, isCasNumber(t) ? t : ''),
      ]);
      setStock(((inv.data as { items: StockRow[] }).items) ?? []);
      setRestricted(((scan.data as { matches: Restricted[] }).matches) ?? []);
    } catch (ex) {
      setErr((ex as { data?: string; message?: string })?.data ?? (ex as Error)?.message ?? 'Search failed.');
    } finally { setBusy(false); }
  };

  const request = () => {
    sessionStorage.setItem('labos_request_prefill', JSON.stringify({ name: term, notes: cas ? `CAS ${term}` : '' }));
    navigate('requests');
  };

  const field: React.CSSProperties = { padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, flex: 1, minWidth: 0 };
  const kinds = Array.from(new Set(VENDOR_SEARCHES.map((v) => v.kind)));

  return (
    <div>
      <LabBanner art="inventory" title="Chemical search" subtitle="Look up a chemical by name or CAS number: what you have in stock, whether it is restricted, and where to buy it." />

      <form onSubmit={search} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} style={field} aria-label="Chemical name or CAS number" placeholder="Product name, manufacturer, or CAS # (for example 67-56-1)" autoFocus />
        <button className="btn btn-primary" type="submit" disabled={busy || !q.trim()}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      {looksLikeCas && !cas && <p role="alert" style={{ color: '#b45309', fontSize: 13, margin: '4px 0 0' }}>That looks like a CAS number but the check digit does not match. Check for a typo.</p>}
      {err && <p role="alert" style={{ color: '#dc2626', fontSize: 13 }}>{err}</p>}

      {term && (
        <div style={{ marginTop: 18, display: 'grid', gap: 16 }}>
          {restricted.length > 0 && (
            <div className="card" role="alert" style={{ padding: 14, borderLeft: '4px solid #dc2626' }}>
              <strong>Restricted or regulated</strong>
              {restricted.map((r, i) => <div key={i} style={{ fontSize: 13, marginTop: 4 }}>{r.name}{r.cas_number ? ` (CAS ${r.cas_number})` : ''}{r.reason ? `: ${r.reason}` : ''}</div>)}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Requests for this chemical may need extra approval.</div>
            </div>
          )}

          <div className="card" style={{ padding: 16 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>In your inventory</h2>
            {stock.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>No stock matches “{term}”.</p>}
            {stock.map((s) => (
              <div key={s.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 13, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{[s.supplier, s.catalog_number && `Cat. ${s.catalog_number}`, s.location].filter(Boolean).join(' · ')}</div>
                  {s.hazards && <div style={{ fontSize: 12, color: '#b45309' }}>Hazards: {s.hazards}</div>}
                </div>
                <div style={{ whiteSpace: 'nowrap' }}>{s.quantity} {s.unit ?? ''}</div>
                {s.sds_url && /^https?:\/\//i.test(s.sds_url) && <a href={s.sds_url} target="_blank" rel="noopener noreferrer">SDS</a>}
              </div>
            ))}
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={request}>Request “{term}”</button>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Find it from vendors</h2>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>Each link opens that vendor's own search in a new tab. Prices and stock are shown on their site.</p>
            {kinds.map((k) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{k}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {VENDOR_SEARCHES.filter((v) => v.kind === k).map((v) => (
                    <a key={v.name} className="btn btn-secondary" href={vendorSearchUrl(v, term)} target="_blank" rel="noopener noreferrer">{v.name}</a>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn btn-secondary" onClick={() => navigate('supplier-directory')}>Browse all vendors</button>
          </div>
        </div>
      )}
    </div>
  );
}
