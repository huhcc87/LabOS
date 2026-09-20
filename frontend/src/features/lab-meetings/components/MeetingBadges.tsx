import React from 'react'
import type { MeetingType, MeetingStatus, ActionItemStatus, ActionItemPriority, AgendaItemStatus, AttendanceStatus } from '../types/meeting.types'
import { getMeetingTypeLabel, getMeetingTypeColor, getMeetingTypeIcon, getStatusColor, getPriorityColor } from '../utils/meetingUtils'

const badge = (label: string, color: string, icon?: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: color + '22', color, fontSize: 11, fontWeight: 600,
  padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' as const,
})

export function MeetingTypeBadge({ type }: { type: MeetingType }) {
  const color = getMeetingTypeColor(type)
  return <span style={badge(getMeetingTypeLabel(type), color)}>{getMeetingTypeIcon(type)} {getMeetingTypeLabel(type)}</span>
}

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  const labels: Record<MeetingStatus, string> = { scheduled: 'Scheduled', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' }
  const icons: Record<MeetingStatus, string> = { scheduled: '📅', in_progress: '▶', completed: '✓', cancelled: '✕' }
  const color = getStatusColor(status)
  return <span style={badge(labels[status], color)}>{icons[status]} {labels[status]}</span>
}

export function ActionStatusBadge({ status }: { status: ActionItemStatus }) {
  const labels: Record<ActionItemStatus, string> = { open: 'Open', in_progress: 'In Progress', completed: 'Done', overdue: 'Overdue', cancelled: 'Cancelled' }
  const color = getStatusColor(status)
  return <span style={badge(labels[status], color)}>{labels[status]}</span>
}

export function PriorityBadge({ priority }: { priority: ActionItemPriority }) {
  const color = getPriorityColor(priority)
  return <span style={badge(priority, color)}>{priority.toUpperCase()}</span>
}

export function AgendaStatusBadge({ status }: { status: AgendaItemStatus }) {
  const labels: Record<AgendaItemStatus, string> = {
    pending_approval: 'Pending', approved: 'Approved', rejected: 'Rejected', presented: 'Presented', deferred: 'Deferred'
  }
  const color = getStatusColor(status)
  return <span style={badge(labels[status], color)}>{labels[status]}</span>
}

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const labels: Record<AttendanceStatus, string> = { present: 'Present', absent: 'Absent', remote: 'Remote', excused: 'Excused' }
  const icons: Record<AttendanceStatus, string> = { present: '✓', absent: '✕', remote: '💻', excused: '~' }
  const color = getStatusColor(status)
  return <span style={badge(labels[status], color)}>{icons[status]} {labels[status]}</span>
}
