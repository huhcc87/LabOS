import React from 'react'
import type { Meeting } from '../types/meeting.types'
import { MeetingTypeBadge, MeetingStatusBadge } from './MeetingBadges'
import { formatMeetingDate, formatTime, formatMeetingDuration, getDaysUntil, getMeetingTypeColor, getAgendaTotalDuration } from '../utils/meetingUtils'

interface Props {
  meeting: Meeting
  onClick: () => void
  isPiOrAdmin: boolean
  onCancel?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export default function MeetingCard({ meeting: m, onClick, isPiOrAdmin, onCancel, onEdit, onDelete }: Props) {
  const daysUntil = getDaysUntil(m.scheduledAt)
  const isPast = m.status === 'completed'
  const isUpcoming = m.status === 'scheduled' || m.status === 'in_progress'
  const accentColor = getMeetingTypeColor(m.type)
  const approvedAgendaItems = m.agenda.filter(a => a.status === 'approved')
  const pendingItems = m.agenda.filter(a => a.status === 'pending_approval')

  return (
    <div onClick={onClick} style={{
      background: '#fff', border: `1px solid ${isUpcoming ? accentColor + '44' : '#e2e8f0'}`,
      borderLeft: `4px solid ${accentColor}`,
      borderRadius: 10, padding: '16px 18px', cursor: 'pointer',
      transition: 'box-shadow 0.15s, transform 0.1s',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
            <MeetingTypeBadge type={m.type} />
            <MeetingStatusBadge status={m.status} />
            {m.isRecurring && <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>🔁 Recurring</span>}
          </div>
          <h3 style={{ color: '#1e293b', fontSize: 15, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{m.title}</h3>
        </div>
        {isUpcoming && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: daysUntil <= 1 ? '#ef4444' : daysUntil <= 3 ? '#f59e0b' : accentColor }}>
              {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{daysUntil > 1 ? 'away' : ''}</div>
          </div>
        )}
      </div>

      {/* Date/Time/Location */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ color: '#475569', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          📅 {formatMeetingDate(m.scheduledAt)}
        </span>
        <span style={{ color: '#475569', fontSize: 12 }}>
          🕐 {formatTime(m.scheduledAt)} – {formatTime(m.endTime)} ({formatMeetingDuration(m.scheduledAt, m.endTime)})
        </span>
        <span style={{ color: '#475569', fontSize: 12 }}>📍 {m.location}</span>
        {m.zoomLink && (
          <a
            href={m.zoomLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              color: '#fff', fontSize: 12, fontWeight: 600,
              background: '#22c55e', padding: '3px 10px', borderRadius: 5,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4
            }}
          >
            🎥 Join Meeting
          </a>
        )}
      </div>

      {/* Agenda summary */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#475569' }}>
          📋 {approvedAgendaItems.length} agenda item{approvedAgendaItems.length !== 1 ? 's' : ''}
          {approvedAgendaItems.length > 0 && <span style={{ color: '#94a3b8' }}> ({getAgendaTotalDuration(m)} min)</span>}
        </span>
        {pendingItems.length > 0 && isPiOrAdmin && (
          <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>⏳ {pendingItems.length} pending approval</span>
        )}
        {m.progressReports.length > 0 && (
          <span style={{ fontSize: 12, color: '#6366f1' }}>📊 {m.progressReports.length} progress report{m.progressReports.length !== 1 ? 's' : ''}</span>
        )}
        {isPast && m.minutesPublished && (
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>📄 Minutes published</span>
        )}
        {isPast && !m.minutesPublished && isPiOrAdmin && (
          <span style={{ fontSize: 12, color: '#ef4444' }}>⚠ Minutes not published</span>
        )}
      </div>

      {/* Attendees preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex' }}>
          {m.attendees.slice(0, 5).map((a, i) => (
            <div key={a.userId} style={{
              width: 24, height: 24, borderRadius: '50%', background: accentColor + '33',
              border: `2px solid #fff`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: accentColor,
              marginLeft: i > 0 ? -6 : 0, zIndex: 5 - i,
            }}>
              {a.name.charAt(0)}
            </div>
          ))}
        </div>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {m.attendees.length} attendee{m.attendees.length !== 1 ? 's' : ''}
        </span>
        {isPiOrAdmin && m.status === 'scheduled' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {onEdit && (
              <button
                onClick={e => { e.stopPropagation(); onEdit() }}
                style={{ background: '#f1f5f9', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 11, padding: '3px 8px', borderRadius: 4 }}
              >
                Edit
              </button>
            )}
            {onCancel && (
              <button
                onClick={e => { e.stopPropagation(); onCancel() }}
                style={{ background: 'none', border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}
              >
                Cancel
              </button>
            )}
            {onDelete && (
              <button
                onClick={e => { e.stopPropagation(); onDelete() }}
                style={{ background: '#fee2e2', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
