import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useNavigate } from '../context/NavigationContext';

const TOKEN_KEY = 'labos_auth_token';
const getToken = () => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY) ?? undefined;

/**
 * Products that LabOS users in any lab captured from vendor sites with the browser extension.
 * One click puts one in my lab's Reagent Cart; my lab's approval and budget rules apply as usual.
 */
export default function CommunityCatalog() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const t = setTimeout(() => setTerm(q), 250); return () => clearTimeout(t); }, [q]);
  const rows = useQuery(api.community.search, { token: getToken(), q: term });
  const add = useMutation(api.community.addToCart);
  const [busy, setBusy] = useState<string | null>(null);

  const addOne = async (id: string, name: string) => {
    setBusy(id);
    try {
      await add({ token: getToken(), id: id as Id<'community_reagents'>, quantity: 1 });
      toast.success((t) => (
        <span>Added “{name.slice(0, 40)}” to your Reagent Cart.{' '}
          <button onClick={() => { toast.dismiss(t.id); navigate('reagent-cart'); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}>Open cart</button>
        </span>
      ));
    } catch (e) {
      toast.error(String((e as { data?: string; message?: string })?.data ?? (e as Error).message ?? 'Could not add it').replace(/^.*Uncaught ConvexError:\s*/, '').slice(0, 160));
    } finally { setBusy(null); }
  };

  return (
    <section aria-label="LabOS community catalog" className="card" style={{ maxWidth: 1000, margin: '0 auto 28px', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>LabOS community catalog</h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reagents captured by LabOS users with the browser extension. Prices are on the vendor's site.</span>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the community catalog" placeholder="Search by name, vendor, catalog # or CAS"
        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, marginBottom: 12 }} />
      {rows === undefined && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</p>}
      {rows && rows.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          {term ? 'Nothing matches yet.' : 'Nothing captured yet.'} Install the LabOS Reagent Capture extension and click the LabOS button on a vendor's product page: it lands in your cart and here for everyone.
        </p>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {rows?.map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
            {r.image_url
              ? <img src={r.image_url} alt="" width={44} height={44} loading="lazy" referrerPolicy="no-referrer" style={{ objectFit: 'contain', borderRadius: 6, background: '#fff', flex: 'none' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              : <span aria-hidden style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--surface2)', display: 'grid', placeItems: 'center', flex: 'none' }}>🧪</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {r.vendor && <span>{r.vendor}</span>}
                {r.catalog_number && <span>#{r.catalog_number}</span>}
                {r.size && <span>{r.size}</span>}
                {r.cas && <span>CAS {r.cas}</span>}
                <span>· added {r.times_added}×</span>
              </div>
            </div>
            {r.url && /^https?:\/\//.test(r.url) && <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: 12 }}>Vendor page</a>}
            <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={busy === r.id} onClick={() => { void addOne(r.id, r.name); }}>{busy === r.id ? 'Adding…' : 'Add to cart'}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
