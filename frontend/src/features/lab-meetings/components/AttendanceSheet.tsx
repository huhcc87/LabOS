import React from 'react'
import type { Meeting, AttendanceStatus } from '../types/meeting.types'
import { AttendanceBadge } from './MeetingBadges'

interface Props {
  meeting: Meeting
  isPiOrAdmin: boolean
  isManagerOrAbove: boolean
  onMark: (userId: string, status: AttendanceStatus) => void
}

const STATUSES: AttendanceStatus[] = ['present', 'remote', 'excused', 'absent']
const STATUS_ICONS: Record<AttendanceStatus, string> = { present: '✓', remote: '💻', excused: '~', absent: '✕' }
const STATUS_COLORS: Record<AttendanceStatus, string> = { present: '#16a34a', remote: '#0284c7', excused: '#d97706', absent: '#dc2626' }

export default function AttendanceSheet({ meeting, isPiOrAdmin, isManagerOrAbove, onMark }: Props) {
  const canEdit = isPiOrAdmin || isManagerOrAbove
  const present = meeting.attendees.filter(a => a.status === 'present').length
  const remote = meeting.attendees.filter(a => a.status === 'remote').length
  const absent = meeting.attendees.filter(a => a.status === 'absent').length
  const excused = meeting.attendees.filter(a => a.status === 'excused').length
  const rate = meeting.attendees.length > 0 ? Math.round(((present + remote) / meeting.attendees.length) * 100) : 0

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Present', count: present, color: '#16a34a' },
          { label: 'Remote', count: remote, color: '#0284c7' },
          { label: 'Excused', count: excused, color: '#d97706' },
          { label: 'Absent', count: absent, color: '#dc2626' },
          { label: 'Rate', count: `${rate}%`, color: '#6366f1' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 70, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Attendee rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {meeting.attendees.map(attendee => (
          <div key={attendee.userId} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#6366f1', flexShrink: 0 }}>
              {attendee.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#1e293b', fontSize: 13, fontWeight: 600 }}>{attendee.name}</div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>{attendee.role}</div>
            </div>
            {canEdit ? (
              <div style={{ display: 'flex', gap: 4 }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => onMark(attendee.userId, s)} style={{
                    background: attendee.status === s ? STATUS_COLORS[s] : '#f1f5f9',
                    border: 'none', borderRadius: 6, color: attendee.status === s ? '#fff' : '#64748b',
                    padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: attendee.status === s ? 700 : 400,
                    transition: 'all 0.15s',
                  }}>
                    {STATUS_ICONS[s]} {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            ) : (
              <AttendanceBadge status={attendee.status} />
            )}
          </div>
        ))}
      </div>
      {!canEdit && <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 12 }}>Only PI or managers can edit attendance</div>}
    </div>
  )
}
