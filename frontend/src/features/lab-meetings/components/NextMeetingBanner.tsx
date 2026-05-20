import React from 'react'
import type { Meeting } from '../types/meeting.types'
import { formatMeetingDate, formatTime, getDaysUntil, getMeetingTypeColor, getMeetingTypeIcon } from '../utils/meetingUtils'
import { MeetingTypeBadge } from './MeetingBadges'

interface Props {
  meeting: Meeting
  onClick: () => void
  onSubmitTopic: () => void
  onSubmitReport: () => void
  isPiOrAdmin: boolean
}

export default function NextMeetingBanner({ meeting: m, onClick, onSubmitTopic, onSubmitReport, isPiOrAdmin }: Props) {
  const days = getDaysUntil(m.scheduledAt)
  const color = getMeetingTypeColor(m.type)
  const approved = m.agenda.filter(a => a.status === 'approved')
  const pending = m.agenda.filter(a => a.status === 'pending_approval')

  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}18 0%, #f8fafc 100%)`,
      border: `1px solid ${color}44`, borderLeft: `5px solid ${color}`,
      borderRadius: 12, padding: '18px 22px', marginBottom: 24,
      display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center',
    }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>{getMeetingTypeIcon(m.type)}</span>
          <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next Meeting</span>
          <MeetingTypeBadge type={m.type} />
        </div>
        <h2 style={{ color: '#1e293b', fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>{m.title}</h2>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ color: '#475569', fontSize: 13 }}>📅 {formatMeetingDate(m.scheduledAt)}</span>
          <span style={{ color: '#475569', fontSize: 13 }}>🕐 {formatTime(m.scheduledAt)}</span>
          <span style={{ color: '#475569', fontSize: 13 }}>📍 {m.location}</span>
          {m.zoomLink && <span style={{ color: color, fontSize: 13 }}>🎥 Zoom available</span>}
        </div>
      </div>

      {/* Countdown */}
      <div style={{ textAlign: 'center', background: '#fff', border: `1px solid ${color}33`, borderRadius: 10, padding: '12px 20px' }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: days <= 1 ? '#ef4444' : days <= 3 ? '#f59e0b' : color, lineHeight: 1 }}>
          {days === 0 ? 'Today' : days === 1 ? '1' : days}
        </div>
        {days > 1 && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>days away</div>}
      </div>

      {/* Agenda quick view */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', minWidth: 180 }}>
        <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>AGENDA</div>
        {approved.slice(0, 3).map((a, i) => (
          <div key={a.id} style={{ color: '#1e293b', fontSize: 12, padding: '2px 0', borderBottom: i < Math.min(approved.length, 3) - 1 ? '1px solid #f1f5f9' : 'none' }}>
            <span style={{ color: '#94a3b8', marginRight: 4 }}>{a.order}.</span>{a.title.length > 38 ? a.title.slice(0, 38) + '…' : a.title}
          </div>
        ))}
        {approved.length === 0 && <div style={{ color: '#94a3b8', fontSize: 12 }}>No agenda items yet</div>}
        {approved.length > 3 && <div style={{ color: '#6366f1', fontSize: 11, marginTop: 4 }}>+{approved.length - 3} more items</div>}
        {pending.length > 0 && isPiOrAdmin && (
          <div style={{ color: '#f59e0b', fontSize: 11, marginTop: 4, fontWeight: 600 }}>⏳ {pending.length} awaiting approval</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={onClick} style={{ background: color, border: 'none', borderRadius: 8, color: '#fff', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          View Meeting
        </button>
        <button onClick={onSubmitTopic} style={{ background: '#fff', border: `1px solid ${color}`, borderRadius: 8, color: color, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + Add Agenda Topic
        </button>
        {!isPiOrAdmin && (
          <button onClick={onSubmitReport} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, color: '#475569', padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
            📊 Progress Report
          </button>
        )}
      </div>
    </div>
  )
}
