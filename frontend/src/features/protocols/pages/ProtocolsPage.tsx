import React, { useState, useMemo } from 'react'
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
import ProtocolWorkflowBuilder from '../components/ProtocolWorkflowBuilder'
import GenomicsViewer from '../viewers/GenomicsViewer'
import ProteinStructureViewer from '../viewers/ProteinStructureViewer'
import MicroscopyViewer from '../viewers/MicroscopyViewer'
import type { Protocol } from '../types/protocol.types'
import { PROTOCOL_CATEGORIES } from '../data/categories'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

type MainTab = 'library' | 'editor' | 'ai' | 'workflow' | 'viewers' | 'analytics'
type ViewerTab = 'genomics' | 'protein' | 'microscopy'

const BIOSAFETY_COLORS: Record<string, string> = {
  'BSL-1': '#10b981',
  'BSL-2': '#f59e0b',
  'BSL-3': '#f97316',
  'BSL-4': '#dc2626',
}
const STATUS_COLORS: Record<string, string> = {
  approved: '#10b981',
  draft: '#6b7280',
  under_review: '#f59e0b',
  archived: '#ef4444',
}

export default function ProtocolsPage() {
  const store = useProtocols()
  const importHook = useProtocolImport(store.addProtocol)
  const genHook = useProtocolGeneration(store.addProtocol)
  const [activeSubcategory, setActiveSubcategory] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [mainTab, setMainTab] = useState<MainTab>('library')
  const [viewerTab, setViewerTab] = useState<ViewerTab>('genomics')
  const [editingProtocol, setEditingProtocol] = useState<Partial<Protocol> | null>(null)

  const activeCatData = PROTOCOL_CATEGORIES.find(c => c.id === store.activeCategory)
  const subcategories = activeCatData?.subcategories || []

  const displayedProtocols = activeSubcategory
    ? store.paginatedProtocols.filter(p => p.subcategory === activeSubcategory)
    : store.paginatedProtocols

  const handleApprove = (p: Protocol) => {
    store.updateProtocol({ ...p, approvalStatus: 'approved', lastReviewedAt: new Date().toISOString() })
  }

  // Analytics data
  const analyticsData = useMemo(() => {
    const all = store.allProtocols
    const byCat = PROTOCOL_CATEGORIES.map(cat => ({
      name: cat.name.split(' ')[0],
      count: all.filter(p => p.category === cat.id).length,
    })).filter(d => d.count > 0).sort((a, b) => b.count - a.count).slice(0, 8)

    const byStatus = ['approved', 'draft', 'under_review', 'archived'].map(s => ({
      name: s === 'under_review' ? 'Review' : s.charAt(0).toUpperCase() + s.slice(1),
      value: all.filter(p => p.approvalStatus === s).length,
      color: STATUS_COLORS[s],
    })).filter(d => d.value > 0)

    const byBsl = Object.entries(BIOSAFETY_COLORS).map(([bsl, color]) => ({
      name: bsl,
      value: all.filter(p => p.biosafetyLevel === bsl).length,
      color,
    })).filter(d => d.value > 0)

    return { byCat, byStatus, byBsl }
  }, [store.allProtocols])

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
    { id: 'editor', label: 'Editor', icon: '✏️' },
    { id: 'ai', label: 'AI Assistant', icon: '🤖' },
    { id: 'workflow', label: 'Workflows', icon: '🔀' },
    { id: 'viewers', label: 'Viewers', icon: '🔬' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
  ]

  return (
    <div style={{ padding: '0', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 26, fontWeight: 700, margin: 0 }}>Biomedical Protocol Library</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            {store.allProtocols.length} protocols · 20 categories · Advanced Biomedical SOP Management
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setEditingProtocol({}); setMainTab('editor') }} style={headerBtn('var(--accent)', 'var(--accent)')}>
            + New Protocol
          </button>
          <button onClick={() => importHook.setIsOpen(true)} style={headerBtn('var(--surface2)', 'var(--border)')}>
            📥 Import
          </button>
          <button onClick={() => genHook.setIsOpen(true)} style={headerBtn('#6d28d9', '#8b5cf6')}>
            🤖 AI Generate
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
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* ── Library Tab ── */}
      {mainTab === 'library' && (
        <>
          <ProtocolCategoryCards
            categories={store.categories}
            activeCategory={store.activeCategory}
            onSelectCategory={store.setActiveCategory}
          />
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
                  ⚙️ Filters {showFilters ? '▲' : '▼'}
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
                  <div style={{ fontSize: 36, marginBottom: 14 }}>🔍</div>
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

      {/* ── AI Assistant Tab ── */}
      {mainTab === 'ai' && (
        <div style={{ maxWidth: 780 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 4px', color: 'var(--text)', fontSize: 18, fontWeight: 600 }}>AI Protocol Assistant</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
              Generate, improve, convert, and analyse biomedical protocols using AI. All generation is optional and requires an API key.
            </p>
          </div>
          <ProtocolAIHelper protocol={store.selectedProtocol || undefined} />
        </div>
      )}

      {/* ── Workflow Builder Tab ── */}
      {mainTab === 'workflow' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 4px', color: 'var(--text)', fontSize: 18, fontWeight: 600 }}>Protocol Workflow Builder</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
              Visualise protocol workflows as step-by-step flow diagrams with decision gates and QC checkpoints.
            </p>
          </div>
          <ProtocolWorkflowBuilder />
        </div>
      )}

      {/* ── Viewers Tab ── */}
      {mainTab === 'viewers' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 4px', color: 'var(--text)', fontSize: 18, fontWeight: 600 }}>Scientific Viewers</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
              Integrated viewers for genomics tracks, protein structures, and microscopy/pathology slides.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            {([
              { id: 'genomics', label: '🧬 Genomics (IGV)' },
              { id: 'protein', label: '🔬 Protein Structure (Mol*)' },
              { id: 'microscopy', label: '🔭 Microscopy (OSD)' },
            ] as { id: ViewerTab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setViewerTab(t.id)} style={{
                padding: '9px 16px', border: 'none',
                borderBottom: viewerTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent', color: viewerTab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: 13, fontWeight: viewerTab === t.id ? 600 : 400,
              }}>
                {t.label}
              </button>
            ))}
          </div>
          {viewerTab === 'genomics' && <GenomicsViewer />}
          {viewerTab === 'protein' && <ProteinStructureViewer />}
          {viewerTab === 'microscopy' && <MicroscopyViewer />}
        </div>
      )}

      {/* ── Analytics Tab ── */}
      {mainTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', color: 'var(--text)', fontSize: 18, fontWeight: 600 }}>Protocol Analytics</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
              Usage trends, approval status, biosafety distribution, and category breakdown.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            {/* Protocols by Category */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Protocols by Category</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analyticsData.byCat} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={80} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text)' }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Approval Status */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Approval Status</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={analyticsData.byStatus} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {analyticsData.byStatus.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Biosafety Level */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Biosafety Level Distribution</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={analyticsData.byBsl} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {analyticsData.byBsl.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Summary table */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Category Summary</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {PROTOCOL_CATEGORIES.map(cat => {
                  const count = store.allProtocols.filter(p => p.category === cat.id).length
                  if (!count) return null
                  return (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{cat.icon}</span>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{cat.name}</span>
                      <div style={{ width: 80, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(count / store.allProtocols.length) * 100}%`, height: '100%', background: cat.color, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

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
