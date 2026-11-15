import EmojiIcon from '../../../components/EmojiIcon';
import React, { useState } from 'react'
import { useProtocols } from '../hooks/useProtocols'
import { useProtocolImport } from '../hooks/useProtocolImport'
import { useProtocolGeneration } from '../hooks/useProtocolGeneration'
import ProtocolCategoryCards from '../components/ProtocolCategoryCards'
import SubcategoryBrowser from '../components/SubcategoryBrowser'
import ProtocolSearch from '../components/ProtocolSearch'
import ProtocolFiltersBar from '../components/ProtocolFilters'
import ProtocolTable from '../components/ProtocolTable'
import ProtocolCardGrid from '../components/ProtocolCardGrid'
import ProtocolDetailDrawer from '../components/ProtocolDetailDrawer'
import ProtocolImportModal from '../components/ProtocolImportModal'
import ProtocolGenerateModal from '../components/ProtocolGenerateModal'
import ProtocolEditor from '../components/ProtocolEditor'
import ProtocolAIHelper from '../components/ProtocolAIHelper'
import type { Protocol } from '../types/protocol.types'
import { PROTOCOL_CATEGORIES } from '../data/categories'
import { useSwarm, SwarmDashboard } from '../ai-swarm'
import ExternalLibrary from '../ExternalLibrary'

type MainTab = 'library' | 'external' | 'editor' | 'ai'


