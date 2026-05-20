import React, { useState } from 'react'
import type { Meeting, AgendaItem } from '../types/meeting.types'
import { AgendaStatusBadge } from './MeetingBadges'

interface Props {
  meeting: Meeting
  isPiOrAdmin: boolean
  onApprove: (itemId: string) => void
  onReject: (itemId: string, reason?: string) => void
  onReorder: (fromIdx: number, toIdx: number) => void
}

export default function AgendaBuilder({ meeting, isPiOrAdmin, onApprove, onReject, onReorder }: Props) {
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [dragging, setDragging] = useState<number | null>(null)

  const approved = meeting.agenda.filter(a => a.status === 'approved' || a.status === 'presented' || a.status === 'deferred').sort((a, b) => a.order - b.order)
  const pending = meeting.agenda.filter(a => a.status === 'pending_approval')
  const rejected = meeting.agenda.filter(a => a.status === 'rejected')
  const allApproved = meeting.agenda.filter(a => a.status === 'approved')

  const totalMins = allApproved.reduce((s, a) => s + a.durationMinutes, 0)
  const scheduledMins = (new Date(meeting.endTime).getTime() - new Date(meeting.scheduledAt).getTime()) / 60000

  const catColor: Record<string, string> = {
    research_update: '#6366f1', journal_club: '#8b5cf6', lab_business: '#0ea5e9',
    training: '#10b981', guest_speaker: '#f59e0b', other: '#94a3b8',
  }
  const catLabel: Record<string, string> = {
    research_update: 'Research', journal_club: 'Journal Club', lab_business: 'Lab Business',
    training: 'Training', guest_speaker: 'Guest Speaker', other: 'Other',
  }

  function AgendaRow({ item, idx }: { item: AgendaItem; idx: number }) {
    return (
      <div
        draggable={isPiOrAdmin && item.status === 'approved'}
        onDragStart={() => setDragging(idx)}
        onDragOver={e => { e.preventDefault() }}
        onDrop={() => { if (dragging !== null && dragging !== idx) { onReorder(dragging, idx); setDragging(null) } }}
        style={{
          background: dragging === idx ? '#f1f5f9' : '#fff',
          border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', marginBottom: 8,
          cursor: isPiOrAdmin && item.status === 'approved' ? 'grab' : 'default',
          transition: 'box-shadow 0.1s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {isPiOrAdmin && item.status === 'approved' && (
            <span style={{ color: '#cbd5e1', fontSize: 16, marginTop: 2, userSelect: 'none' }}>⠿</span>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4, alignItems: 'center' }}>
              <span style={{ background: catColor[item.category] + '22', color: catColor[item.category], fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>
                {catLabel[item.category]}
              </span>
              <AgendaStatusBadge status={item.status} />
              <span style={{ color: '#94a3b8', fontSize: 11 }}>⏱ {item.durationMinutes} min</span>
            </div>
            <div style={{ color: '#1e293b', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
              {item.order > 0 && <span style={{ color: '#94a3b8', marginRight: 4 }}>{item.order}.</span>}
              {item.title}
            </div>
            {item.description && <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>{item.description}</div>}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#475569', fontSize: 12 }}>👤 {item.presenter} <span style={{ color: '#94a3b8' }}>({item.presenterRole})</span></span>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>Submitted by {item.submittedBy}</span>
              {item.slideLink && <a href={item.slideLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#6366f1', fontSize: 11 }}>🔗 Slides</a>}
            </div>
            {item.piNotes && <div style={{ marginTop: 6, padding: '6px 10px', background: '#fef3c7', borderRadius: 6, color: '#92400e', fontSize: 12 }}>💬 PI: {item.piNotes}</div>}
          </div>
          {isPiOrAdmin && item.status === 'pending_approval' && (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => onApprove(item.id)} style={{ background: '#dcfce7', border: 'none', borderRadius: 6, color: '#16a34a', padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✓ Approve</button>
              <button onClick={() => setRejectTarget(item.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>✕ Reject</button>
            </div>
          )}
        </div>
        {rejectTarget === item.id && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8 }}>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Optional reason for rejection..."
              rows={2} style={{ width: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => { setRejectTarget(null); setRejectReason('') }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, color: '#64748b', padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              <button onClick={() => { onReject(item.id, rejectReason || undefined); setRejectTarget(null); setRejectReason('') }}
                style={{ background: '#ef4444', border: 'none', borderRadius: 6, color: '#fff', padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>Confirm Reject</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Time budget */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>AGENDA TIME BUDGET</span>
          <span style={{ color: totalMins > scheduledMins ? '#ef4444' : '#16a34a', fontSize: 12, fontWeight: 700 }}>{totalMins}/{scheduledMins} min</span>
        </div>
        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min((totalMins / scheduledMins) * 100, 100)}%`, background: totalMins > scheduledMins ? '#ef4444' : '#6366f1', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        {totalMins > scheduledMins && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>⚠ Agenda exceeds meeting duration by {totalMins - scheduledMins} min</div>}
      </div>

      {/* Pending approval (PI sees first) */}
      {pending.length > 0 && isPiOrAdmin && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#92400e', fontSize: 12, fontWeight: 700, marginBottom: 8, padding: '6px 10px', background: '#fef3c7', borderRadius: 6 }}>
            ⏳ {pending.length} item{pending.length > 1 ? 's' : ''} awaiting your approval
          </div>
          {pending.map((item, i) => <AgendaRow key={item.id} item={item} idx={i} />)}
        </div>
      )}

      {/* Approved agenda */}
      <div style={{ color: '#475569', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>APPROVED AGENDA</div>
      {approved.length === 0
        ? <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px', background: '#f8fafc', borderRadius: 8 }}>No approved agenda items yet</div>
        : approved.map((item, i) => <AgendaRow key={item.id} item={item} idx={i} />)
      }

      {/* Rejected */}
      {rejected.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>REJECTED / NOT INCLUDED</div>
          {rejected.map((item, i) => <AgendaRow key={item.id} item={item} idx={i} />)}
        </div>
      )}
    </div>
  )
}
