import { useState, useMemo, useEffect } from 'react';
import { BIOMEDICAL_SUPPLIERS, SUPPLIER_CATEGORIES, type SupplierEntry } from '../data/biomedicalSuppliers';
import EmojiIcon from '../components/EmojiIcon';
import { VENDOR_LINKS } from '../data/vendorLinks';
import LabBanner from '../components/LabBanner';

const TAG_COLORS: Record<string, string> = {
  'Gold Standard': '#f59e0b',
  'Budget': '#22c55e',
  'Premium': '#8b5cf6',
  'Specialist': '#06b6d4',
  'Innovation': '#6366f1',
  'Non-profit': '#ec4899',
  'Value': '#10b981',
  'Popular': '#3b82f6',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 1 }}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  );
}

function SupplierCard({ s }: { s: SupplierEntry }) {
  const [expanded, setExpanded] = useState(false);
  const extra = VENDOR_LINKS[s.name];
  return (
    <div
      onClick={() => setExpanded(v => !v)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 18px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(99,102,241,0.12)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{s.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{[s.supplierType, s.country].filter(Boolean).join(' · ')}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {s.tag && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: `${TAG_COLORS[s.tag] || '#6366f1'}20`,
              color: TAG_COLORS[s.tag] || '#6366f1',
              border: `1px solid ${TAG_COLORS[s.tag] || '#6366f1'}50`,
            }}>{s.tag}</span>
          )}
          {s.rating != null && <StarRating rating={s.rating} />}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {s.specialty.slice(0, expanded ? undefined : 3).map((sp, i) => (
          <span key={sp + i} style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 12,
            background: 'var(--surface2)', color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}>{sp}</span>
        ))}
        {!expanded && s.specialty.length > 3 && (
          <span style={{ fontSize: 11, color: 'var(--accent)' }}>+{s.specialty.length - 3} more</span>
        )}
      </div>

      {expanded && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 10px' }}>
            {s.description}
          </p>
          {s.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>{s.notes}</p>}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[{ href: s.website, label: 'Visit website →' }, ...(s.catalogUrl && s.catalogUrl.replace(/\/$/, '') !== s.website.replace(/\/$/, '') ? [{ href: s.catalogUrl, label: 'Catalog →' }] : [])].map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {l.label}
              </a>
            ))}
          </div>
          {extra && (
            <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Product types</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {extra.types.map((t) => (
                  <a key={t.type} href={t.url} target="_blank" rel="noopener noreferrer"
                    title={t.direct ? 'Official product page' : 'Vendor catalog: search by product type'}
                    style={{ fontSize: 12, padding: '3px 9px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', textDecoration: 'none' }}>
                    {t.type}{t.offering === 'Limited' ? ' (limited)' : ''}{t.direct ? ' ↗' : ''}
                  </a>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                {extra.orderUrl && <a href={extra.orderUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Quote / order →</a>}
                {' '}Price and lead time not checked: request a quote and confirm stock before ordering.
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
        {s.category}
      </div>
    </div>
  );
}

export default function SupplierDirectoryPage() {
  const [search, setSearch] = useState('');
  // The Shop page can open this list already filtered to a category.
  // Read without removing: React runs state initializers twice in development, so removal happens in an effect.
  const [selectedCategory, setSelectedCategory] = useState(() => {
    try {
      const c = sessionStorage.getItem('labos_vendor_category');
      return c && (SUPPLIER_CATEGORIES as readonly string[]).includes(c) ? c : 'All';
    } catch { return 'All'; }
  });
  useEffect(() => { try { sessionStorage.removeItem('labos_vendor_category'); } catch { /* ignore */ } }, []);
  const [sortBy, setSortBy] = useState<'name' | 'rating'>('rating');

  const filtered = useMemo(() => {
    let list = BIOMEDICAL_SUPPLIERS;
    if (selectedCategory !== 'All') {
      list = list.filter(s => s.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.specialty.some(sp => sp.toLowerCase().includes(q)) ||
        s.description.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) =>
      sortBy === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)
    );
  }, [search, selectedCategory, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: BIOMEDICAL_SUPPLIERS.length };
    BIOMEDICAL_SUPPLIERS.forEach(s => {
      counts[s.category] = (counts[s.category] || 0) + 1;
    });
    return counts;
  }, []);

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <LabBanner art="inventory" title="Vendor Directory" subtitle={`${BIOMEDICAL_SUPPLIERS.length}+ suppliers for reagents, chemicals, antibodies, equipment, and more`} />

      {/* Search + Sort */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          placeholder="Search suppliers, specialties..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 240, fontSize: 14 }}
        />
        <select
          className="form-select"
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'name' | 'rating')}
          style={{ width: 160, fontSize: 14 }}
        >
          <option value="rating">Sort: Top Rated</option>
          <option value="name">Sort: A–Z</option>
        </select>
      </div>

      <div className="vendor-layout">
        {/* Category filter sidebar */}
        <div className="card" style={{ padding: 16, position: 'sticky', top: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Categories
          </div>
          {['All', ...SUPPLIER_CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                width: '100%', textAlign: 'left', background: selectedCategory === cat ? 'var(--accent)' : 'none',
                border: 'none', color: selectedCategory === cat ? '#fff' : 'var(--text)',
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                fontWeight: selectedCategory === cat ? 700 : 400,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 2, transition: 'background 0.15s',
              }}
            >
              <span>{cat}</span>
              <span style={{
                fontSize: 11, background: selectedCategory === cat ? 'rgba(255,255,255,0.25)' : 'var(--surface2)',
                borderRadius: 10, padding: '1px 7px', color: selectedCategory === cat ? '#fff' : 'var(--text-muted)',
              }}>
                {categoryCounts[cat] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Supplier grid */}
        <div>
          {filtered.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}><EmojiIcon glyph="🔍" /></div>
              <div style={{ fontWeight: 600 }}>No suppliers found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Try a different search or category</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                Showing {filtered.length} supplier{filtered.length !== 1 ? 's' : ''}
                {selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}
                {search ? ` matching "${search}"` : ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {filtered.map((s, i) => <SupplierCard key={s.name + i} s={s} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
