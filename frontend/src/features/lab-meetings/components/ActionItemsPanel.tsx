import React, { useState } from 'react'
import type { ActionItem, ActionItemStatus } from '../types/meeting.types'
import { ActionStatusBadge, PriorityBadge } from './MeetingBadges'
import { getPriorityColor } from '../utils/meetingUtils'

interface Props {
  items: ActionItem[]
  isPiOrAdmin: boolean
  isManagerOrAbove: boolean
  currentUserName: string
  onUpdateStatus: (id: string, status: ActionItemStatus) => void
  onDelete: (id: string) => void
}

const STATUS_OPTIONS: ActionItemStatus[] = ['open', 'in_progress', 'completed', 'cancelled']

export default function ActionItemsPanel({ items, isPiOrAdmin, isManagerOrAbove, currentUserName, onUpdateStatus, onDelete }: Props) {
  const [filter, setFilter] = useState<'all' | ActionItemStatus>('all')
  const [filterAssignee, setFilterAssignee] = useState<'all' | 'mine'>('all')

  const filtered = items.filter(i => {
    if (filter !== 'all' && i.status !== filter) return false
    if (filterAssignee === 'mine' && i.assignedToName !== currentUserName) return false
    return true
  })

  const counts = items.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc }, {} as Record<string, number>)
  const overdue = items.filter(i => i.status === 'overdue').length
  const open = items.filter(i => i.status === 'open' || i.status === 'in_progress').length
  const done = items.filter(i => i.status === 'completed').length
  const completion = items.length > 0 ? Math.round((done / items.length) * 100) : 0

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Open', count: open, color: '#f59e0b' },
          { label: 'Done', count: done, color: '#22c55e' },
          { label: 'Overdue', count: overdue, color: '#ef4444' },
          { label: 'Completion', count: `${completion}%`, color: '#6366f1' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 80, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'open', 'in_progress', 'completed', 'overdue', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            background: filter === s ? '#6366f1' : '#f1f5f9', border: 'none', borderRadius: 6,
            color: filter === s ? '#fff' : '#64748b', padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: filter === s ? 600 : 400,
          }}>
            {s === 'all' ? `All (${items.length})` : `${s.replace('_', ' ')} (${counts[s] || 0})`}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['all', 'mine'] as const).map(a => (
            <button key={a} onClick={() => setFilterAssignee(a)} style={{
              background: filterAssignee === a ? '#e0e7ff' : 'transparent', border: '1px solid #e2e8f0',
              borderRadius: 6, color: filterAssignee === a ? '#6366f1' : '#94a3b8', padding: '5px 10px', cursor: 'pointer', fontSize: 12,
            }}>
              {a === 'all' ? 'All members' : 'My items'}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      {filtered.length === 0
        ? <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', background: '#f8fafc', borderRadius: 8 }}>No action items match your filter</div>
        : filtered.map(item => {
          const isOverdue = item.status === 'overdue' || (item.status !== 'completed' && item.status !== 'cancelled' && new Date(item.dueDate) < new Date())
          const canEdit = isPiOrAdmin || isManagerOrAbove || item.assignedToName === currentUserName
          const dueDate = new Date(item.dueDate)
          const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / 86400000)

          return (
            <div key={item.id} style={{
              background: '#fff', border: `1px solid ${isOverdue && item.status !== 'completed' ? '#fecaca' : '#e2e8f0'}`,
              borderLeft: `4px solid ${getPriorityColor(item.priority)}`,
              borderRadius: 8, padding: '12px 14px', marginBottom: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <ActionStatusBadge status={item.status} />
                    <PriorityBadge priority={item.priority} />
                    {isOverdue && item.status !== 'completed' && <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>OVERDUE</span>}
                  </div>
                  <div style={{ color: '#1e293b', fontSize: 14, fontWeight: 600, marginBottom: 4,
                    textDecoration: item.status === 'completed' ? 'line-through' : 'none' }}>
                    {item.title}
                  </div>
                  {item.description && <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6 }}>{item.description}</div>}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ color: '#475569', fontSize: 12 }}>👤 {item.assignedToName} <span style={{ color: '#94a3b8' }}>({item.assignedToRole})</span></span>
                    <span style={{ color: isOverdue && item.status !== 'completed' ? '#ef4444' : '#94a3b8', fontSize: 12, fontWeight: isOverdue ? 700 : 400 }}>
                      📅 Due: {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {item.status !== 'completed' && item.status !== 'cancelled' && (
                        <span> ({daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : daysUntilDue === 0 ? 'today' : `${daysUntilDue}d left`})</span>
                      )}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>📋 {item.meetingTitle}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>by {item.assignedBy}</span>
                  </div>
                  {item.notes && <div style={{ marginTop: 6, color: '#475569', fontSize: 12, fontStyle: 'italic' }}>Note: {item.notes}</div>}
                  {item.completedAt && <div style={{ color: '#22c55e', fontSize: 11, marginTop: 4 }}>✓ Completed {new Date(item.completedAt).toLocaleDateString()}</div>}
                </div>
                {canEdit && item.status !== 'cancelled' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    {item.status !== 'completed' && (
                      <button onClick={() => onUpdateStatus(item.id, 'completed')}
                        style={{ background: '#dcfce7', border: 'none', borderRadius: 6, color: '#16a34a', padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        ✓ Done
                      </button>
                    )}
                    {item.status === 'open' && (
                      <button onClick={() => onUpdateStatus(item.id, 'in_progress')}
                        style={{ background: '#eff6ff', border: 'none', borderRadius: 6, color: '#6366f1', padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
                        ▶ Start
                      </button>
                    )}
                    {isPiOrAdmin && (
                      <button onClick={() => onDelete(item.id)}
                        style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })
      }
    </div>
  )
}
