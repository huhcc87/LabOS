import React from 'react'
import type { ProtocolCategory } from '../types/protocol.types'

interface Props {
  categories: ProtocolCategory[]
  activeCategory: string
  onSelectCategory: (id: string) => void
}

export default function ProtocolCategoryCards({ categories, activeCategory, onSelectCategory }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
      {categories.map(cat => {
        const isActive = activeCategory === cat.id
        return (
          <div key={cat.id} onClick={() => onSelectCategory(isActive ? '' : cat.id)}
            style={{
              background: '#1a1d27', border: `2px solid ${isActive ? cat.color : '#2a2d3e'}`,
              borderRadius: 12, padding: '20px', cursor: 'pointer',
              transition: 'all 0.2s', boxShadow: isActive ? `0 0 0 3px ${cat.color}33` : 'none',
              transform: isActive ? 'translateY(-2px)' : 'none',
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = cat.color + '88' }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = '#2a2d3e' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>{cat.icon}</span>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>{cat.name}</div>
                <div style={{ color: cat.color, fontSize: 12, fontWeight: 600 }}>{cat.protocolCount} protocols</div>
              </div>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 12px', lineHeight: 1.5 }}>{cat.description}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {cat.subcategories.slice(0, 4).map(sub => (
                <span key={sub.id} style={{
                  background: '#242838', color: '#94a3b8', fontSize: 10, padding: '2px 6px',
                  borderRadius: 4, border: '1px solid #2a2d3e',
                }}>{sub.name}</span>
              ))}
              {cat.subcategories.length > 4 && (
                <span style={{ background: '#242838', color: cat.color, fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>
                  +{cat.subcategories.length - 4} more
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
