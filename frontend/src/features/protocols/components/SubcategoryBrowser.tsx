import React, { useState } from 'react'
import type { ProtocolCategory } from '../types/protocol.types'
import { getCategoryColor } from '../utils/protocolStatus'

interface Props {
  categories: ProtocolCategory[]
  activeCategory: string
  activeSubcategory: string
  onSelectCategory: (id: string) => void
  onSelectSubcategory: (id: string) => void
}

export default function SubcategoryBrowser({ categories, activeCategory, activeSubcategory, onSelectCategory, onSelectSubcategory }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['microbiology', 'molecular-biology']))

  const toggle = (id: string) => setExpanded(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  return (
    <div style={{ width: 240, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 0 12px', marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
        Browse Categories
      </div>
      {/* All protocols */}
      <button onClick={() => { onSelectCategory(''); onSelectSubcategory('') }}
        style={{ width: '100%', textAlign: 'left', background: !activeCategory ? 'var(--accent-light)' : 'transparent', border: !activeCategory ? '1px solid var(--accent)' : '1px solid transparent', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, cursor: 'pointer', marginBottom: 8, fontWeight: 500 }}>
        🧫 All Protocols
      </button>
      {categories.map(cat => {
        const color = getCategoryColor(cat.id)
        const isExpanded = expanded.has(cat.id)
        const isCatActive = activeCategory === cat.id
        return (
          <div key={cat.id} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <button onClick={() => toggle(cat.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', padding: '0 6px', fontSize: 12 }}>
                {isExpanded ? '▼' : '▶'}
              </button>
              <button onClick={() => { onSelectCategory(isCatActive ? '' : cat.id); onSelectSubcategory('') }}
                style={{
                  flex: 1, textAlign: 'left', background: isCatActive && !activeSubcategory ? 'var(--surface-hover)' : 'transparent',
                  border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                  color: 'var(--text)', fontSize: 14, fontWeight: isCatActive ? 600 : 500,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                <span>{cat.icon} {cat.name}</span>
                <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>{cat.protocolCount}</span>
              </button>
            </div>
            {isExpanded && (
              <div style={{ paddingLeft: 24, marginTop: 4 }}>
                {cat.subcategories.map(sub => (
                  <button key={sub.id}
                    onClick={() => { onSelectCategory(cat.id); onSelectSubcategory(sub.id) }}
                    style={{
                      width: '100%', textAlign: 'left', background: activeSubcategory === sub.id ? 'var(--accent-light)' : 'transparent',
                      border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
                      color: activeSubcategory === sub.id ? 'var(--accent)' : 'var(--text-soft)', fontSize: 13, fontWeight: activeSubcategory === sub.id ? 600 : 400,
                      display: 'flex', justifyContent: 'space-between', marginBottom: 2,
                    }}>
                    <span>{sub.name}</span>
                    {sub.protocolCount > 0 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{sub.protocolCount}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
