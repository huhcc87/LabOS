import React, { useState } from 'react'
import type { Protocol } from '../types/protocol.types'
import { ApprovalBadge, SourceBadge, ProtocolTypeBadge, DifficultyBadge } from './ProtocolBadges'
import { getCategoryColor } from '../utils/protocolStatus'

interface Props {
  protocols: Protocol[]
  onView: (p: Protocol) => void
  onDelete: (id: string) => void
  onApprove?: (p: Protocol) => void
  page: number
  totalPages: number
  total: number
  perPage: number
  onPageChange: (p: number) => void
}

type SortKey = 'title' | 'category' | 'approvalStatus' | 'publicationYear' | 'version'

export default function ProtocolTable({ protocols, onView, onDelete, onApprove, page, totalPages, total, perPage, onPageChange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  const sorted = [...protocols].sort((a, b) => {
    const av = String(a[sortKey] || ''); const bv = String(b[sortKey] || '')
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  const th = (label: string, key?: SortKey) => (
    <th onClick={() => key && handleSort(key)} style={{
      padding: '14px 16px', color: 'var(--text)', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', textAlign: 'left', borderBottom: '2px solid var(--border)', background: 'var(--surface2)',
      cursor: key ? 'pointer' : 'default', whiteSpace: 'nowrap', userSelect: 'none',
    }}>
      {label}{key && sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div>
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {th('Title', 'title')}{th('Category')}{th('Source')}{th('Type')}{th('Status', 'approvalStatus')}
              {th('Difficulty')}{th('Ver', 'version')}{th('Year', 'publicationYear')}{th('Steps')}{th('Owner')}{th('Actions')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.id} onClick={() => onView(p)}
                style={{ background: i % 2 === 0 ? 'var(--table-row-alt)' : 'transparent', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--table-row-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--table-row-alt)' : 'transparent')}
              >
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', maxWidth: 300 }}>
                  <div style={{ color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>{p.title}</div>
                  <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 3 }}>{p.subcategory.replace(/-/g, ' ')}</div>
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <span className={`category-badge ${p.category.replace(/\s+/g, '-').toLowerCase()}`} style={{ fontSize: 13, fontWeight: 600 }}>
                    {p.category.replace(/-/g, ' ')}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <SourceBadge sourceType={p.sourceType} />
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <ProtocolTypeBadge type={p.protocolType} />
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <ApprovalBadge status={p.approvalStatus} />
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  {p.difficulty ? <DifficultyBadge difficulty={p.difficulty} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-soft)' }}>{p.version}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-soft)' }}>{p.publicationYear || '—'}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-soft)' }}>{p.steps.length}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text-soft)', fontSize: 13, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.owner}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onView(p)} title="View" style={btnStyle('var(--accent)')}>👁</button>
                    {p.approvalStatus === 'under_review' && onApprove && (
                      <button onClick={() => onApprove(p)} title="Approve" style={btnStyle('var(--success)')}>✓</button>
                    )}
                    {deleteConfirm === p.id ? (
                      <>
                        <button onClick={() => { onDelete(p.id); setDeleteConfirm(null) }} style={btnStyle('var(--danger)')}>Confirm</button>
                        <button onClick={() => setDeleteConfirm(null)} style={btnStyle('var(--text-muted)')}>Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteConfirm(p.id)} title="Delete" style={btnStyle('var(--danger)')}>🗑</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', marginTop: 8 }}>
        <span style={{ color: 'var(--text-soft)', fontSize: 14 }}>
          Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} style={pageBtn(page <= 1)}>← Prev</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => onPageChange(n)} style={{ ...pageBtn(false), background: n === page ? 'var(--accent)' : 'var(--surface)', color: n === page ? '#fff' : 'var(--text)' }}>{n}</button>
          ))}
          <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} style={pageBtn(page >= totalPages)}>Next →</button>
        </div>
      </div>
    </div>
  )
}

const btnStyle = (color: string): React.CSSProperties => ({
  background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1px solid ${color}`, borderRadius: 6, color,
  padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
})
const pageBtn = (disabled: boolean): React.CSSProperties => ({
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
  color: disabled ? 'var(--text-muted)' : 'var(--text)', padding: '6px 14px', fontSize: 13, fontWeight: 500,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
})
