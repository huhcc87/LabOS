import type { Meeting, MeetingType, MeetingStatus, ActionItem, ActionItemStatus, AgendaItemStatus, AttendanceStatus } from '../types/meeting.types'

export function getMeetingTypeLabel(type: MeetingType): string {
  const map: Record<MeetingType, string> = {
    weekly: 'Weekly Meeting',
    journal_club: 'Journal Club',
    lab_retreat: 'Lab Retreat',
    one_on_one: '1:1 Meeting',
    progress_report: 'Progress Report',
    special: 'Special Meeting',
  }
  return map[type] || type
}

export function getMeetingTypeColor(type: MeetingType): string {
  const map: Record<MeetingType, string> = {
    weekly: '#6366f1',
    journal_club: '#8b5cf6',
    lab_retreat: '#0ea5e9',
    one_on_one: '#10b981',
    progress_report: '#f59e0b',
    special: '#ef4444',
  }
  return map[type] || '#94a3b8'
}

export function getMeetingTypeIcon(type: MeetingType): string {
  const map: Record<MeetingType, string> = {
    weekly: '📋',
    journal_club: '📖',
    lab_retreat: '🏕',
    one_on_one: '👤',
    progress_report: '📊',
    special: '⭐',
  }
  return map[type] || '📅'
}

export function getStatusColor(status: MeetingStatus | ActionItemStatus | AgendaItemStatus | AttendanceStatus): string {
  const map: Record<string, string> = {
    scheduled: '#6366f1',
    in_progress: '#f59e0b',
    completed: '#22c55e',
    cancelled: '#94a3b8',
    open: '#f59e0b',
    overdue: '#ef4444',
    pending_approval: '#f59e0b',
    approved: '#22c55e',
    rejected: '#ef4444',
    presented: '#6366f1',
    deferred: '#94a3b8',
    present: '#22c55e',
    absent: '#ef4444',
    remote: '#0ea5e9',
    excused: '#f59e0b',
  }
  return map[status] || '#94a3b8'
}

export function getPriorityColor(p: string): string {
  const map: Record<string, string> = {
    urgent: '#ef4444',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#22c55e',
  }
  return map[p] || '#94a3b8'
}

export function formatMeetingDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function formatMeetingDuration(start: string, end: string): string {
  const mins = (new Date(end).getTime() - new Date(start).getTime()) / 60000
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`
}

export function isUpcoming(meeting: Meeting): boolean {
  return new Date(meeting.scheduledAt) >= new Date() && meeting.status !== 'cancelled'
}

export function isPast(meeting: Meeting): boolean {
  return meeting.status === 'completed' || (new Date(meeting.scheduledAt) < new Date() && meeting.status !== 'cancelled')
}

export function getDaysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

export function getAgendaTotalDuration(meeting: Meeting): number {
  return meeting.agenda.filter(a => a.status === 'approved').reduce((sum, a) => sum + a.durationMinutes, 0)
}

export function countByStatus<T extends { status: string }>(items: T[]): Record<string, number> {
  return items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export function getAttendanceRate(meetings: Meeting[]): number {
  const completed = meetings.filter(m => m.status === 'completed')
  if (!completed.length) return 0
  const totalSlots = completed.reduce((sum, m) => sum + m.attendees.length, 0)
  const present = completed.reduce((sum, m) => sum + m.attendees.filter(a => a.status === 'present' || a.status === 'remote').length, 0)
  return totalSlots > 0 ? Math.round((present / totalSlots) * 100) : 0
}

export function getActionItemCompletionRate(items: ActionItem[]): number {
  if (!items.length) return 0
  return Math.round((items.filter(i => i.status === 'completed').length / items.length) * 100)
}

export function filterMeetings(meetings: Meeting[], search: string, type: string, status: string): Meeting[] {
  return meetings.filter(m => {
    if (type && m.type !== type) return false
    if (status && m.status !== status) return false
    if (search) {
      const q = search.toLowerCase()
      return m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.agenda.some(a => a.title.toLowerCase().includes(q))
    }
    return true
  })
}