export default function ProtocolsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const store = useProtocols()
  const importHook = useProtocolImport(store.addProtocol)
  const genHook = useProtocolGeneration(store.addProtocol)
  const swarm = useSwarm()
  const [activeSubcategory, setActiveSubcategory] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [mainTab, setMainTab] = useState<MainTab>('library')
  const [aiMode, setAiMode] = useState<'assistant' | 'swarm'>('assistant')
  const [editingProtocol, setEditingProtocol] = useState<Partial<Protocol> | null>(null)

  const activeCatData = PROTOCOL_CATEGORIES.find(c => c.id === store.activeCategory)
  const subcategories = activeCatData?.subcategories || []

  const displayedProtocols = activeSubcategory
    ? store.paginatedProtocols.filter(p => p.subcategory === activeSubcategory)
    : store.paginatedProtocols

  const handleApprove = (p: Protocol) => {
    store.updateProtocol({ ...p, approvalStatus: 'approved', lastReviewedAt: new Date().toISOString() })
  }


  const handleEditorSave = (data: Partial<Protocol>) => {
    if (data.id && store.allProtocols.find(p => p.id === data.id)) {
      store.updateProtocol({ ...store.allProtocols.find(p => p.id === data.id)!, ...data } as Protocol)
    } else {
      store.addProtocol(data as Protocol)
    }
    setEditingProtocol(null)
    setMainTab('library')
  }

  const MAIN_TABS: { id: MainTab; label: string; icon: string }[] = [
    { id: 'library', label: 'Library', icon: '📚' },
    { id: 'external', label: 'Protocol Library (open sources)', icon: '🌐' },
    { id: 'ai', label: 'AI', icon: '🤖' }, // Assistant and Swarm in one tab; the editor opens from + New Protocol
  ]

  return (
    <div style={{ padding: '0', minHeight: embedded ? undefined : '100vh' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          {!embedded && <h1 style={{ color: 'var(--text)', fontSize: 26, fontWeight: 700, margin: 0 }}>Biomedical Protocol Library</h1>}
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            {store.allProtocols.length} protocols · {PROTOCOL_CATEGORIES.length} categories · AI Swarm Protocol Intelligence
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setEditingProtocol({}); setMainTab('editor') }} style={headerBtn('var(--accent)', 'var(--accent)')}>
            + New Protocol
          </button>
          <button onClick={() => importHook.setIsOpen(true)} style={headerBtn('var(--surface2)', 'var(--border)')}>
            <EmojiIcon glyph="📥" /> Import
          </button>
          <button onClick={() => genHook.setIsOpen(true)} style={headerBtn('#6d28d9', '#8b5cf6')}>
            <EmojiIcon glyph="🤖" /> AI Generate
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: store.allProtocols.length, color: 'var(--accent)' },
          { label: 'Approved', value: store.allProtocols.filter(p => p.approvalStatus === 'approved').length, color: '#10b981' },
          { label: 'Draft', value: store.allProtocols.filter(p => p.approvalStatus === 'draft').length, color: '#6b7280' },
          { label: 'Under Review', value: store.allProtocols.filter(p => p.approvalStatus === 'under_review').length, color: '#f59e0b' },
          { label: 'Archived', value: store.allProtocols.filter(p => p.approvalStatus === 'archived').length, color: '#ef4444' },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '10px 18px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {MAIN_TABS.map(tab => (
          <button key={tab.id} onClick={() => setMainTab(tab.id)} style={{
            padding: '10px 16px', border: 'none',
            borderBottom: mainTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'transparent', color: mainTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: 13, fontWeight: mainTab === tab.id ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
            <span><EmojiIcon glyph={tab.icon} /></span>{tab.label}
          </button>
        ))}
      </div>

      {/* ── Library Tab ── */}
      {mainTab === 'library' && (
        <>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <SubcategoryBrowser
              categories={store.categories}
              activeCategory={store.activeCategory}
              activeSubcategory={activeSubcategory}
              onSelectCategory={store.setActiveCategory}
              onSelectSubcategory={setActiveSubcategory}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <ProtocolSearch
                  value={store.filters.search}
                  onChange={v => store.setFilters({ ...store.filters, search: v })}
                  resultCount={store.protocols.length}
                />
                <button onClick={() => setShowFilters(f => !f)} style={{
                  background: showFilters ? 'var(--accent-light)' : 'var(--surface)',
                  border: `1px solid ${showFilters ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8, color: showFilters ? 'var(--accent)' : 'var(--text)',
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                }}>
                  <EmojiIcon glyph="⚙️" /> Filters {showFilters ? '▲' : '▼'}
                </button>
                <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {(['table', 'grid'] as const).map(m => (
                    <button key={m} onClick={() => store.setViewMode(m)} style={{
                      background: store.viewMode === m ? 'var(--accent)' : 'transparent', border: 'none',
                      color: store.viewMode === m ? '#fff' : 'var(--text)', padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    }}>{m === 'table' ? '☰ Table' : '⊞ Grid'}</button>
                  ))}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>
                  {store.protocols.length} result{store.protocols.length !== 1 ? 's' : ''}
                </span>
              </div>

              {showFilters && (
                <div style={{ marginBottom: 12 }}>
                  <ProtocolFiltersBar
                    filters={store.filters}
                    onChange={store.setFilters}
                    activeCategory={store.activeCategory}
                    subcategories={subcategories}
                  />
                </div>
              )}

              {store.activeCategory && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                    Filtering: <strong style={{ color: 'var(--text)' }}>{store.activeCategory.replace(/-/g, ' ')}</strong>
                    {activeSubcategory && <> › <strong style={{ color: 'var(--accent)' }}>{activeSubcategory.replace(/-/g, ' ')}</strong></>}
                  </span>
                  <button onClick={() => { store.setActiveCategory(''); setActiveSubcategory('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
                    Clear
                  </button>
                </div>
              )}

              {displayedProtocols.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 36, marginBottom: 14 }}><EmojiIcon glyph="🔍" /></div>
                  <div style={{ fontSize: 16 }}>No protocols match your filters</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>Try clearing filters or adjusting your search</div>
                </div>
              ) : store.viewMode === 'table' ? (
                <ProtocolTable
                  protocols={displayedProtocols}
                  onView={store.setSelectedProtocol}
                  onDelete={store.deleteProtocol}
                  onApprove={handleApprove}
                  page={store.pagination.page}
                  totalPages={store.pagination.totalPages}
                  total={store.pagination.total}
                  perPage={store.pagination.perPage}
                  onPageChange={store.pagination.setPage}
                />
              ) : (
                <ProtocolCardGrid
                  protocols={displayedProtocols}
                  onView={store.setSelectedProtocol}
                  onDelete={store.deleteProtocol}
                />
              )}
            </div>
          </div>
          <details style={{ marginTop: 20 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>Category overview (cards)</summary>
            <ProtocolCategoryCards
              categories={store.categories}
              activeCategory={store.activeCategory}
              onSelectCategory={store.setActiveCategory}
            />
          </details>
        </>
      )}

      {/* ── Editor Tab ── */}
      {mainTab === 'editor' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', minHeight: 600 }}>
          <ProtocolEditor
            protocol={editingProtocol || {}}
            onSave={handleEditorSave}
            onCancel={() => { setEditingProtocol(null); setMainTab('library') }}
          />
        </div>
      )}

      {/* ── AI tab: Assistant (one protocol at a time) and Swarm (multi-agent drafting) in one place ── */}
      {mainTab === 'ai' && (
        <div>
          <div role="group" aria-label="AI mode" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {([['assistant', '🤖 Assistant', 'Improve, convert and analyse one protocol'], ['swarm', '🧬 Swarm', 'Several AI agents draft and review a protocol together']] as const).map(([k, label, hint]) => (
              <button key={k} type="button" onClick={() => setAiMode(k)} aria-pressed={aiMode === k} title={hint}
                style={{ padding: '7px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontWeight: aiMode === k ? 700 : 500,
                  border: `1px solid ${aiMode === k ? 'var(--accent)' : 'var(--border)'}`,
                  background: aiMode === k ? 'rgba(99,102,241,0.12)' : 'transparent', color: 'var(--text)' }}>
                {label}
              </button>
            ))}
          </div>
          {aiMode === 'swarm' ? <SwarmDashboard swarm={swarm} /> : (
            <div style={{ maxWidth: 780 }}>
              <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                Generate, improve, convert, and analyse biomedical protocols using AI. Generation is optional.
              </p>
              <ProtocolAIHelper protocol={store.selectedProtocol || undefined} />
            </div>
          )}
        </div>
      )}

      {mainTab === 'external' && <ExternalLibrary />}

      {/* Modals & Drawer */}
      <ProtocolDetailDrawer
        protocol={store.selectedProtocol}
        onClose={() => store.setSelectedProtocol(null)}
        onUpdateProtocol={(updated) => {
          store.updateProtocol(updated)
          store.setSelectedProtocol(updated)
        }}
      />
      <ProtocolImportModal hook={importHook} />
      <ProtocolGenerateModal hook={genHook} />
    </div>
  )
}

const headerBtn = (bg: string, border: string): React.CSSProperties => ({
  background: bg, border: `1px solid ${border}`, borderRadius: 8,
  color: bg === 'var(--surface2)' ? 'var(--text)' : '#ffffff',
  padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  transition: 'all 0.15s ease',
})
