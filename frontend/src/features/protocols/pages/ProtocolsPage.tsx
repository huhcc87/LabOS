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
import type { Protocol } from '../types/protocol.types'
import { PROTOCOL_CATEGORIES } from '../data/categories'

export default function ProtocolsPage() {
  const store = useProtocols()
  const importHook = useProtocolImport(store.addProtocol)
  const genHook = useProtocolGeneration(store.addProtocol)
  const [activeSubcategory, setActiveSubcategory] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Derive subcategories for current active category
  const activeCatData = PROTOCOL_CATEGORIES.find(c => c.id === store.activeCategory)
  const subcategories = activeCatData?.subcategories || []

  // Further filter by subcategory selection in browser
  const displayedProtocols = activeSubcategory
    ? store.paginatedProtocols.filter(p => p.subcategory === activeSubcategory)
    : store.paginatedProtocols

  const handleApprove = (p: Protocol) => {
    store.updateProtocol({ ...p, approvalStatus: 'approved', lastReviewedAt: new Date().toISOString() })
  }

  return (
    <div style={{ padding: '0', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 28, fontWeight: 700, margin: 0 }}>Protocol Library</h1>
          <p style={{ color: 'var(--text-soft)', fontSize: 15, margin: '6px 0 0' }}>
            {store.allProtocols.length} protocols across Microbiology, Molecular Biology, Immunology, and Cancer Biology
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => importHook.setIsOpen(true)} style={headerBtn('var(--accent)', 'var(--accent)')}>
            📥 Import Protocol
          </button>
          <button onClick={() => genHook.setIsOpen(true)} style={headerBtn('#6d28d9', '#8b5cf6')}>
            🤖 Generate AI Protocol
          </button>
        </div>
      </div>

      {/* Category Cards */}
      <ProtocolCategoryCards
        categories={store.categories}
        activeCategory={store.activeCategory}
        onSelectCategory={store.setActiveCategory}
      />

      {/* Body */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Sidebar */}
        <SubcategoryBrowser
          categories={store.categories}
          activeCategory={store.activeCategory}
          activeSubcategory={activeSubcategory}
          onSelectCategory={store.setActiveCategory}
          onSelectSubcategory={setActiveSubcategory}
        />

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <ProtocolSearch
              value={store.filters.search}
              onChange={v => store.setFilters({ ...store.filters, search: v })}
              resultCount={store.protocols.length}
            />
            <button onClick={() => setShowFilters(f => !f)} style={{
              background: showFilters ? 'var(--accent-light)' : 'var(--surface)', border: `1px solid ${showFilters ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8, color: showFilters ? 'var(--accent)' : 'var(--text)', padding: '10px 14px', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap', fontWeight: 500,
            }}>
              ⚙️ Filters {showFilters ? '▲' : '▼'}
            </button>
            {/* View toggle */}
            <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['table', 'grid'] as const).map(m => (
                <button key={m} onClick={() => store.setViewMode(m)} style={{
                  background: store.viewMode === m ? 'var(--accent)' : 'transparent', border: 'none',
                  color: store.viewMode === m ? '#fff' : 'var(--text)', padding: '10px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                }}>{m === 'table' ? '☰ Table' : '⊞ Grid'}</button>
              ))}
            </div>
            <span style={{ color: 'var(--text-soft)', fontSize: 14, whiteSpace: 'nowrap' }}>
              {store.protocols.length} result{store.protocols.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Filters */}
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

          {/* Active category indicator */}
          {store.activeCategory && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ color: 'var(--text-soft)', fontSize: 14 }}>
                Filtering: <strong style={{ color: 'var(--text)' }}>{store.activeCategory.replace(/-/g, ' ')}</strong>
                {activeSubcategory && <> › <strong style={{ color: 'var(--accent)' }}>{activeSubcategory.replace(/-/g, ' ')}</strong></>}
              </span>
              <button onClick={() => { store.setActiveCategory(''); setActiveSubcategory('') }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
                Clear
              </button>
            </div>
          )}

          {/* Data */}
          {displayedProtocols.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>🔍</div>
              <div style={{ fontSize: 16 }}>No protocols match your filters</div>
              <div style={{ fontSize: 14, marginTop: 6, color: 'var(--text-soft)' }}>Try clearing filters or adjusting your search</div>
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
  color: '#ffffff', padding: '10px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transition: 'all 0.15s ease',
})
