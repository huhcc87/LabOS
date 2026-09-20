import React from 'react'
import type { SourceType } from '../types/protocol.types'
import type { useProtocolImport } from '../hooks/useProtocolImport'

type ImportHook = ReturnType<typeof useProtocolImport>

const SOURCES: { id: SourceType; label: string; icon: string; color: string }[] = [
  { id: 'pubmed', label: 'PubMed', icon: '🔬', color: '#1e3a5f' },
  { id: 'europe_pmc', label: 'Europe PMC', icon: '🔬', color: '#1e3a8a' },
  { id: 'crossref', label: 'Crossref', icon: '🔗', color: '#78350f' },
  { id: 'protocols_io', label: 'protocols.io', icon: '📋', color: '#7c2d12' },
  { id: 'bio_protocol', label: 'Bio-protocol', icon: '🧪', color: '#064e3b' },
  { id: 'jove', label: 'JoVE', icon: '🎬', color: '#7f1d1d' },
]

interface Props { hook: ImportHook }

export default function ProtocolImportModal({ hook: h }: Props) {
  if (!h.isOpen) return null
  return (
    <>
      <div onClick={() => { h.setIsOpen(false); h.reset() }} style={{ position: 'fixed', inset: 0, background: '#00000088', zIndex: 200 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 12, width: 'min(720px, 95vw)',
        maxHeight: '85vh', overflowY: 'auto', zIndex: 201, boxShadow: '0 24px 64px #00000099',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #2a2d3e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: 17 }}>📥 Import Published Protocol</h2>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>Search external databases and import into your review queue</p>
          </div>
          <button onClick={() => { h.setIsOpen(false); h.reset() }} style={{ background: '#242838', border: '1px solid #2a2d3e', borderRadius: 6, color: '#94a3b8', padding: '6px 10px', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          {/* Source selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 8 }}>Select sources to search:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SOURCES.map(src => (
                <button key={src.id} onClick={() => h.toggleSource(src.id)}
                  style={{
                    background: h.selectedSources.includes(src.id) ? src.color : '#1a1d27',
                    border: `1px solid ${h.selectedSources.includes(src.id) ? '#6366f1' : '#2a2d3e'}`,
                    borderRadius: 6, color: '#e2e8f0', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  }}>
                  {src.icon} {src.label}
                </button>
              ))}
            </div>
          </div>
          {/* Search */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={h.query} onChange={e => h.setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && h.search()}
              placeholder="e.g. PBMC isolation Ficoll, CRISPR knock-in, organoid culture..."
              style={{ flex: 1, background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', fontSize: 13, outline: 'none' }} />
            <button onClick={h.search} disabled={h.isSearching || !h.query.trim()}
              style={{ background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: h.isSearching ? 0.6 : 1 }}>
              {h.isSearching ? '⏳ Searching...' : '🔍 Search'}
            </button>
          </div>
          {h.error && <div style={{ background: '#7f1d1d22', border: '1px solid #ef4444', borderRadius: 6, color: '#ef4444', padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{h.error}</div>}
          {/* Results */}
          {h.results.length > 0 && (
            <>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>{h.results.length} result{h.results.length > 1 ? 's' : ''} found — select to import</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                {h.results.map(r => (
                  <div key={r.externalId} onClick={() => !r.alreadyImported && h.toggleResult(r.externalId)}
                    style={{
                      background: h.selected.has(r.externalId) ? '#6366f122' : '#1a1d27',
                      border: `1px solid ${h.selected.has(r.externalId) ? '#6366f1' : r.alreadyImported ? '#374151' : '#2a2d3e'}`,
                      borderRadius: 8, padding: 14, cursor: r.alreadyImported ? 'not-allowed' : 'pointer', opacity: r.alreadyImported ? 0.5 : 1,
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500, flex: 1 }}>{r.title}</div>
                      {r.alreadyImported && <span style={{ background: '#10b98122', color: '#10b981', fontSize: 10, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>Already imported</span>}
                      {!r.alreadyImported && <input type="checkbox" checked={h.selected.has(r.externalId)} readOnly style={{ accentColor: '#6366f1' }} />}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>{r.authors.slice(0, 3).join(', ')}{r.authors.length > 3 ? ' et al.' : ''}{r.journal ? ` · ${r.journal}` : ''}{r.year ? ` · ${r.year}` : ''}</div>
                    <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 8px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.abstract}</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {r.doi && <span style={{ color: '#6366f1', fontSize: 11 }}>DOI: {r.doi}</span>}
                      {r.pmid && <span style={{ color: '#3b82f6', fontSize: 11 }}>PMID: {r.pmid}</span>}
                      {r.openAccess && <span style={{ color: '#10b981', fontSize: 11 }}>🔓 Open Access</span>}
                      <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#94a3b8', fontSize: 11, textDecoration: 'none' }}>🔗 {r.sourceName}</a>
                    </div>
                  </div>
                ))}
              </div>
              {h.selected.size > 0 && (
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={h.reset} style={{ background: '#242838', border: '1px solid #2a2d3e', borderRadius: 6, color: '#94a3b8', padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>Clear</button>
                  <button onClick={h.doImport} disabled={h.isImporting}
                    style={{ background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    {h.isImporting ? 'Importing...' : `Import ${h.selected.size} protocol${h.selected.size > 1 ? 's' : ''} for review`}
                  </button>
                </div>
              )}
            </>
          )}
          {!h.isSearching && h.results.length === 0 && h.query && !h.error && (
            <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 32 }}>No results found. Try different keywords or select more sources.</div>
          )}
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#242838', borderRadius: 6, color: '#64748b', fontSize: 11, lineHeight: 1.5 }}>
            ℹ️ Imported protocols are saved as "Under Review" and must be approved before use. Citation metadata and outbound links are preserved. Full text is only stored for open-access publications.
          </div>
        </div>
      </div>
    </>
  )
}
