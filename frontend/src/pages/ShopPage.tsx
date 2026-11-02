import { useMemo, useState } from 'react';
import { useNavigate } from '../context/NavigationContext';
import { BIOMEDICAL_SUPPLIERS, SUPPLIER_CATEGORIES } from '../data/biomedicalSuppliers';
import LabBanner from '../components/LabBanner';
import EmojiIcon from '../components/EmojiIcon';

/** One glyph per category tile; unknown categories fall back to a neutral icon. */
const GLYPH: Record<string, string> = {
  'Chemicals & Reagents': '🧪', 'Antibodies': '🧬', 'Molecular Biology': '🧬', 'Cell Culture': '🧫', 'Proteomics': '🔬',
  'Genomics': '🧬', 'Imaging': '📷', 'Flow Cytometry': '📊', 'Immunoassay': '💧', 'Safety': '🛡', 'Instruments': '🔭',
  'Animal Models': '🐭', 'Histology': '🔬', 'Small Molecules': '⚗️', 'Viral Vectors': '🦠', 'Sequencing Services': '💻',
  'Bioprocessing': '🏭', 'Spatial Biology': '🗺', 'Biospecimens': '🧊', 'CRO Services': '💼', 'Consumables': '📦',
  'Lab Software': '💻', 'Microfluidics': '💧',
};

/**
 * Start page for buying: search for a product, or browse vendors by what they sell.
 * LabOS does not sell anything itself, so the tiles count vendors from the directory, not products.
 */
export default function ShopPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const tiles = useMemo(() => SUPPLIER_CATEGORIES.filter((c) => c !== 'All').map((c) => ({
    name: c,
    count: BIOMEDICAL_SUPPLIERS.filter((s) => s.category === c).length,
  })).filter((t) => t.count > 0).sort((a, b) => b.count - a.count), []);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    sessionStorage.setItem('labos_chem_prefill', q.trim());
    navigate('chemical-search');
  };
  const browse = (category: string) => { sessionStorage.setItem('labos_vendor_category', category); navigate('supplier-directory'); };

  return (
    <div>
      <LabBanner art="inventory" title="Shop" subtitle="Find a product in your stock, check it against your restricted list, and jump to the vendors that sell it." />

      <form onSubmit={go} role="search" style={{ display: 'flex', gap: 8, maxWidth: 720, margin: '0 auto 8px' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" placeholder="Product name, manufacturer, or CAS #"
          style={{ flex: 1, padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15 }} />
        <button className="btn btn-primary" type="submit" disabled={!q.trim()}>Search</button>
      </form>
      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', margin: '0 0 28px' }}>
        Looking for something specific? Use the <button onClick={() => navigate('requests')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 12 }}>Requests</button> page to ask for it.
      </p>

      <h2 style={{ textAlign: 'center', fontSize: 18, margin: '0 0 14px' }}>Browse vendors by category</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12, maxWidth: 1000, margin: '0 auto' }}>
        {tiles.map((t) => (
          <button key={t.name} onClick={() => browse(t.name)} className="card"
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
            <span style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 20, flex: 'none' }}>
              <EmojiIcon glyph={GLYPH[t.name] ?? '📦'} />
            </span>
            <span>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{t.name}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{t.count} vendor{t.count === 1 ? '' : 's'}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
