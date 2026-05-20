import { useState, useMemo } from 'react';
import { BIOMEDICAL_SUPPLIERS, SUPPLIER_CATEGORIES, type SupplierEntry } from '../data/biomedicalSuppliers';

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
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.country}</div>
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
          <StarRating rating={s.rating} />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {s.specialty.slice(0, expanded ? undefined : 3).map(sp => (
          <span key={sp} style={{
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
          <a
            href={s.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            Visit website →
          </a>
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
  const [selectedCategory, setSelectedCategory] = useState('All');
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
      sortBy === 'rating' ? b.rating - a.rating : a.name.localeCompare(b.name)
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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Biomedical Supplier Directory</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {BIOMEDICAL_SUPPLIERS.length}+ vetted suppliers for reagents, chemicals, antibodies, equipment, and more
        </p>
      </div>

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

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
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
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
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
                {filtered.map(s => <SupplierCard key={s.name} s={s} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
