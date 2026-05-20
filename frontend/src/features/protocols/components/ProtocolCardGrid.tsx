import React from 'react'
import type { Protocol } from '../types/protocol.types'
import { ApprovalBadge, SourceBadge, ProtocolTypeBadge, DifficultyBadge } from './ProtocolBadges'
import { getCategoryColor } from '../utils/protocolStatus'

interface Props {
  protocols: Protocol[]
  onView: (p: Protocol) => void
  onDelete: (id: string) => void
}

export default function ProtocolCardGrid({ protocols, onView, onDelete }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
      {protocols.map(p => (
        <div key={p.id} onClick={() => onView(p)}
          style={{
            background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 10, padding: 16,
            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: 10,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = '#6366f1' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.borderColor = '#2a2d3e' }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
              <span style={{ color: getCategoryColor(p.category), fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {p.category.replace(/-/g, ' ')}
              </span>
              <ApprovalBadge status={p.approvalStatus} />
            </div>
            <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>{p.title}</h3>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '6px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {p.summary}
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <SourceBadge sourceType={p.sourceType} />
            <ProtocolTypeBadge type={p.protocolType} />
            {p.difficulty && <DifficultyBadge difficulty={p.difficulty} />}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {p.tags.slice(0, 3).map(t => (
              <span key={t} style={{ background: '#242838', color: '#94a3b8', fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid #2a2d3e' }}>{t}</span>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2d3e', paddingTop: 10 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ color: '#64748b', fontSize: 11 }}>📋 {p.steps.length} steps</span>
              {p.publicationYear && <span style={{ color: '#64748b', fontSize: 11 }}>📅 {p.publicationYear}</span>}
              <span style={{ color: '#64748b', fontSize: 11 }}>v{p.version}</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => onView(p)} style={{ background: '#6366f122', border: '1px solid #6366f1', borderRadius: 4, color: '#6366f1', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>View</button>
              <button onClick={() => onDelete(p.id)} style={{ background: '#ef444422', border: '1px solid #ef4444', borderRadius: 4, color: '#ef4444', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
