import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL as API } from '../lib/api';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
});

interface Reference {
  id: number;
  pmid: string;
  doi: string;
  title: string;
  authors: string[];
  journal: string;
  year: number | null;
  volume: string;
  issue: string;
  pages: string;
  abstract: string;
  tags: string[];
  folder: string;
  is_favorite: boolean;
  notes: string;
  citations: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_FOLDERS = ['All', 'CAR-T Project', 'Microbiome Project', 'Gene Therapy', 'Computational', 'Unfiled'];

const EMPTY_FORM = {
  title: '', pmid: '', doi: '', authors: '', journal: '',
  year: '', volume: '', pages: '', abstract: '', tags: '', folder: 'Unfiled', notes: '',
};

export default function ReferenceManagerPage() {
  const [references, setReferences] = useState<Reference[]>([]);
  const [folders, setFolders] = useState<string[]>(DEFAULT_FOLDERS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('All');
  const [selectedRef, setSelectedRef] = useState<Reference | null>(null);
  const [showPubMedSearch, setShowPubMedSearch] = useState(false);
  const [pubmedQuery, setPubmedQuery] = useState('');
  const [pubmedResults, setPubmedResults] = useState<any[]>([]);
  const [searchingPubmed, setSearchingPubmed] = useState(false);
  const [sortBy, setSortBy] = useState<'created_at' | 'year' | 'citations'>('created_at');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ per_page: '200' });
    if (folder !== 'All') params.set('folder', folder);
    if (search) params.set('search', search);
    const [r1, r2] = await Promise.all([
      fetch(`${API}/references?${params}`, { headers: authHeaders() }),
      fetch(`${API}/references/folders/list`, { headers: authHeaders() }),
    ]);
    if (r1.ok) setReferences((await r1.json()).items ?? []);
    if (r2.ok) {
      const data = await r2.json();
      const combined = Array.from(new Set(['All', ...DEFAULT_FOLDERS.slice(1), ...data.folders]));
      setFolders(combined);
    }
    setLoading(false);
  }, [folder, search]);

  useEffect(() => {
    const t = setTimeout(() => load(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load]);

  const toggleFavorite = async (ref: Reference) => {
    const res = await fetch(`${API}/references/${ref.id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ is_favorite: !ref.is_favorite }),
    });
    if (res.ok) {
      const updated = await res.json();
      setReferences(rs => rs.map(r => r.id === ref.id ? updated : r));
      if (selectedRef?.id === ref.id) setSelectedRef(updated);
    }
  };

  const deleteRef = async (id: number) => {
    if (!confirm('Remove this reference from your library?')) return;
    await fetch(`${API}/references/${id}`, { method: 'DELETE', headers: authHeaders() });
    setReferences(rs => rs.filter(r => r.id !== id));
    if (selectedRef?.id === id) setSelectedRef(null);
  };

  const addReference = async (data: typeof EMPTY_FORM) => {
    setSaving(true);
    const body = {
      title: data.title,
      pmid: data.pmid,
      doi: data.doi,
      authors: data.authors.split(',').map(a => a.trim()).filter(Boolean),
      journal: data.journal,
      year: data.year ? Number(data.year) : null,
      volume: data.volume,
      pages: data.pages,
      abstract: data.abstract,
      tags: data.tags.split(',').map(t => t.trim()).filter(Boolean),
      folder: data.folder || 'Unfiled',
      notes: data.notes,
    };
    const res = await fetch(`${API}/references`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
    });
    if (res.ok) { setShowAddForm(false); setForm({ ...EMPTY_FORM }); load(); }
    setSaving(false);
  };

  const addFromPubmed = async (result: any) => {
    const body = {
      title: result.title,
      pmid: result.pmid ?? '',
      authors: result.authors ?? [],
      journal: result.journal ?? '',
      year: result.year ?? null,
      folder: 'Unfiled',
    };
    const res = await fetch(`${API}/references`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
    });
    if (res.ok) { load(); }
  };

  const handlePubMedSearch = async () => {
    setSearchingPubmed(true);
    // Simulated PubMed results — replace with real PubMed E-utilities call if desired
    await new Promise(r => setTimeout(r, 900));
    setPubmedResults([
      { pmid: '36789012', title: 'Novel strategies for enhancing CAR-T cell persistence in solid tumors', authors: ['Wang Y', 'Chen L', 'Kim J'], journal: 'Cancer Research', year: 2024 },
      { pmid: '36789013', title: 'Metabolic reprogramming of CAR-T cells for improved anti-tumor activity', authors: ['Smith A', 'Brown B'], journal: 'Cell Metabolism', year: 2024 },
      { pmid: '36789014', title: 'Armored CAR-T cells: Engineering strategies for hostile tumor microenvironments', authors: ['Zhang R', 'Liu M', 'Park S'], journal: 'Molecular Therapy', year: 2024 },
    ]);
    setSearchingPubmed(false);
  };

  const sorted = [...references].sort((a, b) => {
    if (sortBy === 'year') return (b.year ?? 0) - (a.year ?? 0);
    if (sortBy === 'citations') return b.citations - a.citations;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const getCitationFormatted = (ref: Reference) =>
    `${ref.authors.slice(0, 3).join(', ')}${ref.authors.length > 3 ? ' et al.' : ''}. ${ref.title}. ${ref.journal}. ${ref.year ?? ''}${ref.volume ? `;${ref.volume}` : ''}${ref.pages ? `:${ref.pages}` : ''}.`;

  const stats = {
    total: references.length,
    favorites: references.filter(r => r.is_favorite).length,
    folders: new Set(references.map(r => r.folder)).size,
    thisMonth: references.filter(r => {
      const d = new Date(r.created_at);
      const n = new Date();
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    }).length,
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reference Manager</h1>
          <p className="page-subtitle">Organize citations, search PubMed, and manage your literature</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setShowPubMedSearch(true)}>🔍 Search PubMed</button>
          <button className="btn btn-primary" onClick={() => { setShowAddForm(true); setForm({ ...EMPTY_FORM }); }}>+ Add Reference</button>
        </div>
      </div>

      {/* Stats */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total References</span>
          <div className="metric-value">{stats.total}</div>
          <div className="metric-sub">In library</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="metric-label">Favorites</span>
          <div className="metric-value" style={{ color: '#f59e0b' }}>{stats.favorites}</div>
          <div className="metric-sub">Starred items</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#6366f1' }}>
          <span className="metric-label">Folders</span>
          <div className="metric-value" style={{ color: '#6366f1' }}>{stats.folders}</div>
          <div className="metric-sub">Organization</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#22c55e' }}>
          <span className="metric-label">Added This Month</span>
          <div className="metric-value" style={{ color: '#22c55e' }}>{stats.thisMonth}</div>
          <div className="metric-sub">Recent additions</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
        {/* Sidebar */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
            Folders
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {folders.map(f => (
              <button key={f} onClick={() => setFolder(f)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 8, border: 'none',
                background: folder === f ? 'var(--accent-light)' : 'transparent',
                color: folder === f ? 'var(--accent)' : 'var(--text-soft)',
                fontSize: 13, fontWeight: folder === f ? 600 : 400, cursor: 'pointer', textAlign: 'left',
              }}>
                <span>{f === 'All' ? '📚' : '📁'} {f}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {f === 'All' ? references.length : references.filter(r => r.folder === f).length}
                </span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
              Popular Tags
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Array.from(new Set(references.flatMap(r => r.tags))).slice(0, 8).map(tag => (
                <button key={tag} onClick={() => setSearch(tag)} style={{
                  padding: '4px 8px', borderRadius: 4, border: 'none',
                  background: 'var(--surface2)', color: 'var(--text-soft)', fontSize: 10, cursor: 'pointer',
                }}>{tag}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Main */}
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search by title, author, or tag…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ width: 160 }}>
              <option value="created_at">Date Added</option>
              <option value="year">Publication Year</option>
              <option value="citations">Citations</option>
            </select>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : sorted.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No references yet. Add one manually or search PubMed.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sorted.map(ref => (
                <div key={ref.id} className="card" onClick={() => setSelectedRef(ref)} style={{
                  cursor: 'pointer',
                  border: selectedRef?.id === ref.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  padding: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <button onClick={e => { e.stopPropagation(); toggleFavorite(ref); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                          {ref.is_favorite ? '⭐' : '☆'}
                        </button>
                        {ref.pmid && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>PMID: {ref.pmid}</span>}
                      </div>
                      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{ref.title}</h3>
                      <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 8 }}>
                        {ref.authors.slice(0, 3).join(', ')}{ref.authors.length > 3 ? ' et al.' : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                        <strong>{ref.journal}</strong>{ref.year ? ` (${ref.year})` : ''}{ref.volume ? ` ${ref.volume}` : ''}{ref.pages ? `:${ref.pages}` : ''}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {ref.tags.map(tag => (
                          <span key={tag} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, background: 'var(--accent-light)', color: 'var(--accent)' }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 16 }}>
                      {ref.citations > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{ref.citations}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>citations</div>
                        </div>
                      )}
                      <button onClick={e => { e.stopPropagation(); deleteRef(ref.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14 }} title="Remove">🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selectedRef && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setSelectedRef(null)}>
          <div className="card" style={{ width: 700, maxWidth: '90%', maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {selectedRef.pmid && <span style={{ padding: '4px 8px', borderRadius: 4, fontSize: 10, background: 'var(--surface2)' }}>PMID: {selectedRef.pmid}</span>}
                <span style={{ padding: '4px 8px', borderRadius: 4, fontSize: 10, background: 'var(--accent-light)', color: 'var(--accent)' }}>{selectedRef.folder}</span>
              </div>
              <button onClick={() => setSelectedRef(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, lineHeight: 1.4 }}>{selectedRef.title}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 8 }}>{selectedRef.authors.join(', ')}</div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>
              <strong>{selectedRef.journal}</strong>{selectedRef.year ? ` (${selectedRef.year})` : ''}{selectedRef.volume ? ` ${selectedRef.volume}` : ''}{selectedRef.pages ? `:${selectedRef.pages}` : ''}
            </div>

            {(selectedRef.citations > 0 || selectedRef.doi) && (
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                {selectedRef.citations > 0 && (
                  <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{selectedRef.citations}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Citations</div>
                  </div>
                )}
                {selectedRef.doi && (
                  <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8, flex: 1 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>DOI</div>
                    <a href={`https://doi.org/${selectedRef.doi}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>{selectedRef.doi}</a>
                  </div>
                )}
              </div>
            )}

            {selectedRef.abstract && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Abstract</div>
                <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.7 }}>{selectedRef.abstract}</p>
              </div>
            )}

            {selectedRef.tags.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedRef.tags.map(tag => (
                    <span key={tag} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: 'var(--accent-light)', color: 'var(--accent)' }}>{tag}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Formatted Citation</div>
              <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8, fontSize: 12, lineHeight: 1.6, fontFamily: 'serif' }}>
                {getCitationFormatted(selectedRef)}
              </div>
            </div>

            {selectedRef.notes && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Notes</div>
                <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.6 }}>{selectedRef.notes}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => navigator.clipboard?.writeText(getCitationFormatted(selectedRef))}>📋 Copy Citation</button>
              <button className="btn btn-secondary" onClick={() => toggleFavorite(selectedRef)}>
                {selectedRef.is_favorite ? '⭐ Unfavorite' : '☆ Favorite'}
              </button>
              <button className="btn btn-secondary" style={{ marginLeft: 'auto', color: '#ef4444' }} onClick={() => deleteRef(selectedRef.id)}>🗑 Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Reference modal */}
      {showAddForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowAddForm(false)}>
          <div className="card" style={{ width: 640, maxHeight: '90vh', overflow: 'auto', padding: 28 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Add Reference</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }} />
              </div>
              {[
                { key: 'pmid', label: 'PMID' }, { key: 'doi', label: 'DOI' },
                { key: 'journal', label: 'Journal' }, { key: 'year', label: 'Year', type: 'number' },
                { key: 'volume', label: 'Volume' }, { key: 'pages', label: 'Pages' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input type={type ?? 'text'} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }} />
                </div>
              ))}
              {[
                { key: 'authors', label: 'Authors (comma-separated)' },
                { key: 'tags', label: 'Tags (comma-separated)' },
              ].map(({ key, label }) => (
                <div key={key} style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Abstract</label>
                <textarea value={form.abstract} onChange={e => setForm(f => ({ ...f, abstract: e.target.value }))} rows={4}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Folder</label>
                <select value={form.folder} onChange={e => setForm(f => ({ ...f, folder: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }}>
                  {folders.filter(f => f !== 'All').map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowAddForm(false)}
                style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => addReference(form)} disabled={saving || !form.title}
                style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: saving || !form.title ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Add to Library'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PubMed Search modal */}
      {showPubMedSearch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowPubMedSearch(false)}>
          <div className="card" style={{ width: 700, maxWidth: '90%', maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>🔍 Search PubMed</h3>
              <button onClick={() => setShowPubMedSearch(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <input type="text" className="form-input" placeholder="Enter search terms…" value={pubmedQuery}
                onChange={e => setPubmedQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePubMedSearch()}
                style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={handlePubMedSearch} disabled={searchingPubmed}>
                {searchingPubmed ? '🔄 Searching…' : '🔍 Search'}
              </button>
            </div>
            {pubmedResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pubmedResults.map((result, i) => (
                  <div key={i} style={{ padding: 16, background: 'var(--surface2)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PMID: {result.pmid}</div>
                        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{result.title}</h4>
                        <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 4 }}>{result.authors.join(', ')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{result.journal} ({result.year})</div>
                      </div>
                      <button className="btn btn-sm btn-primary" onClick={() => addFromPubmed(result)}>+ Add</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
